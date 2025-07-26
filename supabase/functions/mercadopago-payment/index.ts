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
  };
  access_token: string;
  selected_photos: string[];
  event_id?: string;
  client_email: string;
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
      client_email
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
    const paymentData = {
      transaction_amount,
      description,
      payment_method_id: payment_method_id || 'pix',
      payer: {
        email: payer.email,
      },
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      external_reference: `order_${Date.now()}`,
      metadata: {
        selected_photos: selected_photos.join(','),
        event_id: event_id || '',
        client_email: payer.email,
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

    // Criar pedido no banco de dados imediatamente
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      const orderData = {
        event_id: event_id,
        client_email: client_email || payer.email,
        selected_photos: selected_photos || [],
        total_amount: transaction_amount,
        status: 'pending' as const,
        payment_intent_id: responseData.id.toString(),
      }

      console.log('Creating order in database:', orderData)

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single()

      if (orderError) {
        console.error('Error creating order:', orderError)
        // Não falhar o pagamento por causa do erro do pedido
      } else {
        console.log('Order created successfully:', order.id)
      }
    } catch (error) {
      console.error('Error in order creation:', error)
      // Não falhar o pagamento por causa do erro do pedido
    }

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
        event_id: event_id,
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