/*
  # Corrigir período de teste para 7 dias

  1. Alterações na tabela subscriptions
    - Atualizar trial_end_date para 7 dias a partir do trial_start_date
    - Corrigir subscriptions existentes que podem ter período incorreto

  2. Segurança
    - Manter políticas RLS existentes
    - Garantir que novos usuários tenham 7 dias de teste
*/

-- Atualizar o padrão da coluna trial_end_date para 7 dias
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'trial_end_date'
  ) THEN
    ALTER TABLE subscriptions 
    ALTER COLUMN trial_end_date 
    SET DEFAULT (now() + interval '7 days');
  END IF;
END $$;

-- Atualizar subscriptions existentes que podem ter período incorreto
UPDATE subscriptions 
SET 
  trial_end_date = trial_start_date + interval '7 days',
  expires_at = CASE 
    WHEN plan_type = 'trial' THEN trial_start_date + interval '7 days'
    ELSE expires_at
  END,
  updated_at = now()
WHERE plan_type = 'trial' 
  AND trial_end_date != trial_start_date + interval '7 days';

-- Garantir que novos usuários tenham subscription criada automaticamente
CREATE OR REPLACE FUNCTION create_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (
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
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Failed to create subscription for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para novos usuários (se não existir)
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_subscription();