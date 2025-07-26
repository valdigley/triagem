import React, { useState } from 'react';
import { Check, Download, Eye, ShoppingCart, X, ChevronLeft, ChevronRight, Settings, MessageSquare, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSupabaseData } from '../hooks/useSupabaseData';
import Checkout from './Checkout';
import WatermarkSettings from './WatermarkSettings';

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
  isClientView: boolean;
  onBackToAlbums?: () => void;
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  albumId,
  isClientView,
  onBackToAlbums,
}) => {
  const { photos, updatePhoto, loading } = useSupabaseData();
  const albumPhotos = photos.filter(photo => photo.album_id === albumId);
  
  // Estados apenas para visualização do cliente
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState<number | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [watermarkConfig, setWatermarkConfig] = useState<any>(null);
  const [showComments, setShowComments] = useState(false);
  const [photoComments, setPhotoComments] = useState<Record<string, string>>({});
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [tempComment, setTempComment] = useState('');

  // Inicializar seleções quando as fotos carregarem (apenas para cliente)
  React.useEffect(() => {
    if (albumPhotos.length > 0 && isClientView) {
      const selected = new Set(albumPhotos.filter(p => p.is_selected).map(p => p.id));
      setSelectedPhotos(selected);
    }
    
    // Carregar comentários das fotos
    if (albumPhotos.length > 0) {
      const comments: Record<string, string> = {};
      albumPhotos.forEach(photo => {
        if (photo.metadata?.comment) {
          comments[photo.id] = photo.metadata.comment;
        }
      });
      setPhotoComments(comments);
    }
  }, [albumId, photos.length, isClientView]);

  // Carregar configuração de marca d'água
  React.useEffect(() => {
    loadWatermarkConfig();
  }, []);

  const loadWatermarkConfig = async () => {
    try {
      // Tentar carregar do banco de dados primeiro
      const { supabase } = await import('../lib/supabase');
      const { data: photographer } = await supabase
        .from('photographers')
        .select('watermark_config')
        .limit(1)
        .single();

      if (photographer?.watermark_config?.watermarkFile) {
        setWatermarkConfig(photographer.watermark_config);
        return;
      }
    } catch (error) {
      console.error('Error loading watermark from database:', error);
    }
  };
  
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

    setShowCheckout(true);
  };

  const handleCheckoutComplete = () => {
    setShowCheckout(false);
    setSelectedPhotos(new Set());
    if (onBackToAlbums) {
      onBackToAlbums();
    }
  };

  const openLightbox = (photoIndex: number) => {
    setLightboxPhotoIndex(photoIndex);
  };

  const closeLightbox = () => {
    setLightboxPhotoIndex(null);
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (lightboxPhotoIndex === null) return;
    
    if (direction === 'prev') {
      setLightboxPhotoIndex(lightboxPhotoIndex > 0 ? lightboxPhotoIndex - 1 : albumPhotos.length - 1);
    } else {
      setLightboxPhotoIndex(lightboxPhotoIndex < albumPhotos.length - 1 ? lightboxPhotoIndex + 1 : 0);
    }
  };

  const handleKeyPress = React.useCallback((e: KeyboardEvent) => {
    if (lightboxPhotoIndex === null) return;
    
    switch (e.key) {
      case 'ArrowLeft':
        navigateLightbox('prev');
        break;
      case 'ArrowRight':
        navigateLightbox('next');
        break;
      case 'Escape':
        closeLightbox();
        break;
    }
  }, [lightboxPhotoIndex]);

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const getWatermarkStyle = () => {
    if (!watermarkConfig) return {};
    
    const baseStyle = {
      position: 'absolute' as const,
      opacity: watermarkConfig.opacity,
      width: `${watermarkConfig.size}%`,
      height: 'auto',
      pointerEvents: 'none' as const,
    };

    switch (watermarkConfig.position) {
      case 'center':
        return { ...baseStyle, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      case 'bottom-right':
        return { ...baseStyle, bottom: '20px', right: '20px' };
      case 'bottom-left':
        return { ...baseStyle, bottom: '20px', left: '20px' };
      case 'top-right':
        return { ...baseStyle, top: '20px', right: '20px' };
      case 'top-left':
        return { ...baseStyle, top: '20px', left: '20px' };
      default:
        return baseStyle;
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Carregando fotos...</span>
      </div>
    );
  }

  if (showCheckout) {
    return (
      <Checkout
        albumId={albumId}
        selectedPhotos={Array.from(selectedPhotos)}
        totalAmount={totalPrice}
        onBack={() => setShowCheckout(false)}
        onComplete={handleCheckoutComplete}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isClientView ? 'Suas Fotos' : 'Fotos da Sessão'}
          </h2>
          <p className="text-gray-600">
            {albumPhotos.length} fotos disponíveis
            {isClientView && ` • ${selectedPhotos.size} selecionadas`}
          </p>
        </div>

        <div className="flex items-center gap-4">
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
        {albumPhotos.map((photo, index) => {
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
                src={photo.thumbnail_path}
                alt={photo.filename}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  // Fallback para imagem de demonstração se a real falhar
                  e.currentTarget.src = `https://picsum.photos/400/400?random=${photo.id.slice(-6)}`;
                }}
              />

              {/* Watermark overlay for client view */}
              {isClientView && watermarkConfig && watermarkConfig.file && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <img
                      src={watermarkConfig.file}
                      alt="Watermark"
                      style={getWatermarkStyle()}
                    />
                </div>
              )}

              {/* Selection overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200">
                <div className="absolute top-2 right-2 space-y-2">
                  {/* View button */}
                  <button
                    onClick={() => openLightbox(index)}
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
      {lightboxPhotoIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full">
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 transition-colors z-10"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            {/* Navigation buttons */}
            <button
              onClick={() => navigateLightbox('prev')}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 transition-colors z-10"
            >
              <ChevronLeft className="w-8 h-8 text-white" />
            </button>

            <button
              onClick={() => navigateLightbox('next')}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 transition-colors z-10"
            >
              <ChevronRight className="w-8 h-8 text-white" />
            </button>
            {/* Main image */}
            <div className="relative">
              <img
                src={albumPhotos[lightboxPhotoIndex].original_path}
                alt={albumPhotos[lightboxPhotoIndex].filename}
                className="max-w-full max-h-[80vh] object-contain rounded-lg mx-auto"
                onError={(e) => {
                  // Fallback para imagem de demonstração se a real falhar
                  e.currentTarget.src = `https://picsum.photos/1200/800?random=${albumPhotos[lightboxPhotoIndex].id.slice(-6)}`;
                }}
              />
              
              {/* Watermark overlay for client view */}
              {isClientView && watermarkConfig && watermarkConfig.file && (
                <img
                  src={watermarkConfig.file}
                  alt="Watermark"
                  style={getWatermarkStyle()}
                />
              )}
            </div>

            {/* Photo info */}
            <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 rounded-lg p-4">
              <div className="flex justify-between items-center text-white">
                <div>
                  <p className="font-semibold">{albumPhotos[lightboxPhotoIndex].filename}</p>
                  <p className="text-sm text-gray-300">
                    {lightboxPhotoIndex + 1} de {albumPhotos.length}
                  </p>
                  {isClientView && (
                    <p className="text-sm text-gray-300">
                      R$ {albumPhotos[lightboxPhotoIndex].price.toFixed(2)}
                    </p>
                  )}
                  {!isClientView && photoComments[albumPhotos[lightboxPhotoIndex].id] && (
                    <p className="text-sm text-yellow-300 mt-1">
                      💬 {photoComments[albumPhotos[lightboxPhotoIndex].id]}
                    </p>
                  )}
                </div>
                
                {isClientView && (
                  <button
                    onClick={() => togglePhotoSelection(albumPhotos[lightboxPhotoIndex].id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedPhotos.has(albumPhotos[lightboxPhotoIndex].id)
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-white text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {selectedPhotos.has(albumPhotos[lightboxPhotoIndex].id) ? 'Selecionada' : 'Selecionar'}
                  </button>
                )}
                
                {!isClientView && (
                  <button
                    onClick={() => startEditingComment(albumPhotos[lightboxPhotoIndex].id)}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
                  >
                    💬 Comentar
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