import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('=== MERCADOPAGO WEBHOOK RECEIVED ===')
  console.log('Method:', req.method)
  console.log('Headers:', Object.fromEntries(req.headers.entries()))

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log('Webhook payload:', JSON.stringify(body, null, 2))

    // Mercado Pago envia notificações sobre mudanças de status
    if (body.type === 'payment') {
      const paymentId = body.data?.id

      if (!paymentId) {
        console.error('Payment ID not found in webhook')
        return new Response(JSON.stringify({ error: 'Payment ID missing' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log(`Processing payment update for ID: ${paymentId}`)

      // Buscar detalhes do pagamento na API do Mercado Pago
      // Primeiro, precisamos do access token - vamos buscar das configurações
      const { data: photographers, error: photosError } = await supabase
        .from('photographers')
        .select('watermark_config')
        .not('watermark_config', 'is', null)
        .limit(1)

      if (photosError || !photographers || photographers.length === 0) {
        console.error('Error fetching photographer config:', photosError)
        return new Response(JSON.stringify({ error: 'Config not found' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const config = photographers[0].watermark_config
      const accessToken = config?.mercadoPagoAccessToken

      if (!accessToken) {
        console.error('MercadoPago access token not configured')
        return new Response(JSON.stringify({ error: 'Access token not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Buscar detalhes do pagamento no Mercado Pago
      console.log('Fetching payment details from MercadoPago API...')
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      })

      if (!mpResponse.ok) {
        console.error('Error fetching payment from MercadoPago:', mpResponse.status)
        const errorData = await mpResponse.text()
        console.error('MercadoPago error:', errorData)
        
        // Salvar log do erro
        await supabase.from('webhook_logs').insert({
          event_type: 'mercadopago_payment_fetch_error',
          payload: { paymentId, error: errorData },
          status: 'failed'
        })

        return new Response(JSON.stringify({ error: 'Failed to fetch payment details' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const paymentData = await mpResponse.json()
      console.log('Payment data from MercadoPago:', JSON.stringify(paymentData, null, 2))

      // Extrair informações importantes
      const status = paymentData.status // approved, pending, rejected, etc.
      const statusDetail = paymentData.status_detail
      const externalReference = paymentData.external_reference
      const transactionAmount = paymentData.transaction_amount
      const paymentMethodId = paymentData.payment_method_id
      const payerEmail = paymentData.payer?.email
      const feeDetails = paymentData.fee_details || []
      const totalFees = feeDetails.reduce((sum: number, fee: any) => sum + (fee.amount || 0), 0)
      const netAmount = transactionAmount - totalFees

      console.log('Payment status:', status)
      console.log('External reference:', externalReference)
      console.log('Amount:', transactionAmount)
      console.log('Fees:', totalFees)
      console.log('Net amount:', netAmount)
      console.log('Payer email:', payerEmail)

      // Buscar o pedido no nosso banco de dados pelo payment_intent_id
      const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_intent_id', paymentId.toString())

      if (orderError) {
        console.error('Error fetching order:', orderError)
        await supabase.from('webhook_logs').insert({
          event_type: 'mercadopago_order_fetch_error',
          payload: { paymentId, error: orderError },
          status: 'failed'
        })
        return new Response(JSON.stringify({ error: 'Order fetch failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (!orders || orders.length === 0) {
        console.log('Order not found for payment ID:', paymentId)
        
        // Tentar buscar por external_reference se não encontrou pelo payment_id
        if (externalReference) {
          console.log('Trying to find order by external_reference:', externalReference)
          
          const { data: ordersByRef } = await supabase
            .from('orders')
            .select('*')
            .ilike('payment_intent_id', `%${externalReference}%`)
          
          if (ordersByRef && ordersByRef.length > 0) {
            console.log('Found order by external reference')
            // Usar a primeira ordem encontrada
            const order = ordersByRef[0]
            
            // Atualizar com o payment_id correto
            await supabase
              .from('orders')
              .update({ payment_intent_id: paymentId.toString() })
              .eq('id', order.id)
              
            // Continuar com o processamento normal
          } else {
            console.log('No order found even by external reference')
          }
        }
        
        await supabase.from('webhook_logs').insert({
          event_type: 'mercadopago_payment_orphan',
          payload: { paymentId, paymentData },
          status: 'success'
        })
        return new Response(JSON.stringify({ message: 'Order not found, logged as orphan' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const order = orders[0]
      console.log('Found order:', order.id)

      // Mapear status do Mercado Pago para nosso sistema
      let newOrderStatus: 'pending' | 'paid' | 'cancelled' | 'expired' = 'pending'
      
      switch (status) {
        case 'approved':
          newOrderStatus = 'paid'
          break
        case 'rejected':
        case 'cancelled':
          newOrderStatus = 'cancelled'
          break
        case 'expired':
          newOrderStatus = 'expired'
          break
        default:
          newOrderStatus = 'pending'
      }

      console.log('Updating order status to:', newOrderStatus)

      // Atualizar status do pedido
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: newOrderStatus,
          payment_intent_id: paymentId.toString(), // Manter ID original para consultas
          metadata: {
            ...order.metadata,
            mercadopago_fee: totalFees,
            net_amount: netAmount,
            payment_method: paymentMethodId,
            fee_details: feeDetails,
            updated_by_webhook: true,
            webhook_timestamp: new Date().toISOString()
          }
        })
        .eq('id', order.id)

      if (updateError) {
        console.error('Error updating order:', updateError)
        await supabase.from('webhook_logs').insert({
          event_type: 'mercadopago_order_update_error',
          payload: { paymentId, orderId: order.id, error: updateError },
          status: 'failed'
        })
        return new Response(JSON.stringify({ error: 'Order update failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Se o pagamento foi aprovado, marcar as fotos como pagas
      if (newOrderStatus === 'paid') {
        console.log('Payment approved! Updating photos status...')
        
        // Buscar o álbum relacionado ao evento
        const { data: events } = await supabase
          .from('events')
          .select('id')
          .eq('id', order.event_id)
          .single()

        if (events) {
          const { data: albums } = await supabase
            .from('albums')
            .select('id')
            .eq('event_id', events.id)

          if (albums && albums.length > 0) {
            const albumId = albums[0].id
            
            // Marcar álbum como pago (adicionar campo se necessário)
            await supabase
              .from('albums')
              .update({ 
                // Você pode adicionar um campo 'payment_status' na tabela albums
                // payment_status: 'paid'
              })
              .eq('id', albumId)

            console.log('Album payment status updated')
          }
        }

        // Aqui você pode adicionar lógica adicional para pagamento aprovado:
        // - Enviar email de confirmação
        // - Liberar download das fotos
        // - Notificar o fotógrafo
        // - etc.
      }

      // Salvar log de sucesso
      await supabase.from('webhook_logs').insert({
        event_type: 'mercadopago_payment_processed',
        payload: {
          paymentId,
          orderId: order.id,
          oldStatus: order.status,
          newStatus: newOrderStatus,
          paymentData: {
            status,
            statusDetail,
            transactionAmount,
            paymentMethodId,
            payerEmail
          }
        },
        status: 'success'
      })

      console.log('=== WEBHOOK PROCESSED SUCCESSFULLY ===')
      
      return new Response(JSON.stringify({ 
        success: true, 
        orderId: order.id,
        oldStatus: order.status,
        newStatus: newOrderStatus
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Para outros tipos de webhook, apenas logar
    await supabase.from('webhook_logs').insert({
      event_type: `mercadopago_${body.type || 'unknown'}`,
      payload: body,
      status: 'success'
    })

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    
    // Tentar salvar log de erro
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabase.from('webhook_logs').insert({
        event_type: 'mercadopago_webhook_error',
        payload: { error: error.message, stack: error.stack },
        status: 'failed'
      })
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }
    
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})