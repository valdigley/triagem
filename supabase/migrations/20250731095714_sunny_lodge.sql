/*
  # Corrigir isolamento de clientes entre estúdios

  1. Modificações na tabela clients
    - Adicionar coluna photographer_id para associar clientes a fotógrafos específicos
    - Criar índice para performance
    - Migrar dados existentes

  2. Atualizar políticas RLS
    - Restringir acesso apenas aos clientes do próprio fotógrafo
    - Remover política muito permissiva atual

  3. Garantir isolamento completo
    - Cada estúdio vê apenas seus próprios clientes
    - Dados não vazam entre contas diferentes
*/

-- Adicionar coluna photographer_id à tabela clients se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'photographer_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN photographer_id uuid REFERENCES photographers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_clients_photographer_id ON clients(photographer_id);

-- Migrar dados existentes: associar clientes aos fotógrafos baseado nos eventos
UPDATE clients 
SET photographer_id = (
  SELECT DISTINCT e.photographer_id 
  FROM events e 
  WHERE e.client_email = clients.email 
  LIMIT 1
)
WHERE photographer_id IS NULL;

-- Remover política muito permissiva atual
DROP POLICY IF EXISTS "Photographers can manage clients" ON clients;

-- Criar nova política restritiva baseada no photographer_id
CREATE POLICY "Photographers can manage own clients only"
  ON clients
  FOR ALL
  TO authenticated
  USING (
    photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )
  );

-- Política para inserção durante criação de eventos (quando photographer_id ainda não está definido)
CREATE POLICY "Allow insert with photographer validation"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )
  );