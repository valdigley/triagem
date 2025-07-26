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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log('Webhook received:', body)

    // Mercado Pago envia notificações sobre mudanças de status
    if (body.type === 'payment') {
      const paymentId = body.data?.id

      if (paymentId) {
        // Aqui você pode buscar os detalhes do pagamento na API do MP
        // e atualizar o status no seu banco de dados
        
        console.log(`Payment ${paymentId} status updated`)
        
        // Salvar log do webhook
        await supabase.from('webhook_logs').insert({
          event_type: 'mercadopago_payment_update',
          payload: body,
          status: 'success'
        })
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})