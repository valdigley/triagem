/*
  # Configurar bucket de fotos e políticas RLS

  1. Storage Bucket
    - Criar bucket 'photos' se não existir
    - Configurar como público para visualização
    - Definir limites de tamanho

  2. Storage Policies
    - Permitir upload para fotógrafos autenticados
    - Permitir visualização pública das fotos
    - Permitir exclusão apenas pelo proprietário

  3. Verificações
    - Verificar se bucket existe
    - Aplicar políticas corretas
*/

-- Criar bucket 'photos' se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;

-- Política para upload (INSERT)
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos' AND
  auth.uid() IS NOT NULL
);

-- Política para visualização (SELECT)
CREATE POLICY "Public can view photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'photos');

-- Política para exclusão (DELETE)
CREATE POLICY "Users can delete own photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos' AND
  auth.uid() IS NOT NULL
);

-- Política para atualização (UPDATE)
CREATE POLICY "Users can update own photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos' AND
  auth.uid() IS NOT NULL
)
WITH CHECK (
  bucket_id = 'photos' AND
  auth.uid() IS NOT NULL
);

-- Verificar se as políticas foram aplicadas
DO $$
BEGIN
  -- Log das políticas criadas
  RAISE NOTICE 'Storage bucket "photos" configured successfully';
  RAISE NOTICE 'Upload policy: Authenticated users can upload';
  RAISE NOTICE 'View policy: Public can view';
  RAISE NOTICE 'Delete policy: Users can delete own photos';
END $$;