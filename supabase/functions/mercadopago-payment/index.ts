import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      transaction_amount, 
      description, 
      payment_method_id, 
      payer, 
      access_token,
      selected_photos,
      event_id 
    }: PaymentRequest = await req.json()

    // Validar dados obrigatórios
    if (!transaction_amount || !description || !payer?.email || !access_token) {
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
      }
    }

    console.log('Creating payment with data:', paymentData)

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
        'X-Idempotency-Key': `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
      body: JSON.stringify(paymentData),
    })

    const responseData = await response.json()

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