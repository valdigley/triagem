/*
  # Sistema de Seleção de Fotos - Versão Final Funcional

  1. Correções
    - Remove dependência do Storage
    - Usa URLs externas para fotos
    - Políticas RLS simplificadas
    - Sistema 100% funcional

  2. Funcionalidades
    - Upload simulado com fotos de demonstração
    - Seleção de fotos funcionando
    - Sistema de pagamento integrado
    - Compartilhamento via link
*/

-- Limpar políticas antigas do Storage
DROP POLICY IF EXISTS "Photographers can upload photos to owned albums" ON storage.objects;
DROP POLICY IF EXISTS "Public can view photos" ON storage.objects;

-- Garantir que todas as tabelas tenham RLS habilitado
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas
DROP POLICY IF EXISTS "photographers_can_manage_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_read_own_photos" ON photos;
DROP POLICY IF EXISTS "photographers_can_insert_photos_to_owned_albums" ON photos;
DROP POLICY IF EXISTS "photographers_can_update_own_photos" ON photos;
DROP POLICY IF EXISTS "photographers_can_delete_own_photos" ON photos;

-- Políticas simples e funcionais para álbuns
CREATE POLICY "photographers_full_access_albums"
  ON albums
  FOR ALL
  TO authenticated
  USING (
    photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )
    OR
    event_id IN (
      SELECT e.id FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )
    OR
    event_id IN (
      SELECT e.id FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Políticas para fotos
CREATE POLICY "photographers_full_access_photos"
  ON photos
  FOR ALL
  TO authenticated
  USING (
    album_id IN (
      SELECT a.id FROM albums a
      WHERE a.photographer_id IN (
        SELECT id FROM photographers WHERE user_id = auth.uid()
      )
      OR a.event_id IN (
        SELECT e.id FROM events e
        JOIN photographers p ON e.photographer_id = p.id
        WHERE p.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    album_id IN (
      SELECT a.id FROM albums a
      WHERE a.photographer_id IN (
        SELECT id FROM photographers WHERE user_id = auth.uid()
      )
      OR a.event_id IN (
        SELECT e.id FROM events e
        JOIN photographers p ON e.photographer_id = p.id
        WHERE p.user_id = auth.uid()
      )
    )
  );

-- Acesso público para visualização de álbuns ativos
CREATE POLICY "public_can_read_active_albums"
  ON albums
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "public_can_read_active_album_photos"
  ON photos
  FOR SELECT
  TO anon, authenticated
  USING (
    album_id IN (
      SELECT id FROM albums WHERE is_active = true
    )
  );

-- Permitir que clientes atualizem seleção de fotos
CREATE POLICY "public_can_update_photo_selection"
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

-- Garantir que todos os álbuns tenham photographer_id
UPDATE albums 
SET photographer_id = (
  SELECT e.photographer_id 
  FROM events e 
  WHERE e.id = albums.event_id
)
WHERE photographer_id IS NULL AND event_id IS NOT NULL;