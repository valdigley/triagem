import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface WhatsAppRequest {
  phone: string;
  message: string;
  event_id?: string;
  type: 'google_drive_share' | 'booking_confirmation' | 'album_ready' | 'selection_reminder';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('WhatsApp send function called');

  try {
    const { phone, message, event_id, type }: WhatsAppRequest = await req.json()

    console.log('WhatsApp request:', {
      phone,
      messageLength: message?.length,
      event_id,
      type
    });

    if (!phone || !message || !type) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: phone, message, type' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar configurações da Evolution API
    const { data: photographers, error: configError } = await supabase
      .from('photographers')
      .select('watermark_config')
      .not('watermark_config', 'is', null)
      .limit(1)

    if (configError || !photographers || photographers.length === 0) {
      console.error('Error fetching Evolution API config:', configError)
      return new Response(
        JSON.stringify({ error: 'Configuração da Evolution API não encontrada' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const config = photographers[0].watermark_config
    const evolutionApiUrl = config?.evolutionApiUrl
    const evolutionApiKey = config?.evolutionApiKey
    const evolutionInstance = config?.evolutionInstance

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      console.error('Evolution API not configured')
      
      // Simular envio para desenvolvimento
      console.log('=== SIMULATING WHATSAPP MESSAGE ===')
      console.log('To:', phone)
      console.log('Message:', message)
      console.log('Type:', type)
      console.log('Event ID:', event_id)
      
      // Salvar log da simulação
      await supabase.from('webhook_logs').insert({
        event_type: `whatsapp_${type}`,
        payload: {
          phone,
          message,
          event_id,
          type,
          simulated: true,
          reason: 'Evolution API not configured'
        },
        status: 'success'
      })

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Mensagem simulada (Evolution API não configurada)',
          simulated: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Limpar número de telefone
    const cleanPhone = phone.replace(/\D/g, '')
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`

    // Enviar mensagem via Evolution API
    console.log('Sending WhatsApp message via Evolution API...')
    
    const evolutionResponse = await fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify({
        number: fullPhone,
        text: message,
      }),
    })

    console.log('Evolution API response status:', evolutionResponse.status)

    if (!evolutionResponse.ok) {
      const errorData = await evolutionResponse.text()
      console.error('Evolution API error:', errorData)
      
      // Salvar log do erro
      await supabase.from('webhook_logs').insert({
        event_type: `whatsapp_${type}_error`,
        payload: {
          phone: fullPhone,
          message,
          event_id,
          type,
          error: errorData
        },
        status: 'failed'
      })

      return new Response(
        JSON.stringify({ 
          error: 'Erro ao enviar mensagem via Evolution API',
          details: errorData
        }),
        { 
          status: evolutionResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const evolutionResult = await evolutionResponse.json()
    console.log('WhatsApp message sent successfully:', evolutionResult)

    // Salvar log de sucesso
    await supabase.from('webhook_logs').insert({
      event_type: `whatsapp_${type}`,
      payload: {
        phone: fullPhone,
        message,
        event_id,
        type,
        evolutionResult
      },
      status: 'success'
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensagem enviada com sucesso',
        evolutionResult
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error sending WhatsApp message:', error)
    
    // Tentar salvar log de erro
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabase.from('webhook_logs').insert({
        event_type: 'whatsapp_error',
        payload: {
          error: error.message,
          stack: error.stack
        },
        status: 'failed'
      })
    } catch (logError) {
      console.error('Failed to log WhatsApp error:', logError)
    }
    
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