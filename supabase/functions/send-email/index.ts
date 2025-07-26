import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  type: 'booking_confirmation' | 'session_reminder_day_before' | 'session_reminder_day_of';
  eventData?: any;
  studioData?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('Email function called');

  try {
    const { to, subject, html, type, eventData, studioData }: EmailRequest = await req.json()

    console.log('Email request:', { to, subject, type });

    // Aqui você integraria com um serviço de email como:
    // - SendGrid
    // - Mailgun  
    // - Amazon SES
    // - Resend
    
    // Por enquanto, vamos simular o envio
    console.log('Simulating email send:', {
      to,
      subject,
      type,
      htmlLength: html.length
    });

    // Salvar log do email no banco
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabase.from('webhook_logs').insert({
      event_type: `email_${type}`,
      payload: {
        to,
        subject,
        type,
        eventData,
        studioData,
        timestamp: new Date().toISOString()
      },
      status: 'success'
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully (simulated)',
        type 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error sending email:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send email', 
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})