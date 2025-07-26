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
  console.log('Request method:', req.method);
  console.log('Request headers:', Object.fromEntries(req.headers.entries()));

  try {
    const { to, subject, html, type, eventData, studioData }: EmailRequest = await req.json()

    console.log('Email request:', { 
      to, 
      subject, 
      type,
      hasEventData: !!eventData,
      hasStudioData: !!studioData,
      htmlLength: html?.length
    });

    // Validar dados obrigatórios
    if (!to || !subject || !html || !type) {
      console.error('Missing required email fields:', {
        hasTo: !!to,
        hasSubject: !!subject,
        hasHtml: !!html,
        hasType: !!type
      });
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      console.error('Invalid email format:', to);
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Aqui você integraria com um serviço de email como:
    // - SendGrid
    // - Mailgun  
    // - Amazon SES
    // - Resend
    // - Postmark
    
    // Por enquanto, vamos simular o envio
    console.log('=== SIMULATING EMAIL SEND ===');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Type:', type);
    console.log('HTML length:', html.length);
    console.log('Event data:', eventData ? {
      clientName: eventData.client_name,
      eventDate: eventData.event_date,
      sessionType: eventData.session_type
    } : 'None');
    console.log('Studio data:', studioData ? {
      businessName: studioData.businessName,
      phone: studioData.phone
    } : 'None');
    
    // Simular delay de envio
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Email simulation completed successfully');
    
    // Exemplo de integração real com SendGrid:
    /*
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(Deno.env.get('SENDGRID_API_KEY'));
    
    const msg = {
      to,
      subject,
      html,
      from: studioData?.email || 'noreply@estudio.com'
    };
    
    await sgMail.send(msg);
    */

    // Salvar log do email no banco
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: logError } = await supabase.from('webhook_logs').insert({
      event_type: `email_${type}`,
      payload: {
        to,
        subject,
        type,
        htmlLength: html.length,
        eventData,
        studioData,
        timestamp: new Date().toISOString(),
        simulated: true
      },
      status: 'success'
    });
    
    if (logError) {
      console.error('Failed to log email send:', logError);
    } else {
      console.log('Email send logged successfully');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully (simulated)', 
        type,
        to,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error sending email:', error)
    console.error('Error stack:', error.stack)
    
    // Tentar salvar log de erro
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabase.from('webhook_logs').insert({
        event_type: 'email_error',
        payload: {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        },
        status: 'failed'
      });
    } catch (logError) {
      console.error('Failed to log email error:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send email', 
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})