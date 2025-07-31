import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('=== SUBSCRIPTION WEBHOOK RECEIVED ===')

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log('Subscription webhook payload:', JSON.stringify(body, null, 2))

    if (body.type === 'payment') {
      const paymentId = body.data?.id

      if (!paymentId) {
        console.error('Payment ID not found in webhook')
        return new Response(JSON.stringify({ error: 'Payment ID missing' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Buscar access token das configurações
      const { data: photographers } = await supabase
        .from('photographers')
        .select('watermark_config')
        .not('watermark_config', 'is', null)
        .limit(1)

      if (!photographers || photographers.length === 0) {
        console.error('No photographer config found')
        return new Response(JSON.stringify({ error: 'Config not found' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const accessToken = photographers[0].watermark_config?.mercadoPagoAccessToken

      if (!accessToken) {
        console.error('MercadoPago access token not configured')
        return new Response(JSON.stringify({ error: 'Access token not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Buscar detalhes do pagamento no Mercado Pago
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      })

      if (!mpResponse.ok) {
        console.error('Error fetching payment from MercadoPago:', mpResponse.status)
        return new Response(JSON.stringify({ error: 'Failed to fetch payment details' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const paymentData = await mpResponse.json()
      console.log('Payment data:', paymentData)

      // Verificar se é pagamento de assinatura
      if (paymentData.metadata?.type === 'subscription_payment') {
        const subscriptionId = paymentData.metadata.subscription_id
        const userId = paymentData.metadata.user_id

        if (paymentData.status === 'approved') {
          console.log('Subscription payment approved, activating subscription...')

          // Ativar assinatura
          const expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + 30) // 30 dias

          const { error: subscriptionError } = await supabase
            .from('subscriptions')
            .update({
              plan_type: 'paid',
              status: 'active',
              payment_date: new Date().toISOString(),
              payment_amount: paymentData.transaction_amount,
              payment_intent_id: paymentId.toString(),
              expires_at: expiresAt.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', subscriptionId)

          if (subscriptionError) {
            console.error('Error updating subscription:', subscriptionError)
          } else {
            console.log('Subscription activated successfully')
          }

          // Atualizar transação
          const { error: transactionError } = await supabase
            .from('payment_transactions')
            .update({ status: 'approved' })
            .eq('payment_intent_id', paymentId.toString())

          if (transactionError) {
            console.error('Error updating transaction:', transactionError)
          }
        }
      }

      // Salvar log
      await supabase.from('webhook_logs').insert({
        event_type: 'subscription_payment_webhook',
        payload: {
          paymentId,
          paymentData,
          processed: true
        },
        status: 'success'
      })

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Subscription webhook error:', error)
    
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})