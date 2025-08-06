import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SubscriptionPaymentRequest {
  user_id: string;
  subscription_id: string;
  amount: number;
  access_token: string;
  client_name?: string;
  device_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('Subscription payment function called');

  try {
    const { user_id, subscription_id, amount, access_token, client_name, device_id }: SubscriptionPaymentRequest = await req.json()

    console.log('Subscription payment request:', {
      user_id,
      subscription_id,
      amount,
      has_access_token: !!access_token,
      client_name,
      has_device_id: !!device_id
    });

    if (!user_id || !subscription_id || !amount || !access_token) {
      return new Response(
        JSON.stringify({ error: 'Dados obrigatórios não fornecidos' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar dados do usuário
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user_id)
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const user = userData.user;
    const userName = client_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Cliente';
    const [firstName, ...lastNameParts] = userName.split(' ');
    const lastName = lastNameParts.join(' ') || 'Silva';

    // Criar itens detalhados para assinatura
    const items = [
      {
        id: 'subscription_monthly',
        title: 'Assinatura Mensal - Sistema Triagem',
        description: 'Acesso completo ao sistema de seleção de fotos para fotógrafos profissionais',
        category_id: 'software_services',
        quantity: 1,
        unit_price: amount,
        currency_id: 'BRL'
      }
    ];

    // Criar pagamento no Mercado Pago
    const paymentData = {
      transaction_amount: amount,
      description: `Assinatura Mensal - Sistema Triagem - ${userName}`,
      payment_method_id: 'pix',
      statement_descriptor: 'TRIAGEM ASSIN',
      ...(device_id && { device_id }),
      payer: {
        email: user.email,
        first_name: firstName,
        last_name: lastName,
        identification: {
          type: 'CPF',
          number: '00000000000'
        }
      },
      items: items,
      marketplace: 'NONE',
      binary_mode: false,
      capture: true,
      additional_info: {
        items: items,
        payer: {
          first_name: firstName,
          last_name: lastName,
          address: {
            zip_code: '01310-100',
            street_name: 'Av. Paulista',
            street_number: 1000
          }
        }
      },
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/subscription-webhook`,
      external_reference: `subscription_${subscription_id}`,
      metadata: {
        user_id: user_id,
        subscription_id: subscription_id,
        type: 'subscription_payment',
        client_name: userName,
        device_id: device_id || ''
      }
    }

    console.log('Creating MercadoPago payment for subscription...');

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
        'X-Idempotency-Key': `subscription_${subscription_id}_${Date.now()}`,
      },
      body: JSON.stringify(paymentData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('MercadoPago API error:', errorData)
      return new Response(
        JSON.stringify({ 
          error: 'Erro na API do Mercado Pago', 
          details: errorData 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const paymentResult = await response.json()
    console.log('Subscription payment created:', paymentResult.id);

    // Salvar transação no banco
    const { error: transactionError } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: user_id,
        subscription_id: subscription_id,
        amount: amount,
        payment_method: 'mercadopago',
        payment_intent_id: paymentResult.id.toString(),
        status: paymentResult.status,
        metadata: {
          external_reference: paymentResult.external_reference,
          payment_method_id: paymentResult.payment_method_id
        }
      });

    if (transactionError) {
      console.error('Error saving transaction:', transactionError);
    }

    return new Response(
      JSON.stringify({
        id: paymentResult.id,
        status: paymentResult.status,
        qr_code: paymentResult.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: paymentResult.point_of_interaction?.transaction_data?.qr_code_base64,
        ticket_url: paymentResult.point_of_interaction?.transaction_data?.ticket_url,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error processing subscription payment:', error)
    
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