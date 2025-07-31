/*
  # Sistema de Assinatura e Controle de Acesso

  1. Novas Tabelas
    - `subscriptions` - Controle de assinaturas dos usuários
    - `subscription_plans` - Planos disponíveis
    - `api_access` - Configurações de API e FTP para cada usuário
    - `payment_transactions` - Histórico de pagamentos de assinatura

  2. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas específicas para usuário master
    - Controle de acesso baseado em assinatura ativa

  3. Funcionalidades
    - Período de teste de 7 dias
    - Usuário master com acesso ilimitado
    - Sistema de pagamento de assinatura
    - API keys individuais para integração externa
    - Configuração FTP por usuário
*/

-- Enum para tipos de plano
CREATE TYPE subscription_plan_type AS ENUM ('trial', 'paid', 'master');

-- Enum para status de assinatura
CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled', 'pending_payment');

-- Tabela de planos de assinatura
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 30.00,
  duration_days integer NOT NULL DEFAULT 30,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de assinaturas dos usuários
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type subscription_plan_type DEFAULT 'trial',
  status subscription_status DEFAULT 'active',
  trial_start_date timestamptz DEFAULT now(),
  trial_end_date timestamptz DEFAULT (now() + interval '7 days'),
  payment_date timestamptz,
  payment_amount numeric(10,2),
  payment_intent_id text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Tabela de configurações de API e FTP
CREATE TABLE IF NOT EXISTS api_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  webhook_url text,
  ftp_config jsonb,
  rate_limit integer DEFAULT 1000,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE(user_id)
);

-- Tabela de transações de pagamento de assinatura
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  payment_method text DEFAULT 'mercadopago',
  payment_intent_id text,
  status text DEFAULT 'pending',
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Inserir plano padrão
INSERT INTO subscription_plans (name, price, duration_days, features) VALUES 
('Plano Mensal', 30.00, 30, '["Agendamentos ilimitados", "Álbuns ilimitados", "Upload de fotos", "Sistema de pagamento", "Integração Google Calendar", "API para automação", "Acesso FTP", "Suporte técnico"]'::jsonb)
ON CONFLICT DO NOTHING;

-- Criar assinatura master para o usuário principal
DO $$
DECLARE
  master_user_id uuid;
BEGIN
  -- Buscar o usuário master pelo email
  SELECT id INTO master_user_id 
  FROM auth.users 
  WHERE email = 'valdigley2007@gmail.com' 
  LIMIT 1;
  
  -- Se encontrou o usuário, criar assinatura master
  IF master_user_id IS NOT NULL THEN
    INSERT INTO subscriptions (
      user_id, 
      plan_type, 
      status, 
      trial_start_date, 
      trial_end_date,
      expires_at
    ) VALUES (
      master_user_id, 
      'master', 
      'active',
      now(),
      now() + interval '100 years', -- Nunca expira
      now() + interval '100 years'
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan_type = 'master',
      status = 'active',
      expires_at = now() + interval '100 years';
      
    -- Criar configuração de API para o usuário master
    INSERT INTO api_access (user_id) VALUES (master_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;

-- Habilitar RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas para subscriptions
CREATE POLICY "Users can read own subscription"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Master user can read all subscriptions"
  ON subscriptions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = 'valdigley2007@gmail.com'
    )
  );

-- Políticas para subscription_plans
CREATE POLICY "Anyone can read active plans"
  ON subscription_plans
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Master user can manage plans"
  ON subscription_plans
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = 'valdigley2007@gmail.com'
    )
  );

-- Políticas para api_access
CREATE POLICY "Users can read own API access"
  ON api_access
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own API access"
  ON api_access
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Master user can read all API access"
  ON api_access
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = 'valdigley2007@gmail.com'
    )
  );

-- Políticas para payment_transactions
CREATE POLICY "Users can read own transactions"
  ON payment_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Master user can read all transactions"
  ON payment_transactions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = 'valdigley2007@gmail.com'
    )
  );

-- Função para verificar se usuário tem acesso ativo
CREATE OR REPLACE FUNCTION check_user_access(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email text;
  subscription_record record;
BEGIN
  -- Verificar se é usuário master
  SELECT email INTO user_email FROM auth.users WHERE id = user_id;
  IF user_email = 'valdigley2007@gmail.com' THEN
    RETURN true;
  END IF;
  
  -- Verificar assinatura
  SELECT * INTO subscription_record 
  FROM subscriptions 
  WHERE subscriptions.user_id = check_user_access.user_id 
  AND status = 'active'
  AND (expires_at IS NULL OR expires_at > now());
  
  RETURN subscription_record IS NOT NULL;
END;
$$;

-- Função para criar assinatura trial automática
CREATE OR REPLACE FUNCTION create_trial_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Criar assinatura trial para novos usuários (exceto master)
  IF NEW.email != 'valdigley2007@gmail.com' THEN
    INSERT INTO subscriptions (
      user_id,
      plan_type,
      status,
      trial_start_date,
      trial_end_date,
      expires_at
    ) VALUES (
      NEW.id,
      'trial',
      'active',
      now(),
      now() + interval '7 days',
      now() + interval '7 days'
    );
    
    -- Criar configuração de API
    INSERT INTO api_access (user_id) VALUES (NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para criar assinatura trial automática
CREATE OR REPLACE TRIGGER create_trial_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_trial_subscription();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_access_user_id ON api_access(user_id);
CREATE INDEX IF NOT EXISTS idx_api_access_api_key ON api_access(api_key);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);