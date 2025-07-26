import React, { useState, useEffect } from 'react';
import { ArrowLeft, CreditCard, Smartphone, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface SchedulingPaymentProps {
  eventData: any;
  onComplete: () => void;
  onCancel: () => void;
}

const sessionTypeLabels: Record<string, string> = {
  'gestante': 'Sessão Gestante',
  'aniversario': 'Aniversário',
  'comerciais': 'Comerciais',
  'pre-wedding': 'Pré Wedding',
  'formatura': 'Formatura',
  'revelacao-sexo': 'Revelação de Sexo',
};

const SchedulingPayment: React.FC<SchedulingPaymentProps> = ({
  eventData,
  onComplete,
  onCancel,
}) => {
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState({
    minimumPackagePrice: 300.00,
    advancePaymentPercentage: 50,
    paymentMethods: {
      pix: true,
      creditCard: true,
      mercadoPago: false,
    },
    mercadoPagoAccessToken: '',
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      const { data: photographer } = await supabase
        .from('photographers')
        .select('watermark_config')
        .eq('user_id', user.id)
        .single();

      if (photographer?.watermark_config) {
        const config = photographer.watermark_config;
        setSettings(prev => ({
          ...prev,
          minimumPackagePrice: config.minimumPackagePrice || 300.00,
          advancePaymentPercentage: config.advancePaymentPercentage || 50,
          paymentMethods: config.paymentMethods || prev.paymentMethods,
          mercadoPagoAccessToken: config.mercadoPagoAccessToken || '',
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const advanceAmount = (settings.minimumPackagePrice * settings.advancePaymentPercentage) / 100;
  const sessionTypeLabel = eventData?.session_type ? 
    sessionTypeLabels[eventData.session_type] || eventData.session_type : 
    'Sessão';

  const createMercadoPagoPayment = async () => {
    if (!settings.mercadoPagoAccessToken) {
      throw new Error('Mercado Pago não configurado');
    }

    const paymentRequest = {
      transaction_amount: advanceAmount,
      description: `Pagamento antecipado - ${sessionTypeLabel} - ${eventData.client_name}`,
      payment_method_id: 'pix',
      payer: {
        email: eventData.client_email,
      },
      access_token: settings.mercadoPagoAccessToken,
      selected_photos: [],
      event_id: null,
    };

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(paymentRequest),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao criar pagamento no Mercado Pago');
    }

    return await response.json();
  };

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      let paymentResult;

      if (settings.paymentMethods.mercadoPago && settings.mercadoPagoAccessToken) {
        paymentResult = await createMercadoPagoPayment();
        
        if (paymentResult.status === 'pending' && paymentResult.qr_code) {
          toast.success('PIX gerado! Use o QR code para pagar.');
          console.log('QR Code:', paymentResult.qr_code);
        } else if (paymentResult.status === 'approved') {
          toast.success('Pagamento aprovado!');
        } else if (paymentResult.status === 'pending') {
          toast.success('Pagamento criado! Aguardando confirmação...');
        }
      } else {
        // Simular processamento para outros métodos
        await new Promise(resolve => setTimeout(resolve, 3000));
        paymentResult = {
          id: `advance_${Date.now()}`,
          status: 'approved',
        };
        toast.success('Pagamento processado com sucesso!');
      }

      // Salvar registro do pagamento antecipado
      await supabase
        .from('orders')
        .insert({
          event_id: null, // Será preenchido após criar o evento
          client_email: eventData.client_email,
          selected_photos: [],
          total_amount: advanceAmount,
          status: 'paid',
          payment_intent_id: paymentResult?.id || `advance_${Date.now()}`,
        });

      // Confirmar agendamento
      onComplete();

    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Erro no processamento do pagamento');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Pagamento Antecipado</h3>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Resumo do Agendamento */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Resumo do Agendamento</h4>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Cliente:</span>
              <span className="font-medium">{eventData?.client_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tipo de Sessão:</span>
              <span className="font-medium">{sessionTypeLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Data:</span>
              <span className="font-medium">
                {new Date(eventData?.event_date).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">E-mail:</span>
              <span className="font-medium">{eventData?.client_email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Telefone:</span>
              <span className="font-medium">{eventData?.client_phone}</span>
            </div>
          </div>

          <div className="border-t mt-4 pt-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Pacote mínimo (10 fotos):</span>
                <span>R$ {settings.minimumPackagePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pagamento antecipado ({settings.advancePaymentPercentage}%):</span>
                <span className="text-lg font-bold text-green-600">
                  R$ {advanceAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-800">
              <strong>Importante:</strong> Este pagamento garante seu agendamento. 
              Após a sessão, você receberá um link para selecionar suas 10 fotos incluídas no pacote.
            </p>
          </div>
        </div>

        {/* Formulário de Pagamento */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-4">Método de Pagamento</h4>
          
          <div className="space-y-4">
            {settings.paymentMethods.pix && (
              <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="payment"
                  value="pix"
                  checked={paymentMethod === 'pix'}
                  onChange={(e) => setPaymentMethod(e.target.value as 'pix')}
                  className="mr-3"
                />
                <Smartphone className="w-5 h-5 mr-2 text-green-600" />
                <div>
                  <p className="font-medium">PIX</p>
                  <p className="text-sm text-gray-500">Pagamento instantâneo</p>
                </div>
              </label>
            )}
            
            {settings.paymentMethods.creditCard && (
              <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="payment"
                  value="card"
                  checked={paymentMethod === 'card'}
                  onChange={(e) => setPaymentMethod(e.target.value as 'card')}
                  className="mr-3"
                />
                <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
                <div>
                  <p className="font-medium">Cartão de Crédito</p>
                  <p className="text-sm text-gray-500">Visa, Mastercard, Elo</p>
                </div>
              </label>
            )}

            {settings.paymentMethods.mercadoPago && (
              <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="payment"
                  value="card"
                  checked={paymentMethod === 'card'}
                  onChange={(e) => setPaymentMethod(e.target.value as 'card')}
                  className="mr-3"
                />
                <div className="w-5 h-5 mr-2 bg-blue-500 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">MP</span>
                </div>
                <div>
                  <p className="font-medium">Mercado Pago</p>
                  <p className="text-sm text-gray-500">PIX, Cartão, Boleto</p>
                </div>
              </label>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={handlePayment}
              disabled={isProcessing}
              className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isProcessing ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Processando Pagamento...
                </div>
              ) : (
                `Pagar R$ ${advanceAmount.toFixed(2)} via ${paymentMethod.toUpperCase()}`
              )}
            </button>

            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            Seus dados estão seguros e protegidos
          </p>
        </div>
      </div>
    </div>
  );
};

export default SchedulingPayment;