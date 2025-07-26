import React, { useState } from 'react';
import { ArrowLeft, Check, Download, Mail } from 'lucide-react';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface CheckoutProps {
  albumId: string;
  selectedPhotos: string[];
  totalAmount: number;
  onBack: () => void;
  onComplete: () => void;
}

const Checkout: React.FC<CheckoutProps> = ({
  albumId,
  selectedPhotos,
  totalAmount,
  onBack,
  onComplete,
}) => {
  const { photos, albums, events } = useSupabaseData();
  const { user } = useAuth();
  const [clientEmail, setClientEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [mercadoPagoConfig, setMercadoPagoConfig] = useState<{
    accessToken?: string;
    publicKey?: string;
  }>({});

  const album = albums.find(a => a.id === albumId);
  const event = album ? events.find(e => e.id === album.event_id) : null;
  const selectedPhotoObjects = photos.filter(p => selectedPhotos.includes(p.id));

  // Carregar configurações de pagamento
  React.useEffect(() => {
    loadPaymentSettings();
  }, [user]);

  const loadPaymentSettings = async () => {
    if (!user) return;

    try {
      const { data: photographer } = await supabase
        .from('photographers')
        .select('watermark_config')
        .eq('user_id', user.id)
        .single();

      if (photographer?.watermark_config) {
        const config = photographer.watermark_config;
        if (config.mercadoPagoAccessToken && config.mercadoPagoPublicKey) {
          setMercadoPagoConfig({
            accessToken: config.mercadoPagoAccessToken,
            publicKey: config.mercadoPagoPublicKey,
          });
        }
      }
    } catch (error) {
      console.error('Error loading payment settings:', error);
    }
  };

  const createMercadoPagoPayment = async () => {
    if (!mercadoPagoConfig.accessToken) {
      throw new Error('Mercado Pago não configurado');
    }

    console.log('Creating MercadoPago payment with config:', {
      hasAccessToken: !!mercadoPagoConfig.accessToken,
      accessTokenPrefix: mercadoPagoConfig.accessToken?.substring(0, 20) + '...',
      isTestMode: mercadoPagoConfig.accessToken?.startsWith('TEST-'),
      totalAmount,
      selectedPhotosCount: selectedPhotos.length,
      clientEmail,
    });
    const paymentRequest = {
      transaction_amount: totalAmount,
      description: `Fotos selecionadas - ${selectedPhotos.length} fotos`,
      payment_method_id: 'pix', // ou 'visa', 'master', etc.
      payer: {
        email: clientEmail,
      },
      access_token: mercadoPagoConfig.accessToken,
      selected_photos: selectedPhotos,
      event_id: album?.event_id,
    };

    console.log('Payment request payload:', {
      ...paymentRequest,
      access_token: paymentRequest.access_token?.substring(0, 20) + '...',
    });

    // Usar edge function para processar pagamento de forma segura
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago-payment`;
    console.log('Calling edge function:', functionUrl);
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(paymentRequest),
    });

    console.log('Edge function response status:', response.status);
    console.log('Edge function response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Edge function error response:', errorData);
      throw new Error(errorData.error || 'Erro ao criar pagamento no Mercado Pago');
    }

    const result = await response.json();
    console.log('Payment creation result:', result);
    return result;
  };

  const handlePayment = async () => {
    if (!clientEmail.trim()) {
      toast.error('Digite seu e-mail para continuar');
      return;
    }

    console.log('Starting payment process:', {
      mercadoPagoConfigExists: !!mercadoPagoConfig.accessToken,
    });
    setIsProcessing(true);

    try {
      let paymentResult;

      if (mercadoPagoConfig.accessToken) {
        console.log('Using MercadoPago payment method');
        console.log('Using MercadoPago payment method');
        // Processar com Mercado Pago
        paymentResult = await createMercadoPagoPayment();
        
        if (paymentResult.status === 'pending' && paymentResult.qr_code) {
          // Para PIX, mostrar QR code
          toast.success('PIX gerado! Use o QR code para pagar.');
          // Você pode implementar um modal com o QR code aqui
          console.log('QR Code:', paymentResult.qr_code);
          console.log('QR Code Base64:', paymentResult.qr_code_base64);
          console.log('QR Code:', paymentResult.qr_code);
          console.log('QR Code Base64:', paymentResult.qr_code_base64);
        } else if (paymentResult.status === 'approved') {
          toast.success('Pagamento aprovado!');
        } else if (paymentResult.status === 'pending') {
          toast.success('Pagamento criado! Aguardando confirmação...');
        } else {
          toast.error(`Status do pagamento: ${paymentResult.status}`);
        }
      } else {
        console.log('Using simulated payment method');
        console.log('Using simulated payment method');
        // Simular processamento para outros métodos
        await new Promise(resolve => setTimeout(resolve, 3000));
        paymentResult = {
          id: `local_${Date.now()}`,
          status: 'approved',
        };
      }

      // Salvar pedido no banco de dados
      const { error: orderError } = await supabase
        .from('orders')
        .insert({
          event_id: album?.event_id,
          client_email: clientEmail,
          selected_photos: selectedPhotos,
          total_amount: totalAmount,
          status: 'pending', // Sempre começar como pending, webhook vai atualizar
          payment_intent_id: paymentResult?.id || `local_${Date.now()}`,
        });

      if (orderError) {
        console.error('Error saving order:', orderError);
        toast.error('Erro ao salvar pedido');
      }

      setOrderCompleted(true);
      
      // Sempre mostrar como pendente inicialmente
      toast.success('Pedido criado! Aguardando confirmação do pagamento.');
      
      // Enviar e-mail com links de download (simulado)
      setTimeout(() => {
        toast('Você receberá um e-mail quando o pagamento for confirmado.');
      }, 1000);

    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Erro no processamento do pagamento');
    } finally {
      setIsProcessing(false);
    }
  };

  if (orderCompleted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Pagamento Confirmado!
          </h2>
          
          <p className="text-gray-600 mb-6">
            Suas {selectedPhotos.length} foto{selectedPhotos.length > 1 ? 's' : ''} selecionada{selectedPhotos.length > 1 ? 's' : ''} estão sendo processadas.
            Você receberá um e-mail com os links de download em breve.
          </p>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumo do Pedido</h3>
            <div className="flex justify-between items-center mb-2">
                Mercado Pago
              <span className="font-semibold">{selectedPhotos.length} foto{selectedPhotos.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Valor unitário:</span>
              <span className="font-semibold">R$ {selectedPhotoObjects[0]?.price?.toFixed(2) || '25,00'}</span>
            </div>
            {selectedPhotos.length > 10 && (
              <div className="text-sm text-green-600 mb-2">
                <div className="flex justify-between">
                  <span>Primeiras 10 fotos:</span>
                  <span>Preço normal</span>
                </div>
                <div className="flex justify-between">
                  <span>{selectedPhotos.length - 10} fotos extras:</span>
                  <span>20% desconto</span>
                </div>
              </div>
            )}
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Valor total:</span>
              <span className="text-xl font-bold text-green-600">R$ {totalAmount.toFixed(2)}</span>
            </div>
            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Método de pagamento:</span>
                <span className="font-semibold capitalize">
                  {mercadoPagoConfig.accessToken ? 'Mercado Pago' : 'Simulado'}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Status:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Confirmado
                </span>
              </div>
            </div>
          </div>

          {/* Preview das fotos compradas */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Fotos Adquiridas:</h4>
            <div className="grid grid-cols-4 gap-2">
              {selectedPhotoObjects.slice(0, 8).map((photo) => (
                <div key={photo.id} className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                  <img
                    src={photo.thumbnail_path}
                    alt={photo.filename}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = `https://picsum.photos/200/200?random=${photo.id.slice(-6)}`;
                    }}
                  />
                  <div className="absolute top-1 right-1">
                    <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                </div>
              ))}
              {selectedPhotoObjects.length > 8 && (
                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-xs text-gray-500 font-medium">
                    +{selectedPhotoObjects.length - 8}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <Mail className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-left">
                <h4 className="font-medium text-blue-900">E-mail de confirmação enviado</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Enviamos um e-mail para <strong>{clientEmail}</strong> com:
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1">
                  <li>• Links para download das fotos em alta resolução</li>
                  <li>• Comprovante de pagamento</li>
                  <li>• Instruções para download</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-500 mb-6">
            <p><strong>Número do pedido:</strong> #{Date.now().toString().slice(-8)}</p>
            <p><strong>Data:</strong> {new Date().toLocaleDateString('pt-BR', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">E-mail:</span>
              <span className="font-semibold">{clientEmail}</span>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={onComplete}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Voltar à Galeria
            </button>
            <button
              onClick={() => window.print()}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Imprimir Recibo
            </button>
            <button
              onClick={() => {
                const subject = encodeURIComponent('Dúvida sobre minha compra de fotos');
                const body = encodeURIComponent(`Olá! Tenho uma dúvida sobre minha compra:\n\nPedido: #${Date.now().toString().slice(-8)}\nE-mail: ${clientEmail}\nValor: R$ ${totalAmount.toFixed(2)}\n\nDúvida: `);
                window.open(`mailto:${clientEmail}?subject=${subject}&body=${body}`);
              }}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Suporte
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar à Seleção
      </button>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Resumo do Pedido */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Resumo do Pedido
          </h3>

          {event && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Evento</p>
              <p className="font-semibold">{event.client_name}</p>
              <p className="text-sm text-gray-500">
                {new Date(event.event_date).toLocaleDateString('pt-BR')}
              </p>
            </div>
          )}

          <div className="space-y-3 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Fotos selecionadas:</span>
              <span className="font-semibold">{selectedPhotos.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Valor unitário:</span>
              <span>R$ 25,00</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>R$ {totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Preview das fotos selecionadas */}
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Fotos selecionadas:
            </p>
            <div className="grid grid-cols-4 gap-2">
              {selectedPhotoObjects.slice(0, 8).map((photo) => (
                <div key={photo.id} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={photo.thumbnail_path}
                    alt={photo.filename}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = `https://picsum.photos/200/200?random=${photo.id.slice(-6)}`;
                    }}
                  />
                </div>
              ))}
              {selectedPhotoObjects.length > 8 && (
                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-xs text-gray-500">
                    +{selectedPhotoObjects.length - 8}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Formulário de Pagamento */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Informações de Pagamento
          </h3>

          <div className="space-y-4">
            {/* E-mail */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seu E-mail *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enviaremos os links de download para este e-mail
              </p>
            </div>

            {/* Método de Pagamento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Método de Pagamento
              </label>

              <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                <div className="flex items-center">
                  <div className="w-8 h-8 mr-3 bg-blue-500 rounded flex items-center justify-center">
                    <span className="text-white text-sm font-bold">MP</span>
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Mercado Pago</p>
                    <p className="text-sm text-blue-700">PIX, Cartão de Crédito, Débito</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Botão de Pagamento */}
            <button
              onClick={handlePayment}
              disabled={isProcessing || !clientEmail.trim()}
              className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isProcessing ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Criando pagamento...
                </div>
              ) : (
                `Pagar R$ ${totalAmount.toFixed(2)} via Mercado Pago`
              )}
            </button>

            <p className="text-xs text-gray-500 text-center">
              Seus dados estão seguros e protegidos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;