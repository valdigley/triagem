/*
  # Configurar Supabase Storage para fotos

  1. Storage
    - Criar bucket 'photos' público
    - Configurar políticas de acesso
    - Permitir upload para usuários autenticados
    - Permitir visualização pública

  2. Segurança
    - Usuários autenticados podem fazer upload
    - Todos podem visualizar fotos
    - Controle de tamanho de arquivo
*/

-- Criar bucket para fotos (público para visualização)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Política para permitir upload de fotos (usuários autenticados)
CREATE POLICY "Authenticated users can upload photos" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] IN ('original', 'thumbnails', 'watermarked')
);

-- Política para permitir visualização pública de fotos
CREATE POLICY "Public can view photos" ON storage.objects
FOR SELECT 
TO public
USING (bucket_id = 'photos');

-- Política para permitir que usuários autenticados atualizem suas próprias fotos
CREATE POLICY "Users can update their photos" ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'photos');

-- Política para permitir que usuários autenticados excluam suas próprias fotos
CREATE POLICY "Users can delete their photos" ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'photos');