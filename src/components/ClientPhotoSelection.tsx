import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Eye, ChevronLeft, ChevronRight, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface Photo {
  id: string;
  filename: string;
  thumbnail_path: string;
  is_selected: boolean;
  price: number;
}

interface Album {
  id: string;
  name: string;
  share_token: string;
  is_active: boolean;
}

const ClientPhotoSelection: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlbumData();
  }, [shareToken]);

  const loadAlbumData = async () => {
    try {
      // Load album
      const { data: albumData, error: albumError } = await supabase
        .from('albums')
        .select('*')
        .eq('share_token', shareToken)
        .eq('is_active', true)
        .single();

      if (albumError || !albumData) {
        toast.error('Álbum não encontrado');
        return;
      }

      setAlbum(albumData);

      // Load photos
      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select('*')
        .eq('album_id', albumData.id)
        .order('created_at', { ascending: true });

      if (photosError) {
        toast.error('Erro ao carregar fotos');
        return;
      }

      setPhotos(photosData || []);
      
      // Initialize selections
      const selected = new Set(photosData?.filter(p => p.is_selected).map(p => p.id) || []);
      setSelectedPhotos(selected);

    } catch (error) {
      console.error('Error loading album data:', error);
      toast.error('Erro ao carregar álbum');
    } finally {
      setLoading(false);
    }
  };

  const togglePhotoSelection = async (photoId: string) => {
    const newSelected = new Set(selectedPhotos);
    const isSelected = selectedPhotos.has(photoId);
    
    if (isSelected) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    
    setSelectedPhotos(newSelected);
    
    // Update in database
    try {
      const { error } = await supabase
        .from('photos')
        .update({ is_selected: !isSelected })
        .eq('id', photoId);

      if (error) {
        console.error('Error updating photo selection:', error);
        // Revert if failed
        setSelectedPhotos(prev => isSelected ? new Set([...prev, photoId]) : new Set([...prev].filter(id => id !== photoId)));
        toast.error('Erro ao atualizar seleção');
      }
    } catch (error) {
      console.error('Error updating photo selection:', error);
      toast.error('Erro ao atualizar seleção');
    }
  };

  const totalPrice = Array.from(selectedPhotos).reduce((total, photoId) => {
    const photo = photos.find(p => p.id === photoId);
    return total + (photo?.price || 0);
  }, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando fotos...</p>
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Álbum não encontrado</h1>
          <p className="text-gray-600">O link pode estar inválido ou o álbum pode ter sido desativado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{album.name}</h1>
          <p className="text-gray-600">
            {photos.length} fotos disponíveis • {selectedPhotos.size} selecionadas
          </p>
          {selectedPhotos.size > 0 && (
            <p className="text-lg font-semibold text-green-600 mt-2">
              Total: R$ {totalPrice.toFixed(2)}
            </p>
          )}
        </div>

        {/* Photo Grid */}
        {photos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Nenhuma foto encontrada neste álbum.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {photos.map((photo, index) => {
              const isSelected = selectedPhotos.has(photo.id);
              
              return (
                <div
                  key={photo.id}
                  className={`relative group bg-gray-100 rounded-lg overflow-hidden cursor-pointer transition-all ${
                    isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:shadow-lg'
                  }`}
                  style={{ aspectRatio: '1/1' }}
                >
                  <img
                    src={photo.thumbnail_path}
                    alt={photo.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = `https://picsum.photos/400/400?random=${photo.id.slice(-6)}`;
                    }}
                  />

                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all">
                    <div className="absolute top-2 right-2 space-y-2">
                      <button
                        onClick={() => setLightboxPhotoIndex(index)}
                        className="w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center hover:bg-opacity-100 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Eye className="w-4 h-4 text-gray-700" />
                      </button>

                      <button
                        onClick={() => togglePhotoSelection(photo.id)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-blue-500 text-white opacity-100'
                            : 'bg-white bg-opacity-90 text-gray-700 opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="absolute bottom-2 left-2">
                      <span className="bg-white bg-opacity-90 px-2 py-1 rounded text-xs font-semibold text-gray-800 opacity-0 group-hover:opacity-100 transition-all">
                        R$ {photo.price.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="absolute top-2 left-2">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Lightbox */}
        {lightboxPhotoIndex !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
            <div className="relative max-w-4xl max-h-full">
              <button
                onClick={() => setLightboxPhotoIndex(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 z-10"
              >
                <X className="w-6 h-6 text-white" />
              </button>

              <button
                onClick={() => setLightboxPhotoIndex(lightboxPhotoIndex > 0 ? lightboxPhotoIndex - 1 : photos.length - 1)}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 z-10"
              >
                <ChevronLeft className="w-8 h-8 text-white" />
              </button>

              <button
                onClick={() => setLightboxPhotoIndex(lightboxPhotoIndex < photos.length - 1 ? lightboxPhotoIndex + 1 : 0)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 z-10"
              >
                <ChevronRight className="w-8 h-8 text-white" />
              </button>

              <img
                src={photos[lightboxPhotoIndex].thumbnail_path}
                alt={photos[lightboxPhotoIndex].filename}
                className="max-w-full max-h-[80vh] object-contain rounded-lg mx-auto"
                onError={(e) => {
                  e.currentTarget.src = `https://picsum.photos/1200/800?random=${photos[lightboxPhotoIndex].id.slice(-6)}`;
                }}
              />

              <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 rounded-lg p-4">
                <div className="flex justify-between items-center text-white">
                  <div>
                    <p className="font-medium">{photos[lightboxPhotoIndex].filename}</p>
                    <p className="text-sm text-gray-300">
                      {lightboxPhotoIndex + 1} de {photos.length} • R$ {photos[lightboxPhotoIndex].price.toFixed(2)}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => togglePhotoSelection(photos[lightboxPhotoIndex].id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedPhotos.has(photos[lightboxPhotoIndex].id)
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-white text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {selectedPhotos.has(photos[lightboxPhotoIndex].id) ? 'Selecionada' : 'Selecionar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientPhotoSelection;