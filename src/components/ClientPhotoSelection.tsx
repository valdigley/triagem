import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingCart, Eye, ChevronLeft, ChevronRight, X, MessageCircle, Mail, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import Checkout from './Checkout';

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
  const [watermarkConfig, setWatermarkConfig] = useState<any>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectionLocked, setSelectionLocked] = useState(false);
  const [pricingConfig, setPricingConfig] = useState({
    photoPrice: 25.00,
    packagePhotos: 10,
    minimumPackagePrice: 300.00
  });

  const [clientData, setClientData] = useState({
    name: '',
    email: '',
    cpf: '',
  });

  useEffect(() => {
    loadAlbumData();
    loadWatermarkConfig();
    loadPricingConfig();
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

      // Buscar dados do evento para pré-preencher informações do cliente
      const { data: eventData } = await supabase
        .from('events')
        .select('client_name, client_email')
        .eq('id', albumData.event_id)
        .single();

      if (eventData) {
        setClientData(prev => ({
          ...prev,
          name: eventData.client_name,
          email: eventData.client_email,
        }));
      }

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
      
      // Verificar se a seleção já foi finalizada (tem fotos selecionadas)
      if (selected.size > 0) {
        setSelectionLocked(true);
      }

    } catch (error) {
      console.error('Error loading album data:', error);
      toast.error('Erro ao carregar dados do álbum');
    } finally {
      setLoading(false);
    }
  };

  const loadWatermarkConfig = async () => {
    try {
      // Buscar configuração do primeiro fotógrafo (assumindo um estúdio)
      const { data: photographer } = await supabase
        .from('photographers')
        .select('watermark_config, user_id')
        .limit(1)
        .single();

      if (photographer?.watermark_config?.watermarkFile) {
        setWatermarkConfig(photographer.watermark_config);
      }
    } catch (error) {
      console.error('Error loading watermark config:', error);
    }
  };

  const loadPricingConfig = async () => {
    try {
      const { data: photographer } = await supabase
        .from('photographers')
        .select('watermark_config')
        .limit(1)
        .single();

      if (photographer?.watermark_config) {
        const config = photographer.watermark_config;
        setPricingConfig({
          photoPrice: config.photoPrice || 25.00,
          packagePhotos: config.packagePhotos || 10,
          minimumPackagePrice: config.minimumPackagePrice || 300.00
        });
      }
    } catch (error) {
      console.error('Error loading pricing config:', error);
    }
  };
  const togglePhotoSelection = async (photoId: string) => {
    // Verificar se a seleção está bloqueada
    if (selectionLocked) {
      toast.error('Seleção finalizada. Entre em contato para alterações.');
      return;
    }
    
    // Verificar se excedeu o limite do pacote e não há pagamento confirmado
    const currentSelectedCount = selectedPhotos.size;
    const isSelecting = !selectedPhotos.has(photoId);
    
    if (isSelecting && currentSelectedCount >= pricingConfig.packagePhotos) {
      // Verificar se há pagamento confirmado para fotos extras
      const hasExtraPayment = await checkExtraPhotosPayment();
      if (!hasExtraPayment) {
        toast.error(`Você pode selecionar até ${pricingConfig.packagePhotos} fotos gratuitamente. Para mais fotos, é necessário pagamento.`);
        return;
      }
    }
    
    const newSelected = new Set(selectedPhotos);
    const isSelected = selectedPhotos.has(photoId);
    
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

  const checkExtraPhotosPayment = async () => {
    try {
      if (!album) return false;
      
      // Buscar pedidos pagos para este evento
      const { data: paidOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('event_id', album.event_id)
        .eq('status', 'paid')
        .gt('total_amount', 0); // Apenas pedidos com valor > 0 (fotos extras)
      
      return paidOrders && paidOrders.length > 0;
    } catch (error) {
      console.error('Error checking extra photos payment:', error);
      return false;
    }
  };

  const totalPrice = Array.from(selectedPhotos).reduce((total, photoId) => {
    const photo = photos.find(p => p.id === photoId);
    return total + (photo?.price || 0);
  }, 0);

  // Calcular preços com sistema de pacote mínimo e desconto progressivo
  const calculateTotalWithDiscount = () => {
    const selectedCount = selectedPhotos.size;
    const { photoPrice, packagePhotos } = pricingConfig;
    
    if (selectedCount <= packagePhotos) {
      // Até X fotos: incluídas no pacote mínimo (já pago no agendamento)
      return {
        total: 0, // Já pago no agendamento
        discount: 0,
        hasDiscount: false,
        extraPhotosCount: 0,
        packagePhotos: selectedCount,
        isMinimumPackage: selectedCount <= packagePhotos,
        message: `${selectedCount} foto${selectedCount > 1 ? 's' : ''} incluída${selectedCount > 1 ? 's' : ''} no pacote já pago`
      };
    }
    
    // Mais de X fotos: pacote mínimo + fotos extras com desconto
    const extraPhotosCount = selectedCount - packagePhotos;
    let extraPhotosTotal = extraPhotosCount * photoPrice;
    let discount = 0;
    
    // Aplicar desconto progressivo nas fotos extras
    if (extraPhotosCount > 5) {
      // Mais de 5 extras: 5% desconto
      discount = extraPhotosTotal * 0.05;
    }
    
    const finalExtraTotal = extraPhotosTotal - discount;
    
    return {
      total: finalExtraTotal,
      discount: discount,
      hasDiscount: discount > 0,
      extraPhotosCount: extraPhotosCount,
      packagePhotos: packagePhotos,
      extraPhotosOriginalTotal: extraPhotosTotal,
      photoPrice: photoPrice
    };
  };

  const priceCalculation = calculateTotalWithDiscount();

  const handleFinishSelection = () => {
    if (selectedPhotos.size === 0) {
      toast.error('Selecione pelo menos uma foto');
      return;
    }
    
    if (priceCalculation.total > 0) {
      setShowCheckout(true);
    } else {
      // Fotos gratuitas - confirmar seleção diretamente
      confirmFreeSelection();
    }
  };

  const confirmFreeSelection = async () => {
    setIsSubmitting(true);
    try {
      // Para seleções gratuitas, apenas atualizar as fotos como selecionadas
      // Não criar entrada na tabela orders pois não houve pagamento
      console.log('Free selection confirmed - no payment record needed');

      // Bloquear futuras alterações
      setSelectionLocked(true);
      
      toast.success('Seleção confirmada com sucesso!');
      setSelectedPhotos(new Set());
    } catch (error) {
      console.error('Error confirming free selection:', error);
      toast.error('Erro ao confirmar seleção');
    } finally {
      setIsSubmitting(false);
    }
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
              setSelectionLocked(true);
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
        {selectedPhotos.size > 0 && priceCalculation.total > 0 && !selectionLocked && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedPhotos.size} foto{selectedPhotos.size > 1 ? 's' : ''} selecionada{selectedPhotos.size > 1 ? 's' : ''}
                </h3>
                <div className="text-gray-600">
                  <div>
                    <p className="text-sm text-green-600">{pricingConfig.packagePhotos} fotos incluídas no pacote</p>
                    <p className="text-sm">
                      {priceCalculation.extraPhotosCount} fotos extras: R$ {priceCalculation.photoPrice.toFixed(2)} cada
                      {priceCalculation.hasDiscount && (
                        <span className="text-green-600 ml-2">
                          (5% desconto aplicado)
                        </span>
                      )}
                    </p>
                    <p className="font-semibold text-lg">
                      Total a pagar: R$ {priceCalculation.total.toFixed(2)}
                      {priceCalculation.hasDiscount && (
                        <span className="text-green-600 text-sm ml-2">
                          (Economia: R$ {priceCalculation.discount.toFixed(2)})
                        </span>
                      )}
                    </p>
                  </div>
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

        {/* Message for free photos */}
        {selectedPhotos.size > 0 && priceCalculation.total === 0 && !selectionLocked && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-green-900 mb-2">
                  {selectedPhotos.size} foto{selectedPhotos.size > 1 ? 's' : ''} selecionada{selectedPhotos.size > 1 ? 's' : ''}
                </h3>
                <div className="text-green-700">
                  <p className="font-medium mb-1">{priceCalculation.message}</p>
                  <p className="text-sm">Suas fotos estão incluídas no pacote já pago!</p>
                </div>
                <button
                  onClick={handleFinishSelection}
                  disabled={isSubmitting}
                  className="mt-4 flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium mx-auto"
                >
                  <Check className="w-5 h-5" />
                  {isSubmitting ? 'Confirmando...' : 'Confirmar Seleção'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instructions when no photos selected */}
        {selectedPhotos.size === 0 && !selectionLocked && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Selecione suas fotos favoritas
              </h3>
              <div className="text-blue-700">
                <p className="mb-2">
                  <strong>{pricingConfig.packagePhotos} fotos incluídas</strong> no seu pacote
                </p>
                <p className="text-sm">
                  Fotos extras: R$ {pricingConfig.photoPrice.toFixed(2)} cada
                  {pricingConfig.packagePhotos > 5 && (
                    <span className="text-green-600 ml-1">(5% desconto após 5 extras)</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Selection locked message */}
        {selectionLocked && (
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-6 mb-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Seleção Finalizada
              </h3>
              <div className="text-gray-700">
                <p className="mb-2">
                  Você já finalizou sua seleção com <strong>{selectedPhotos.size} foto{selectedPhotos.size > 1 ? 's' : ''}</strong>.
                </p>
                <p className="text-sm">
                  Para fazer alterações, entre em contato conosco.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {photos.map((photo, index) => {
            const isSelected = selectedPhotos.has(photo.id);
            
            return (
              <div
                key={photo.id}
                className={`relative group bg-gray-100 rounded-lg overflow-hidden transition-all duration-200 ${
                  isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                } ${
                  selectionLocked ? 'cursor-default' : 'cursor-pointer hover:shadow-lg'
                }`}
                style={{ aspectRatio: '1/1' }}
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
                  {watermarkConfig && watermarkConfig.watermarkFile && (
                    <img
                      src={watermarkConfig.watermarkFile}
                      alt="Watermark"
                      style={getWatermarkStyle()}
                    />
                  )}
                  {/* Fallback watermark se não houver marca d'água configurada */}
                  {!watermarkConfig?.watermarkFile && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        background: 'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,0.1) 35px, rgba(255,255,255,0.1) 70px)',
                        pointerEvents: 'none'
                      }}
                    >
                      <div className="text-white text-opacity-30 text-lg font-bold transform rotate-45">
                        PREVIEW
                      </div>
                    </div>
                  )}
                </div>

                {/* Selection overlay */}
                <div className={`absolute inset-0 bg-black bg-opacity-0 transition-all duration-200 ${
                  !selectionLocked ? 'group-hover:bg-opacity-20' : ''
                }`}>
                  <div className="absolute top-2 right-2 space-y-2">
                    {/* View button */}
                    <button
                      onClick={() => setLightboxPhotoIndex(index)}
                      className={`w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center hover:bg-opacity-100 transition-all duration-200 ${
                        selectionLocked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <Eye className="w-4 h-4 text-gray-700" />
                    </button>

                    {/* Selection button - only show if not locked */}
                    {!selectionLocked && (
                      <button
                        onClick={() => togglePhotoSelection(photo.id)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                          isSelected
                            ? 'bg-green-500 text-white opacity-100'
                            : 'bg-white bg-opacity-90 text-gray-700 opacity-0 group-hover:opacity-100 hover:bg-opacity-100'
                        }`}
                      >
                        {isSelected ? '✓' : '+'}
                      </button>
                    )}
                  </div>

                  {/* Price tag */}
                  {selectedPhotos.size > pricingConfig.packagePhotos && !selectionLocked && (
                    <div className="absolute bottom-2 left-2">
                      <span className="bg-white bg-opacity-90 px-2 py-1 rounded text-xs font-semibold text-gray-800 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        R$ {pricingConfig.photoPrice.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Selection indicator - removido para evitar redundância */}
                {isSelected && (
                  <div className="absolute inset-0 border-4 border-green-500 rounded-lg pointer-events-none">
                    <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                      {Array.from(selectedPhotos).indexOf(photo.id) + 1}
                    </div>
                  </div>
                )}
                
                {/* Lock indicator for selected photos when locked */}
                {selectionLocked && isSelected && (
                  <div className="absolute bottom-2 right-2">
                    <div className="bg-gray-800 bg-opacity-75 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Selecionada
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
                  className="max-w-full max-h-[80vh] object-contain rounded-lg mx-auto"
                  onError={(e) => {
                    e.currentTarget.src = `https://picsum.photos/1200/800?random=${photos[lightboxPhotoIndex].id.slice(-6)}`;
                  }}
                />
                
                {/* Watermark overlay */}
                {watermarkConfig && watermarkConfig.watermarkFile && (
                  <img
                    src={watermarkConfig.watermarkFile}
                    alt="Watermark"
                    style={getWatermarkStyle()}
                  />
                )}
                {/* Fallback watermark para lightbox se não houver marca d'água */}
                {!watermarkConfig?.watermarkFile && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{
                      background: 'repeating-linear-gradient(45deg, transparent, transparent 50px, rgba(255,255,255,0.1) 50px, rgba(255,255,255,0.1) 100px)',
                    }}
                  >
                    <div className="text-white text-opacity-40 text-2xl font-bold transform rotate-45">
                      PREVIEW
                    </div>
                  </div>
                )}
              </div>

              {/* Photo info */}
              <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 rounded-lg p-4">
                <div className="flex justify-between items-center text-white">
                  <div>
                    <p className="font-semibold">{photos[lightboxPhotoIndex].filename}</p>
                    <p className="text-sm text-gray-300">
                      {lightboxPhotoIndex + 1} de {photos.length}
                      {selectedPhotos.size > pricingConfig.packagePhotos && (
                        <span> • R$ {pricingConfig.photoPrice.toFixed(2)}</span>
                      )}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => togglePhotoSelection(photos[lightboxPhotoIndex].id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectionLocked
                        ? 'bg-gray-500 text-white cursor-not-allowed'
                        : selectedPhotos.has(photos[lightboxPhotoIndex].id)
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-white text-gray-900 hover:bg-gray-100'
                    }`}
                    disabled={selectionLocked}
                  >
                    {selectionLocked 
                      ? 'Seleção Finalizada'
                      : selectedPhotos.has(photos[lightboxPhotoIndex].id) 
                      ? 'Selecionada' 
                      : 'Selecionar'
                    }
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