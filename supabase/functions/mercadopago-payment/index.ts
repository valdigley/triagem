import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PaymentRequest {
  transaction_amount: number;
  description: string;
  payment_method_id: string;
  payer: {
    email: string;
    first_name?: string;
    last_name?: string;
    identification?: {
      type: string;
      number: string;
    };
  };
  access_token: string;
  selected_photos: string[];
  event_id?: string;
  client_email: string;
  items?: Array<{
    id: string;
    title: string;
    description: string;
    category_id: string;
    quantity: number;
    unit_price: number;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('MercadoPago payment function called');
  console.log('Request method:', req.method);
  console.log('Request headers:', Object.fromEntries(req.headers.entries()));

  try {
    const { 
      transaction_amount, 
      description, 
      payment_method_id, 
      payer, 
      access_token,
      selected_photos,
      event_id,
      client_email,
      items
    }: PaymentRequest = await req.json()

    console.log('Received payment request:', {
      transaction_amount,
      description,
      payment_method_id,
      payer_email: payer?.email,
      has_access_token: !!access_token,
      access_token_length: access_token?.length,
      selected_photos_count: selected_photos?.length,
      event_id,
      client_email,
    });
    // Validar dados obrigatórios
    if (!transaction_amount || !description || !payer?.email || !access_token) {
      console.error('Missing required fields:', {
        has_transaction_amount: !!transaction_amount,
        has_description: !!description,
        has_payer_email: !!payer?.email,
        has_access_token: !!access_token,
      });
      return new Response(
        JSON.stringify({ error: 'Dados obrigatórios não fornecidos' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Criar pagamento no Mercado Pago
    const [firstName, ...lastNameParts] = (payer.first_name || payer.email.split('@')[0]).split(' ');
    const lastName = lastNameParts.join(' ') || payer.last_name || 'Cliente';
    
    const paymentData = {
      transaction_amount,
      description,
      payment_method_id: payment_method_id || 'pix',
      payer: {
        email: payer.email,
        first_name: firstName,
        last_name: lastName,
        identification: payer.identification || {
          type: 'CPF',
          number: '00000000000' // Será substituído pelo valor real quando disponível
        }
      },
      items: items || [
        {
          id: `photo_package_${Date.now()}`,
          title: description,
          description: `Pacote de fotos - ${selected_photos.length} fotos selecionadas`,
          category_id: 'photography',
          quantity: selected_photos.length || 1,
          unit_price: selected_photos.length > 0 ? transaction_amount / selected_photos.length : transaction_amount
        }
      ],
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      external_reference: `order_${Date.now()}`,
      metadata: {
        selected_photos: selected_photos.join(','),
        event_id: event_id || '',
        client_email: payer.email,
        package_type: selected_photos.length > 10 ? 'extra_photos' : 'basic_package',
        photo_count: selected_photos.length
      }
    }

    console.log('Creating payment with data:', paymentData)

    // Usar URL correta baseada no tipo de credencial
    const isTestMode = access_token.startsWith('TEST-');
    const mpApiUrl = isTestMode 
      ? 'https://api.mercadopago.com/v1/payments'
      : 'https://api.mercadopago.com/v1/payments';
    
    console.log('Calling MercadoPago API:', mpApiUrl);
    console.log('Test mode:', isTestMode);
    console.log('Request headers:', {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token.substring(0, 20)}...`,
    });

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
        'X-Idempotency-Key': `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
      body: JSON.stringify(paymentData),
    })

    console.log('MercadoPago API response status:', response.status);
    console.log('MercadoPago API response headers:', Object.fromEntries(response.headers.entries()));

    const responseData = await response.json()
    console.log('MercadoPago API response data:', responseData);

    if (!response.ok) {
      console.error('Mercado Pago API error:', responseData)
      return new Response(
        JSON.stringify({ 
          error: 'Erro na API do Mercado Pago', 
          details: responseData 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Payment created successfully:', responseData)

    // Não criar pedido aqui - será criado após confirmação do pagamento
    console.log('Payment created, waiting for confirmation...')

    // Retornar dados do pagamento
    return new Response(
      JSON.stringify({
        id: responseData.id,
        status: responseData.status,
        status_detail: responseData.status_detail,
        payment_method_id: responseData.payment_method_id,
        transaction_amount: responseData.transaction_amount,
        point_of_interaction: responseData.point_of_interaction,
        qr_code: responseData.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: responseData.point_of_interaction?.transaction_data?.qr_code_base64,
        ticket_url: responseData.point_of_interaction?.transaction_data?.ticket_url,
        payer_email: payer.email,
        description: description,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error processing payment:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor', 
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})