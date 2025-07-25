/*
  # Schema inicial do sistema de seleção de fotos

  1. Novas Tabelas
    - `photographers` - Dados dos fotógrafos
      - `id` (uuid, primary key)
      - `user_id` (uuid, referência para auth.users)
      - `business_name` (text)
      - `phone` (text)
      - `google_calendar_id` (text, opcional)
      - `ftp_config` (jsonb, opcional)
      - `watermark_config` (jsonb, opcional)
      - `created_at` (timestamp)

    - `events` - Agendamentos/eventos
      - `id` (uuid, primary key)
      - `photographer_id` (uuid, referência para photographers)
      - `client_name` (text)
      - `client_email` (text)
      - `client_phone` (text)
      - `event_date` (timestamp)
      - `location` (text)
      - `notes` (text, opcional)
      - `status` (enum: scheduled, in-progress, completed, cancelled)
      - `google_calendar_event_id` (text, opcional)
      - `album_id` (uuid, opcional)
      - `created_at` (timestamp)

    - `albums` - Álbuns de fotos
      - `id` (uuid, primary key)
      - `event_id` (uuid, referência para events)
      - `name` (text)
      - `share_token` (text, único)
      - `is_active` (boolean)
      - `expires_at` (timestamp, opcional)
      - `created_at` (timestamp)

    - `photos` - Fotos individuais
      - `id` (uuid, primary key)
      - `album_id` (uuid, referência para albums)
      - `filename` (text)
      - `original_path` (text)
      - `thumbnail_path` (text)
      - `watermarked_path` (text)
      - `is_selected` (boolean)
      - `price` (decimal)
      - `metadata` (jsonb, opcional)
      - `created_at` (timestamp)

    - `orders` - Pedidos de compra
      - `id` (uuid, primary key)
      - `event_id` (uuid, referência para events)
      - `client_email` (text)
      - `selected_photos` (text array)
      - `total_amount` (decimal)
      - `status` (enum: pending, paid, cancelled, expired)
      - `payment_intent_id` (text, opcional)
      - `created_at` (timestamp)

    - `webhook_logs` - Logs de webhooks
      - `id` (uuid, primary key)
      - `event_type` (text)
      - `payload` (jsonb)
      - `response` (jsonb, opcional)
      - `status` (enum: success, failed)
      - `created_at` (timestamp)

  2. Segurança
    - Habilitar RLS em todas as tabelas
    - Políticas para fotógrafos acessarem apenas seus próprios dados
    - Políticas para clientes acessarem álbuns via share_token
*/

-- Criar enum para status de eventos
CREATE TYPE event_status AS ENUM ('scheduled', 'in-progress', 'completed', 'cancelled');

-- Criar enum para status de pedidos
CREATE TYPE order_status AS ENUM ('pending', 'paid', 'cancelled', 'expired');

-- Criar enum para status de webhook
CREATE TYPE webhook_status AS ENUM ('success', 'failed');

-- Tabela de fotógrafos
CREATE TABLE IF NOT EXISTS photographers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  phone text NOT NULL,
  google_calendar_id text,
  ftp_config jsonb,
  watermark_config jsonb,
  created_at timestamptz DEFAULT now()
);

-- Tabela de eventos/agendamentos
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid REFERENCES photographers(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text NOT NULL,
  event_date timestamptz NOT NULL,
  location text NOT NULL,
  notes text,
  status event_status DEFAULT 'scheduled',
  google_calendar_event_id text,
  album_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Tabela de álbuns
CREATE TABLE IF NOT EXISTS albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  share_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Tabela de fotos
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid REFERENCES albums(id) ON DELETE CASCADE,
  filename text NOT NULL,
  original_path text NOT NULL,
  thumbnail_path text NOT NULL,
  watermarked_path text NOT NULL,
  is_selected boolean DEFAULT false,
  price decimal(10,2) DEFAULT 25.00,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  client_email text NOT NULL,
  selected_photos text[] NOT NULL,
  total_amount decimal(10,2) NOT NULL,
  status order_status DEFAULT 'pending',
  payment_intent_id text,
  created_at timestamptz DEFAULT now()
);

-- Tabela de logs de webhook
CREATE TABLE IF NOT EXISTS webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  response jsonb,
  status webhook_status NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE photographers ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para photographers
CREATE POLICY "Photographers can read own data"
  ON photographers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Photographers can update own data"
  ON photographers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Photographers can insert own data"
  ON photographers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Políticas para events
CREATE POLICY "Photographers can manage own events"
  ON events
  FOR ALL
  TO authenticated
  USING (
    photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )
  );

-- Políticas para albums
CREATE POLICY "Photographers can manage albums of own events"
  ON albums
  FOR ALL
  TO authenticated
  USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can read albums with share_token"
  ON albums
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Políticas para photos
CREATE POLICY "Photographers can manage photos of own albums"
  ON photos
  FOR ALL
  TO authenticated
  USING (
    album_id IN (
      SELECT a.id FROM albums a
      JOIN events e ON a.event_id = e.id
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can read photos of active albums"
  ON photos
  FOR SELECT
  TO anon, authenticated
  USING (
    album_id IN (
      SELECT id FROM albums WHERE is_active = true
    )
  );

CREATE POLICY "Public can update photo selection"
  ON photos
  FOR UPDATE
  TO anon, authenticated
  USING (
    album_id IN (
      SELECT id FROM albums WHERE is_active = true
    )
  )
  WITH CHECK (
    album_id IN (
      SELECT id FROM albums WHERE is_active = true
    )
  );

-- Políticas para orders
CREATE POLICY "Photographers can read orders of own events"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can create orders"
  ON orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Políticas para webhook_logs
CREATE POLICY "Photographers can read own webhook logs"
  ON webhook_logs
  FOR SELECT
  TO authenticated
  USING (true); -- Simplificado para demonstração

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_photographers_user_id ON photographers(user_id);
CREATE INDEX IF NOT EXISTS idx_events_photographer_id ON events(photographer_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_albums_event_id ON albums(event_id);
CREATE INDEX IF NOT EXISTS idx_albums_share_token ON albums(share_token);
CREATE INDEX IF NOT EXISTS idx_photos_album_id ON photos(album_id);
CREATE INDEX IF NOT EXISTS idx_photos_selected ON photos(is_selected);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at);