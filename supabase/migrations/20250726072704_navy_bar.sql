/*
  # Criar tabela de clientes

  1. Nova Tabela
    - `clients`
      - `id` (uuid, primary key)
      - `name` (text, nome completo)
      - `email` (text, unique, email do cliente)
      - `phone` (text, telefone)
      - `notes` (text, observações opcionais)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Segurança
    - Enable RLS na tabela `clients`
    - Políticas para fotógrafos gerenciarem seus próprios clientes

  3. Índices
    - Índice no email para busca rápida
    - Índice no nome para ordenação
*/

-- Criar tabela de clientes
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at);

-- Políticas RLS - Por enquanto, todos os fotógrafos autenticados podem gerenciar clientes
-- Isso pode ser refinado posteriormente para associar clientes a fotógrafos específicos
CREATE POLICY "Photographers can manage clients"
  ON clients
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();