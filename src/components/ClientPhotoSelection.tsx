import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Check, ShoppingCart, Eye, ChevronLeft, ChevronRight, X, MessageCircle, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface Photo {
  id: string;
  filename: string;
  thumbnailPath: string;
  watermarkedPath: string;
  isSelected: boolean;
  price: number;
}

interface Album {
  id: string;
  name: string;
  shareToken: string;
  isActive: boolean;
}

interface ClientPhotoSelectionProps {
  shareToken?: string;
}

const ClientPhotoSelection: React.FC<ClientPhotoSelectionProps> = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlbumData();
    loadWatermarkConfig();
  }, [shareToken]);

  const loadAlbumData = async () => {
    try {
      // Buscar álbum pelo share token
      const { data: albumData, error: albumError } = await supabase
        .from('albums')
        .select('*')
        .eq('share_token', shareToken)
        .eq('is_active', true)
        .single();

      if (albumError || !albumData) {
        toast.error('Álbum não encontrado ou inativo');
        return;
      }

      setAlbum(albumData);

      // Buscar fotos do álbum
      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select('*')
        .eq('album_id', albumData.id)
        .order('created_at', { ascending: true });

      if (photosError) {
        toast.error('Erro ao carregar fotos');
        return;
      }

      const formattedPhotos = photosData.map(photo => ({
        id: photo.id,
        filename: photo.filename,
        thumbnailPath: photo.thumbnail_path,
        watermarkedPath: photo.watermarked_path,
        isSelected: photo.is_selected,
        price: photo.price,
      }));

      setPhotos(formattedPhotos);
      
      // Inicializar seleções
      const selected = new Set(formattedPhotos.filter(p => p.isSelected).map(p => p.id));
      setSelectedPhotos(selected);

    } catch (error) {
      console.error('Error loading album data:', error);
      toast.error('Erro ao carregar dados do álbum');
    } finally {
      setLoading(false);
    }
  };

  const loadWatermarkConfig = async () => {
    try {
      const { data: photographer } = await supabase
        .from('photographers')
        .select('watermark_config')
        .limit(1)
        .single();

      if (photographer?.watermark_config?.watermarkFile) {
        setWatermarkConfig(photographer.watermark_config);
      }
    } catch (error) {
      console.error('Error loading watermark config:', error);
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
    try {
      const { error } = await supabase
        .from('photos')
        .update({ is_selected: !isSelected })
        .eq('id', photoId);

      if (error) {
        console.error('Error updating photo selection:', error);
        // Reverter se falhou
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

  // Calcular preços com sistema de pacote mínimo e desconto progressivo
  const calculateTotalWithDiscount = () => {
    const selectedCount = selectedPhotos.size;
    const minimumPackagePrice = 300.00; // Será carregado das configurações
    const extraPhotoPrice = 30.00; // Será carregado das configurações
    
    if (selectedCount <= 10) {
      // Até 10 fotos: preço do pacote mínimo proporcional
      const proportionalPrice = (minimumPackagePrice / 10) * selectedCount;
      return {
        total: proportionalPrice,
        discount: 0,
        hasDiscount: false,
        extraPhotosCount: 0,
        packagePhotos: selectedCount,
        isMinimumPackage: selectedCount === 10
      };
    }
    
    // Mais de 10 fotos: pacote mínimo + fotos extras com desconto
    const extraPhotosCount = selectedCount - 10;
    let extraPhotosTotal = extraPhotosCount * extraPhotoPrice;
    let discount = 0;
    
    // Aplicar desconto progressivo nas fotos extras
    if (extraPhotosCount > 10) {
      // Mais de 10 extras: 10% desconto
      discount = extraPhotosTotal * 0.10;
    } else if (extraPhotosCount > 5) {
      // Mais de 5 extras: 5% desconto
      discount = extraPhotosTotal * 0.05;
    }
    
    const finalExtraTotal = extraPhotosTotal - discount;
    const finalTotal = minimumPackagePrice + finalExtraTotal;
    
    return {
      total: finalTotal,
      discount: discount,
      hasDiscount: discount > 0,
      extraPhotosCount: extraPhotosCount,
      packagePhotos: 10,
      extraPhotosOriginalTotal: extraPhotosTotal,
      minimumPackagePrice: minimumPackagePrice
    };
  };

  const priceCalculation = calculateTotalWithDiscount();

  const handleFinishSelection = () => {
    if (selectedPhotos.size === 0) {
      toast.error('Selecione pelo menos uma foto');
      return;
    }
    setShowCheckout(true);
  };

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando suas fotos...</p>
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

  if (showCheckout) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <Checkout
            albumId={album.id}
            selectedPhotos={Array.from(selectedPhotos)}
            totalAmount={priceCalculation.total}
            onBack={() => setShowCheckout(false)}
            onComplete={() => {
              setShowCheckout(false);
              setSelectedPhotos(new Set());
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{album.name}</h1>
          <p className="text-gray-600">
            Selecione suas fotos favoritas • {photos.length} fotos disponíveis • {selectedPhotos.size} selecionadas
          </p>
        </div>

        {/* Selection Summary */}
        {selectedPhotos.size > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedPhotos.size} foto{selectedPhotos.size > 1 ? 's' : ''} selecionada{selectedPhotos.size > 1 ? 's' : ''}
                </h3>
                <div className="text-gray-600">
                  {priceCalculation.hasDiscount ? (
                    <div>
                      <p className="text-sm">
                        Primeiras 10 fotos: R$ {(totalPrice - (priceCalculation.extraPhotosCount * (photos[0]?.price || 0))).toFixed(2)}
                      </p>
                      <p className="text-sm">
                        {priceCalculation.extraPhotosCount} fotos extras (20% desconto): 
                        <span className="line-through text-gray-400 ml-1">
                          R$ {(priceCalculation.extraPhotosCount * (photos[0]?.price || 0)).toFixed(2)}
                        </span>
                        <span className="text-green-600 ml-1 font-medium">
                          R$ {(priceCalculation.extraPhotosCount * (photos[0]?.price || 0) * 0.8).toFixed(2)}
                        </span>
                      </p>
                      <p className="font-semibold text-lg">
                        Total: R$ {priceCalculation.total.toFixed(2)}
                        <span className="text-green-600 text-sm ml-2">
                          (Economia: R$ {priceCalculation.discount.toFixed(2)})
                        </span>
                      </p>
                    </div>
                  ) : (
                    <p>Total: R$ {priceCalculation.total.toFixed(2)}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleFinishSelection}
               disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <ShoppingCart className="w-5 h-5" />
               {isSubmitting ? 'Finalizando...' : 'Finalizar Seleção'}
              </button>
            </div>
          </div>
        )}

        {/* Photo Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {photos.map((photo, index) => {
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
                  src={photo.thumbnailPath}
                  alt={photo.filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = `https://picsum.photos/400/400?random=${photo.id.slice(-6)}`;
                  }}
                />

                {/* Watermark overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {watermarkConfig && watermarkConfig.file && (
                    <img
                      src={watermarkConfig.file}
                      alt="Watermark"
                      style={getWatermarkStyle()}
                    />
                  )}
                </div>

                {/* Selection overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200">
                  <div className="absolute top-2 right-2 space-y-2">
                    {/* View button */}
                    <button
                      onClick={() => setLightboxPhotoIndex(index)}
                      className="w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center hover:bg-opacity-100 transition-all duration-200 opacity-0 group-hover:opacity-100"
                    >
                      <Eye className="w-4 h-4 text-gray-700" />
                    </button>

                    {/* Selection button */}
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
                  </div>

                  {/* Price tag */}
                  <div className="absolute bottom-2 left-2">
                    <span className="bg-white bg-opacity-90 px-2 py-1 rounded text-xs font-semibold text-gray-800 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      R$ {photo.price.toFixed(2)}
                    </span>
                  </div>
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

        {/* Lightbox */}
        {lightboxPhotoIndex !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
            <div className="relative max-w-4xl max-h-full">
              {/* Close button */}
              <button
                onClick={() => setLightboxPhotoIndex(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 transition-colors z-10"
              >
                <X className="w-6 h-6 text-white" />
              </button>

              {/* Navigation buttons */}
              <button
                onClick={() => setLightboxPhotoIndex(lightboxPhotoIndex > 0 ? lightboxPhotoIndex - 1 : photos.length - 1)}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 transition-colors z-10"
              >
                <ChevronLeft className="w-8 h-8 text-white" />
              </button>

              <button
                onClick={() => setLightboxPhotoIndex(lightboxPhotoIndex < photos.length - 1 ? lightboxPhotoIndex + 1 : 0)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 transition-colors z-10"
              >
                <ChevronRight className="w-8 h-8 text-white" />
              </button>

              {/* Main image */}
              <div className="relative">
                <img
                  src={photos[lightboxPhotoIndex].watermarkedPath}
                  alt={photos[lightboxPhotoIndex].filename}
                  className="max-w-full max-h-full object-contain rounded-lg"
                  onError={(e) => {
                    e.currentTarget.src = `https://picsum.photos/1200/800?random=${photos[lightboxPhotoIndex].id.slice(-6)}`;
                  }}
                />
                
                {/* Watermark overlay */}
                {watermarkConfig && watermarkConfig.file && (
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
                    <p className="font-semibold">{photos[lightboxPhotoIndex].filename}</p>
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