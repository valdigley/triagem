import React, { useState } from 'react';
import { Check, Download, Eye, ShoppingCart, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSupabaseData } from '../hooks/useSupabaseData';

interface Photo {
  id: string;
  filename: string;
  thumbnailPath: string;
  watermarkedPath: string;
  isSelected: boolean;
  price: number;
}

interface PhotoGalleryProps {
  albumId: string;
  isClientView?: boolean;
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  albumId,
  isClientView = false,
}) => {
  const { photos, updatePhoto, loading } = useSupabaseData();
  const albumPhotos = photos.filter(photo => photo.album_id === albumId);
  
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(
    new Set(albumPhotos.filter(p => p.is_selected).map(p => p.id))
  );
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);

  // Atualizar seleções quando as fotos carregarem
  React.useEffect(() => {
    const selected = new Set(albumPhotos.filter(p => p.is_selected).map(p => p.id));
    setSelectedPhotos(selected);
  }, [albumPhotos]);

  const togglePhotoSelection = async (photoId: string) => {
    const newSelected = new Set(selectedPhotos);
    const isSelected = newSelected.has(photoId);
    
    if (isSelected) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    
    setSelectedPhotos(newSelected);
    
    // Atualizar no banco de dados
    const success = await updatePhoto(photoId, { is_selected: !isSelected });
    if (!success) {
      // Reverter se falhou
      setSelectedPhotos(prev => isSelected ? new Set([...prev, photoId]) : new Set([...prev].filter(id => id !== photoId)));
    }
  };

  const totalPrice = Array.from(selectedPhotos).reduce((total, photoId) => {
    const photo = albumPhotos.find(p => p.id === photoId);
    return total + (photo?.price || 0);
  }, 0);

  const handleFinishSelection = () => {
    if (selectedPhotos.size === 0) {
      toast.error('Selecione pelo menos uma foto');
      return;
    }

    // Redirect to checkout
    toast.success(`${selectedPhotos.size} fotos selecionadas! Redirecionando para o checkout...`);
    // In a real app, this would navigate to the checkout page
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Carregando fotos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isClientView ? 'Suas Fotos' : 'Galeria do Álbum'}
          </h2>
          <p className="text-gray-600">
            {albumPhotos.length} fotos disponíveis
            {isClientView && ` • ${selectedPhotos.size} selecionadas`}
          </p>
        </div>

        {isClientView && selectedPhotos.size > 0 && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-xl font-bold text-gray-900">
                R$ {totalPrice.toFixed(2)}
              </p>
            </div>
            <button
              onClick={handleFinishSelection}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              Finalizar Seleção
            </button>
          </div>
        )}
      </div>

      {/* Photo Grid */}
      {albumPhotos.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Eye className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma foto encontrada</h3>
          <p className="text-gray-600">Este álbum ainda não possui fotos.</p>
        </div>
      ) : (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {albumPhotos.map((photo) => {
          const isSelected = selectedPhotos.has(photo.id);
          
          return (
            <div
              key={photo.id}
              className={`relative group aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
                isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:shadow-lg'
              }`}
            >
              {/* Photo */}
              <img
                src={`https://picsum.photos/400/400?random=${photo.id.slice(-6)}`}
                alt={photo.filename}
                className="w-full h-full object-cover"
                loading="lazy"
              />

              {/* Watermark overlay for client view */}
              {isClientView && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-white bg-opacity-20 px-4 py-2 rounded-lg backdrop-blur-sm">
                    <span className="text-white font-semibold text-sm">© Fotógrafo</span>
                  </div>
                </div>
              )}

              {/* Selection overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200">
                <div className="absolute top-2 right-2 space-y-2">
                  {/* View button */}
                  <button
                    onClick={() => setLightboxPhoto(photo)}
                    className="w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center hover:bg-opacity-100 transition-all duration-200 opacity-0 group-hover:opacity-100"
                  >
                    <Eye className="w-4 h-4 text-gray-700" />
                  </button>

                  {/* Selection button for client view */}
                  {isClientView && (
                    <button
                      onClick={() => togglePhotoSelection(photo.id)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                        isSelected
                          ? 'bg-blue-500 text-white opacity-100'
                          : 'bg-white bg-opacity-90 text-gray-700 opacity-0 group-hover:opacity-100 hover:bg-opacity-100'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Price tag for client view */}
                {isClientView && (
                  <div className="absolute bottom-2 left-2">
                    <span className="bg-white bg-opacity-90 px-2 py-1 rounded text-xs font-semibold text-gray-800 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      R$ {photo.price.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Selection indicator */}
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
      {lightboxPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 transition-colors z-10"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            <img
              src={`https://picsum.photos/1200/800?random=${lightboxPhoto.id.slice(-6)}`}
              alt={lightboxPhoto.filename}
              className="max-w-full max-h-full object-contain rounded-lg"
            />

            {/* Photo info */}
            <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 rounded-lg p-4">
              <div className="flex justify-between items-center text-white">
                <div>
                  <p className="font-semibold">{lightboxPhoto.filename}</p>
                  {isClientView && (
                    <p className="text-sm text-gray-300">
                      R$ {lightboxPhoto.price.toFixed(2)}
                    </p>
                  )}
                </div>
                
                {isClientView && (
                  <button
                    onClick={() => togglePhotoSelection(lightboxPhoto.id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedPhotos.has(lightboxPhoto.id)
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-white text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {selectedPhotos.has(lightboxPhoto.id) ? 'Selecionada' : 'Selecionar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoGallery;