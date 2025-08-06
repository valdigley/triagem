import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, Clock, User, Mail, Phone, Camera, Check, X, Copy, RefreshCw, Building, MapPin, Globe, Instagram } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { loadMercadoPago } from '@mercadopago/sdk-js';

const eventSchema = z.object({
  clientName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  clientEmail: z.string().email('E-mail inválido'),
  clientPhone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  sessionType: z.string().min(1, 'Tipo de sessão é obrigatório'),
  eventDate: z.string().min(1, 'Data é obrigatória').refine((date) => {
    const selectedDate = new Date(date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate >= today;
  }, 'A data não pode ser anterior a hoje'),
  eventTime: z.string().min(1, 'Horário é obrigatório'),
  notes: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

const sessionTypeLabels: Record<string, string> = {
  'gestante': 'Sessão Gestante',
  'aniversario': 'Aniversário',
  'comerciais': 'Comerciais',
  'pre-wedding': 'Pré Wedding',
  'formatura': 'Formatura',
  'revelacao-sexo': 'Revelação de Sexo',
};

const PublicScheduling: React.FC = () => {
  const [studioSettings, setStudioSettings] = useState({
    businessName: 'Estúdio Fotográfico',
    email: '',
    phone: '',
    address: '',
    website: '',
    instagram: '',
    logo: '',
    minimumPackagePrice: 300.00,
    advancePaymentPercentage: 50,
    mercadoPagoAccessToken: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [isWaitingPayment, setIsWaitingPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [pendingEventData, setPendingEventData] = useState<any>(null);
  const [photographerId, setPhotographerId] = useState<string | null>(null);
  const [sessionTypes, setSessionTypes] = useState<Array<{ value: string; label: string }>>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [mpInstance, setMpInstance] = useState<any>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
  });

  useEffect(() => {
    loadStudioSettings();
    generateDeviceId();
    
    // Debug: Log para verificar se o componente está carregando
    console.log('PublicScheduling component mounted');
    console.log('Current URL:', window.location.href);
  }, []);

  const generateDeviceId = () => {
    // Gerar device ID único baseado no navegador e timestamp
    const deviceFingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      Date.now()
    ].join('|');
    
    const deviceId = btoa(deviceFingerprint).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    setDeviceId(deviceId);
    console.log('Generated device ID for scheduling:', deviceId);
  };

  const initializeMercadoPago = async (publicKey: string) => {
    try {
      const mp = await loadMercadoPago({
        key: publicKey,
        locale: 'pt-BR'
      });
      setMpInstance(mp);
      console.log('MercadoPago SDK initialized for scheduling');
    } catch (error) {
      console.error('Error initializing MercadoPago SDK:', error);
    }
  };

  const loadStudioSettings = async () => {
    try {
      // Carregar configurações do primeiro fotógrafo (assumindo um estúdio)
      const { data: photographer, error } = await supabase
        .from('photographers')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (photographer) {
        setPhotographerId(photographer.id);
        setStudioSettings(prev => ({
          ...prev,
          businessName: photographer.business_name || 'Estúdio Fotográfico',
          phone: photographer.phone || '',
          logo: photographer.watermark_config?.logo || '',
          minimumPackagePrice: photographer.watermark_config?.minimumPackagePrice || 300.00,
          advancePaymentPercentage: photographer.watermark_config?.advancePaymentPercentage || 50,
          mercadoPagoAccessToken: photographer.watermark_config?.mercadoPagoAccessToken || '',
          mercadoPagoPublicKey: photographer.watermark_config?.mercadoPagoPublicKey || '',
          email: photographer.watermark_config?.email || '',
          address: photographer.watermark_config?.address || '',
          website: photographer.watermark_config?.website || '',
          instagram: photographer.watermark_config?.instagram || '',
        }));
        
        // Carregar tipos de sessão das configurações
        const configuredSessionTypes = photographer.watermark_config?.sessionTypes || [
          { value: 'gestante', label: 'Sessão Gestante' },
          { value: 'aniversario', label: 'Aniversário' },
          { value: 'comerciais', label: 'Comerciais' },
          { value: 'pre-wedding', label: 'Pré Wedding' },
          { value: 'formatura', label: 'Formatura' },
          { value: 'revelacao-sexo', label: 'Revelação de Sexo' },
        ];
        setSessionTypes(configuredSessionTypes);
        
        // Inicializar MercadoPago SDK se configurado
        if (photographer.watermark_config?.mercadoPagoPublicKey) {
          await initializeMercadoPago(photographer.watermark_config.mercadoPagoPublicKey);
        }
      }
    } catch (error) {
      console.error('Error loading studio settings:', error);
    }
  };

  const advanceAmount = (studioSettings.minimumPackagePrice * studioSettings.advancePaymentPercentage) / 100;

  // Função para enviar email de confirmação
  const sendBookingConfirmationEmail = async (eventData: any, studioSettings: any) => {
    try {
      // Carregar template personalizado das configurações
      const { data: photographer } = await supabase
        .from('photographers')
        .select('watermark_config')
        .eq('id', photographerId)
        .single();

      const emailTemplates = photographer?.watermark_config?.emailTemplates;
      
      // Verificar se o email de confirmação está habilitado
      if (!emailTemplates?.bookingConfirmation?.enabled) {
        console.log('Booking confirmation email is disabled');
        return;
      }

      const sessionTypeLabel = eventData.session_type ? 
        sessionTypeLabels[eventData.session_type] || eventData.session_type : 
        'Sessão';

      // Usar template personalizado
      let subject = emailTemplates.bookingConfirmation.subject;
      let message = emailTemplates.bookingConfirmation.message;

      // Substituir variáveis no assunto
      subject = subject
        .replace(/\[\[clientName\]\]/g, eventData.client_name)
        .replace(/\[\[sessionType\]\]/g, sessionTypeLabel)
        .replace(/\[\[studioName\]\]/g, studioSettings.businessName)
        .replace(/\[\[eventDate\]\]/g, new Date(eventData.event_date).toLocaleDateString('pt-BR'))
        .replace(/\[\[eventTime\]\]/g, new Date(eventData.event_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
        .replace(/\[\[studioAddress\]\]/g, studioSettings.address || '')
        .replace(/\[\[studioPhone\]\]/g, studioSettings.phone || '')
        .replace(/\[\[studioEmail\]\]/g, studioSettings.email || '')
        .replace(/\[\[studioWebsite\]\]/g, studioSettings.website || '');

      // Substituir variáveis na mensagem
      message = message
        .replace(/\[\[clientName\]\]/g, eventData.client_name)
        .replace(/\[\[sessionType\]\]/g, sessionTypeLabel)
        .replace(/\[\[studioName\]\]/g, studioSettings.businessName)
        .replace(/\[\[eventDate\]\]/g, new Date(eventData.event_date).toLocaleDateString('pt-BR', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }))
        .replace(/\[\[eventTime\]\]/g, new Date(eventData.event_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
        .replace(/\[\[studioAddress\]\]/g, studioSettings.address || '')
        .replace(/\[\[studioPhone\]\]/g, studioSettings.phone || '')
        .replace(/\[\[studioEmail\]\]/g, studioSettings.email || '')
        .replace(/\[\[studioWebsite\]\]/g, studioSettings.website || '');

      // Converter quebras de linha para HTML
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">📸 Agendamento Confirmado!</h1>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa;">
            <div style="white-space: pre-line; color: #333; line-height: 1.6;">
              ${message}
            </div>
          </div>
          
          <div style="background: #333; padding: 20px; text-align: center;">
            <p style="color: #ccc; margin: 0; font-size: 14px;">
              ${studioSettings.businessName} - Capturando seus melhores momentos
            </p>
          </div>
        </div>
      `;
      
      console.log('Sending booking confirmation email to:', eventData.client_email);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          to: eventData.client_email,
          subject: subject,
          html: emailHtml,
          type: 'booking_confirmation',
          eventData,
          studioData: studioSettings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to send booking confirmation email:', errorData);
        throw new Error(`Email send failed: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Booking confirmation email sent successfully:', result);
      
    } catch (error) {
      console.error('Error sending booking confirmation email:', error);
      // Não falhar o processo de agendamento se o email falhar
      console.log('Continuing with booking process despite email error');
    }
  };

  // Função para criar evento após confirmação do pagamento
  const createEventAfterPayment = async (paymentData: any) => {
    if (!pendingEventData || !photographerId) {
      console.error('Missing event data or photographer ID');
      return;
    }

    try {
      console.log('Creating event after payment confirmation...');
      

      // Criar o evento
      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert({
          ...pendingEventData,
          photographer_id: photographerId,
        })
        .select()
        .single();

      if (eventError || !newEvent) {
        console.error('Error creating event:', eventError);
        throw new Error('Erro ao criar evento no banco de dados');
      }

      console.log('Event created successfully:', newEvent.id);

      // Criar álbum automaticamente para o evento
      const sessionTypeLabel = newEvent.session_type ? 
        sessionTypeLabels[newEvent.session_type] || newEvent.session_type : 
        'Sessão';
      const albumName = `${sessionTypeLabel} - ${newEvent.client_name}`;

      console.log('Creating album for event:', albumName);
      
      const { data: newAlbum, error: albumError } = await supabase
        .from('albums')
        .insert({
          event_id: newEvent.id,
          name: albumName,
        })
        .select()
        .single();

      if (albumError) {
        console.error('Error creating album:', albumError);
        // Não falhar o processo se o álbum não for criado
      } else {
        console.log('Album created successfully:', newAlbum.id);
        
        // Atualizar o evento com o album_id
        await supabase
          .from('events')
          .update({ album_id: newAlbum.id })
          .eq('id', newEvent.id);
      }

      // Criar o pedido
      const { error: orderError } = await supabase
        .from('orders')
        .upsert({
          event_id: newEvent.id,
          client_email: pendingEventData.client_email,
          selected_photos: [],
          total_amount: advanceAmount,
          status: 'paid',
          payment_intent_id: paymentData.id.toString(),
          metadata: {
            payment_type: 'advance_booking',
            session_type: pendingEventData.session_type,
            advance_percentage: studioSettings.advancePaymentPercentage,
            description: `Pagamento antecipado de ${sessionTypeLabel}`
          }
        }, {
          onConflict: 'payment_intent_id',
          ignoreDuplicates: false
        });

      if (orderError) {
        console.error('Error creating order:', orderError);
      } else {
        console.log('Order created successfully');
      }

      return newEvent;
    } catch (error) {
      console.error('Error creating event after payment:', error);
      throw error;
    }
  };

  // Função para verificar status do pagamento
  const checkPaymentStatus = async (paymentId: string) => {
    console.log('Checking payment status for:', paymentId);
    
    try {
      // Primeiro verificar se o pagamento foi aprovado no Mercado Pago
      if (studioSettings.mercadoPagoAccessToken) {
        console.log('Checking payment status directly from MercadoPago...');
        
        const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: {
            'Authorization': `Bearer ${studioSettings.mercadoPagoAccessToken}`,
            'Content-Type': 'application/json',
          }
        });

        if (mpResponse.ok) {
          const paymentData = await mpResponse.json();
          console.log('MercadoPago payment status:', paymentData.status);
          
          if (paymentData.status === 'approved') {
            // Pagamento aprovado, criar o evento agora
            console.log('Payment approved, creating event...');
            await createEventAfterPayment(paymentData);
            return 'approved';
          } else if (paymentData.status === 'rejected' || paymentData.status === 'cancelled') {
            return 'rejected';
          }
        }
      }

      // Fallback: verificar no banco de dados
      const { data: orders } = await supabase
        .from('orders')
        .select('status')
        .eq('payment_intent_id', paymentId)
        .order('created_at', { ascending: false })
        .limit(1);

      console.log('Orders found:', orders);

      if (orders && orders.length > 0) {
        const order = orders[0];
        console.log('Order status:', order.status);
        if (order.status === 'paid') {
          setPaymentStatus('approved');
          return 'approved';
        } else if (order.status === 'cancelled') {
          setPaymentStatus('rejected');
          return 'rejected';
        }
      }
      
      return 'pending';
    } catch (error) {
      console.error('Error checking payment status:', error);
      return 'pending';
    }
  };

  // Polling para verificar status do pagamento
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isWaitingPayment && paymentData?.id) {
      console.log('Starting payment polling for:', paymentData.id);
      
      interval = setInterval(async () => {
        const status = await checkPaymentStatus(paymentData.id);
        console.log('Polling result:', status);
        
        if (status === 'approved') {
          setIsWaitingPayment(false);
          setPaymentStatus('approved');
          
          // Enviar email de confirmação quando pagamento for aprovado
          if (pendingEventData) {
            await sendBookingConfirmationEmail(pendingEventData, studioSettings);
          }
          
          toast.success('Pagamento confirmado!');
          toast.success('Agendamento confirmado com sucesso!');
        } else if (status === 'rejected') {
          setIsWaitingPayment(false);
          setPaymentStatus('rejected');
          toast.error('Pagamento rejeitado. Tente novamente.');
        }
      }, 5000); // Aumentar intervalo para 5 segundos
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isWaitingPayment, paymentData?.id]);

  const createMercadoPagoPayment = async (eventData: any) => {
    if (!studioSettings.mercadoPagoAccessToken) {
      throw new Error('Sistema de pagamento não configurado');
    }

    const sessionTypeLabel = eventData.session_type ? 
      sessionTypeLabels[eventData.session_type] || eventData.session_type : 
      'Sessão';

    // Separar nome e sobrenome
    const nameParts = eventData.client_name?.split(' ') || ['Cliente'];
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || 'Silva';

    // Criar itens detalhados conforme exigências do MP
    const items = [
      {
        id: `session_${eventData.session_type || 'photo'}`, // Código único
        title: `${sessionTypeLabel} - Pagamento Antecipado`, // Nome do item
        description: `Reserva de sessão de fotos profissional com direito a 10 fotos editadas em alta resolução`, // Descrição detalhada
        category_id: 'photography_services', // Categoria específica
        quantity: 1, // Quantidade
        unit_price: advanceAmount, // Preço unitário
        currency_id: 'BRL' // Moeda
      }
    ];

    console.log('Creating payment for event data:', eventData);

    const paymentRequest = {
      transaction_amount: advanceAmount,
      description: `Agendamento de ${sessionTypeLabel} - Pagamento antecipado para reserva de sessão`,
      payment_method_id: 'pix',
      statement_descriptor: 'TRIAGEM AGEND', // Descrição na fatura do cartão
      device_id: deviceId, // ID do dispositivo
      payer: {
        email: eventData.client_email,
        first_name: firstName,
        last_name: lastName,
        phone: {
          area_code: eventData.client_phone?.replace(/\D/g, '').substring(0, 2) || '11',
          number: eventData.client_phone?.replace(/\D/g, '').substring(2) || '999999999'
        },
        identification: {
          type: 'CPF',
          number: '00000000000' // Placeholder - será coletado no futuro
        }
      },
      items: items, // Itens detalhados conforme exigência
      marketplace: 'NONE', // Não é marketplace
      binary_mode: false, // Permitir status pending
      capture: true, // Capturar automaticamente
      additional_info: {
        items: items,
        payer: {
          first_name: firstName,
          last_name: lastName,
          phone: {
            area_code: eventData.client_phone?.replace(/\D/g, '').substring(0, 2) || '11',
            number: eventData.client_phone?.replace(/\D/g, '').substring(2) || '999999999'
          },
          address: {
            zip_code: '01310-100', // Placeholder
            street_name: 'Av. Paulista',
            street_number: 1000
          }
        },
        shipments: {
          receiver_address: {
            zip_code: '01310-100',
            street_name: 'Entrega Digital - Download Online',
            street_number: 0,
            floor: '',
            apartment: ''
          }
        }
      },
      notification_url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago-webhook`,
      external_reference: `booking_${Date.now()}_${eventData.session_type}`,
      access_token: studioSettings.mercadoPagoAccessToken,
      selected_photos: [],
      event_id: null, // Será criado após confirmação do pagamento
      client_email: eventData.client_email,
      items: [
        {
          id: `session_${eventData.session_type || 'photo'}`,
          title: `${sessionTypeLabel} - Pagamento Antecipado`,
          description: `Reserva de sessão de fotos com direito a 10 fotos editadas`,
          category_id: 'photography',
          quantity: 1,
          unit_price: advanceAmount
        }
      ]
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
      console.error('Payment creation failed:', errorData);
      throw new Error(errorData.error || 'Erro ao processar pagamento');
    }

    const paymentResult = await response.json();
    console.log('Payment created:', paymentResult);

    return paymentResult;
  };

  const onSubmit = async (data: EventFormData) => {
    setIsSubmitting(true);
    
    try {
      const eventDateTime = new Date(`${data.eventDate}T${data.eventTime}`);
      
      const eventData = {
        client_name: data.clientName,
        client_email: data.clientEmail,
        client_phone: data.clientPhone,
        session_type: data.sessionType,
        event_date: eventDateTime.toISOString(),
        location: studioSettings.address || 'Estúdio Fotográfico',
        notes: data.notes,
        status: 'scheduled',
      };

      setPendingEventData(eventData);

      if (studioSettings.mercadoPagoAccessToken) {
        const paymentResult = await createMercadoPagoPayment(eventData);
        setPaymentData(paymentResult);
        
        if (paymentResult.status === 'pending' && paymentResult.qr_code) {
          setShowPayment(true);
          setIsWaitingPayment(true);
          toast.success('PIX gerado! Escaneie o código para confirmar seu agendamento.');
        }
      } else {
        toast.error('Sistema de pagamento não configurado. Entre em contato conosco.');
      }
    } catch (error) {
      console.error('Error processing scheduling:', error);
      toast.error(error.message || 'Erro ao processar agendamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPixCode = () => {
    if (paymentData?.qr_code) {
      navigator.clipboard.writeText(paymentData.qr_code);
      toast.success('Código PIX copiado!');
    }
  };

  const handleNewScheduling = () => {
    setShowPayment(false);
    setPaymentData(null);
    setIsWaitingPayment(false);
    setPaymentStatus(null);
    setPendingEventData(null);
    reset();
  };

  // Se está aguardando pagamento, mostrar tela de PIX
  if (showPayment && paymentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              {studioSettings.logo ? (
                <img 
                  src={studioSettings.logo} 
                  alt={studioSettings.businessName}
                  className="h-16 mx-auto mb-4 object-contain"
                />
              ) : (
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              )}
              <h1 className="text-2xl font-bold text-gray-900">{studioSettings.businessName}</h1>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8">
              {paymentStatus === 'approved' ? (
                // Pagamento aprovado
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Agendamento Confirmado! 🎉
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Seu pagamento foi confirmado e sua sessão está agendada.
                    Você receberá um e-mail com todos os detalhes em breve.
                  </p>
                  
                  <div className="bg-green-50 rounded-lg p-6 mb-6">
                    <h4 className="font-semibold text-green-900 mb-3">Resumo do Agendamento</h4>
                    <div className="text-left space-y-2 text-sm text-green-800">
                      <p><strong>Cliente:</strong> {pendingEventData?.client_name}</p>
                      <p><strong>Sessão:</strong> {pendingEventData?.session_type ? sessionTypeLabels[pendingEventData.session_type] : 'Não definido'}</p>
                      <p><strong>Data:</strong> {pendingEventData?.event_date ? new Date(pendingEventData.event_date).toLocaleDateString('pt-BR') : ''}</p>
                      <p><strong>Valor pago:</strong> R$ {advanceAmount.toFixed(2)}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleNewScheduling}
                    className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Fazer Novo Agendamento
                  </button>
                </div>
              ) : (
                // Aguardando pagamento
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <RefreshCw className={`w-8 h-8 text-blue-600 ${paymentStatus === 'pending' ? 'animate-spin' : ''}`} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Finalize seu Agendamento
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Escaneie o QR Code ou copie o código PIX para confirmar sua sessão
                  </p>

                  {/* QR Code */}
                  {paymentData.qr_code_base64 && (
                    <div className="bg-gray-50 p-6 rounded-lg mb-6">
                      <img 
                        src={`data:image/png;base64,${paymentData.qr_code_base64}`}
                        alt="QR Code PIX"
                        className="mx-auto mb-4 max-w-full h-auto"
                        style={{ maxWidth: '250px' }}
                      />
                      <p className="text-sm text-gray-600">
                        Escaneie com o app do seu banco
                      </p>
                    </div>
                  )}

                  {/* Código PIX para copiar */}
                  {paymentData.qr_code && (
                    <div className="bg-gray-50 p-4 rounded-lg mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ou copie o código PIX:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={paymentData.qr_code}
                          readOnly
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-mono"
                        />
                        <button
                          onClick={copyPixCode}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          Copiar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Informações do pagamento */}
                  <div className="bg-blue-50 p-6 rounded-lg mb-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-900 mb-2">
                        R$ {advanceAmount.toFixed(2)}
                      </p>
                      <p className="text-sm text-blue-700">
                        Pagamento antecipado ({studioSettings.advancePaymentPercentage}% do pacote)
                      </p>
                      <p className="text-xs text-blue-600 mt-2">
                        Inclui direito a selecionar 10 fotos após a sessão
                      </p>
                    </div>
                  </div>

                  <div className="text-center text-sm text-gray-500 mb-6">
                    <p>⏱️ Verificando pagamento automaticamente...</p>
                    <p>Não feche esta página até a confirmação.</p>
                  </div>

                  <button
                    onClick={handleNewScheduling}
                    className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar e Voltar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <Toaster position="top-center" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Toaster position="top-center" />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            {studioSettings.logo ? (
              <img 
                src={studioSettings.logo} 
                alt={studioSettings.businessName}
                className="h-20 mx-auto mb-6 object-contain"
              />
            ) : (
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Camera className="w-10 h-10 text-white" />
              </div>
            )}
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {studioSettings.businessName || 'Carregando...'}
            </h1>
            <p className="text-xl text-gray-600 mb-6">Agende sua sessão de fotos</p>
            
            {/* Informações do estúdio */}
            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600 mb-8">
              {studioSettings.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span>{studioSettings.phone}</span>
                </div>
              )}
              {studioSettings.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>{studioSettings.email}</span>
                </div>
              )}
              {studioSettings.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{studioSettings.address}</span>
                </div>
              )}
              {studioSettings.website && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <a href={studioSettings.website} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                    Website
                  </a>
                </div>
              )}
              {studioSettings.instagram && (
                <div className="flex items-center gap-2">
                  <Instagram className="w-4 h-4" />
                  <a href={`https://instagram.com/${studioSettings.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                    {studioSettings.instagram}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Informações do pacote */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">📸 Nosso Pacote</h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-blue-50 rounded-lg p-6">
                  <div className="text-3xl font-bold text-blue-600 mb-2">10</div>
                  <div className="text-sm text-gray-600">Fotos Incluídas</div>
                </div>
                <div className="bg-green-50 rounded-lg p-6">
                  <div className="text-3xl font-bold text-green-600 mb-2">R$ {studioSettings.minimumPackagePrice.toFixed(0)}</div>
                  <div className="text-sm text-gray-600">Pacote Completo</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-6">
                  <div className="text-3xl font-bold text-purple-600 mb-2">{studioSettings.advancePaymentPercentage}%</div>
                  <div className="text-sm text-gray-600">Pagamento Antecipado</div>
                </div>
              </div>
              <p className="text-gray-600 mt-4">
                Pague apenas <strong>R$ {advanceAmount.toFixed(2)}</strong> para garantir seu agendamento.
                Após a sessão, você escolherá suas 10 fotos favoritas!
              </p>
            </div>
          </div>

          {/* Formulário */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Agende Agora</h2>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Informações do Cliente */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <User className="w-5 h-5 mr-2 text-blue-600" />
                  Suas Informações
                </h3>
                
                <div>
                  <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-2">
                    Nome Completo *
                  </label>
                  <input
                    {...register('clientName')}
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Seu nome completo"
                  />
                  {errors.clientName && (
                    <p className="text-red-600 text-sm mt-1">{errors.clientName.message}</p>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="clientEmail" className="block text-sm font-medium text-gray-700 mb-2">
                      E-mail *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        {...register('clientEmail')}
                        type="email"
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="seu@email.com"
                      />
                    </div>
                    {errors.clientEmail && (
                      <p className="text-red-600 text-sm mt-1">{errors.clientEmail.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="clientPhone" className="block text-sm font-medium text-gray-700 mb-2">
                      Telefone *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        {...register('clientPhone')}
                        type="tel"
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                    {errors.clientPhone && (
                      <p className="text-red-600 text-sm mt-1">{errors.clientPhone.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Tipo de Sessão */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Camera className="w-5 h-5 mr-2 text-blue-600" />
                  Tipo de Sessão
                </h3>
                
                <div>
                  <label htmlFor="sessionType" className="block text-sm font-medium text-gray-700 mb-2">
                    Escolha o tipo de sessão *
                  </label>
                  <select
                    {...register('sessionType')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="">Selecione o tipo de sessão...</option>
                    {sessionTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  {errors.sessionType && (
                    <p className="text-red-600 text-sm mt-1">{errors.sessionType.message}</p>
                  )}
                </div>
              </div>

              {/* Data e Horário */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                  Data e Horário
                </h3>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 mb-2">
                      Data da Sessão *
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        {...register('eventDate')}
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    {errors.eventDate && (
                      <p className="text-red-600 text-sm mt-1">{errors.eventDate.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="eventTime" className="block text-sm font-medium text-gray-700 mb-2">
                      Horário Preferido *
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        {...register('eventTime')}
                        type="time"
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    {errors.eventTime && (
                      <p className="text-red-600 text-sm mt-1">{errors.eventTime.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Observações (Opcional)
                </label>
                <textarea
                  {...register('notes')}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Conte-nos mais sobre o que você tem em mente para sua sessão..."
                />
              </div>

              {/* Resumo do Pagamento */}
              <div className="bg-blue-50 rounded-lg p-6">
                <h4 className="font-semibold text-blue-900 mb-3">💰 Resumo do Pagamento</h4>
                <div className="space-y-2 text-sm text-blue-800">
                  <div className="flex justify-between">
                    <span>Pacote completo (10 fotos):</span>
                    <span>R$ {studioSettings.minimumPackagePrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg border-t border-blue-200 pt-2">
                    <span>Pagamento antecipado ({studioSettings.advancePaymentPercentage}%):</span>
                    <span>R$ {advanceAmount.toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-xs text-blue-700 mt-3">
                  ✅ Garante seu agendamento<br/>
                  ✅ Inclui direito a 10 fotos editadas<br/>
                  ✅ Pagamento via PIX instantâneo
                </p>
              </div>

              {/* Botão de Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold text-lg shadow-lg"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    Processando Agendamento...
                  </div>
                ) : (
                  `🎯 Agendar e Pagar R$ ${advanceAmount.toFixed(2)}`
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                🔒 Seus dados estão seguros e protegidos. Pagamento processado via Mercado Pago.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicScheduling;