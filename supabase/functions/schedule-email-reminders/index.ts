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

  console.log('Email reminder scheduler called');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar eventos que precisam de lembrete
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    // Eventos para lembrete de 1 dia antes
    const { data: eventsForDayBefore } = await supabase
      .from('events')
      .select(`
        *,
        photographers!inner(
          id,
          business_name,
          phone,
          watermark_config
        )
      `)
      .gte('event_date', tomorrow.toISOString())
      .lt('event_date', dayAfterTomorrow.toISOString())
      .eq('status', 'scheduled');

    // Eventos para lembrete do dia (manhã)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const { data: eventsForToday } = await supabase
      .from('events')
      .select(`
        *,
        photographers!inner(
          id,
          business_name,
          phone,
          watermark_config
        )
      `)
      .gte('event_date', today.toISOString())
      .lt('event_date', endOfToday.toISOString())
      .eq('status', 'scheduled');

    console.log(`Found ${eventsForDayBefore?.length || 0} events for day-before reminders`);
    console.log(`Found ${eventsForToday?.length || 0} events for day-of reminders`);

    // Enviar lembretes de 1 dia antes
    if (eventsForDayBefore) {
      for (const event of eventsForDayBefore) {
        try {
          await sendDayBeforeReminder(event);
          console.log(`Day-before reminder sent for event ${event.id}`);
        } catch (error) {
          console.error(`Failed to send day-before reminder for event ${event.id}:`, error);
        }
      }
    }

    // Enviar lembretes do dia (apenas pela manhã, entre 8h e 10h)
    const currentHour = new Date().getHours();
    if (eventsForToday && currentHour >= 8 && currentHour <= 10) {
      for (const event of eventsForToday) {
        try {
          await sendDayOfReminder(event);
          console.log(`Day-of reminder sent for event ${event.id}`);
        } catch (error) {
          console.error(`Failed to send day-of reminder for event ${event.id}:`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        dayBeforeReminders: eventsForDayBefore?.length || 0,
        dayOfReminders: (currentHour >= 8 && currentHour <= 10) ? (eventsForToday?.length || 0) : 0,
        currentHour: currentHour,
        message: `Processed reminders at ${new Date().toISOString()}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in email reminder scheduler:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process email reminders', 
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function sendDayBeforeReminder(event: any) {
  console.log('Sending day-before reminder for:', event.client_name);
  
  const sessionTypeLabels: Record<string, string> = {
    'gestante': 'Sessão Gestante',
    'aniversario': 'Aniversário',
    'comerciais': 'Comerciais',
    'pre-wedding': 'Pré Wedding',
    'formatura': 'Formatura',
    'revelacao-sexo': 'Revelação de Sexo',
  };

  const sessionTypeLabel = event.session_type ? 
    sessionTypeLabels[event.session_type] || event.session_type : 
    'Sessão';

  const studioSettings = {
    businessName: event.photographers.business_name,
    phone: event.photographers.phone,
    email: event.photographers.watermark_config?.email || 'contato@estudio.com',
    address: event.photographers.watermark_config?.address || 'Estúdio Fotográfico',
    website: event.photographers.watermark_config?.website || '',
  };

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">⏰ Lembrete da Sessão</h1>
      </div>
      
      <div style="padding: 30px; background: #f8f9fa;">
        <p style="font-size: 18px; color: #333;">Olá <strong>${event.client_name}</strong>!</p>
        
        <p style="color: #666; line-height: 1.6;">
          Sua sessão de fotos está chegando! Amanhã será o grande dia.
        </p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f5576c;">
          <h3 style="color: #333; margin-top: 0;">📅 Detalhes da Sessão:</h3>
          <p><strong>Tipo:</strong> ${sessionTypeLabel}</p>
          <p><strong>Data:</strong> ${new Date(event.event_date).toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
          <p><strong>Horário:</strong> ${new Date(event.event_date).toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}</p>
          <p><strong>Local:</strong> ${studioSettings.address}</p>
        </div>
        
        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2e7d32; margin-top: 0;">✅ Checklist para Amanhã:</h3>
          <ul style="color: #666; line-height: 1.8; padding-left: 20px;">
            <li>Chegue 10 minutos antes do horário</li>
            <li>Traga suas fotos de referência</li>
            <li>Vista roupas confortáveis e adequadas ao tipo de sessão</li>
            <li>Tenha uma boa noite de sono</li>
            <li>Venha com energia positiva! 😊</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <p style="color: #666;">Estamos ansiosos para te ver amanhã!</p>
          <p style="color: #999; font-size: 14px;">
            Dúvidas? Entre em contato: ${studioSettings.phone}
          </p>
          ${studioSettings.website ? `<p style="color: #999; font-size: 14px;">Site: ${studioSettings.website}</p>` : ''}
        </div>
        
        <div style="text-align: center; padding: 20px; background: #333; color: white; border-radius: 8px;">
          <p style="margin: 0; font-size: 14px;">
            ${studioSettings.businessName} - Capturando seus melhores momentos
          </p>
        </div>
      </div>
    </div>
  `;

  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({
      to: event.client_email,
      subject: `⏰ Lembrete: Sua sessão é amanhã! - ${studioSettings.businessName}`,
      html: emailHtml,
      type: 'session_reminder_day_before',
      eventData: event,
      studioData: studioSettings,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to send day-before reminder email:', errorText);
    throw new Error(`Email send failed: ${response.status}`);
  }
  
  console.log('Day-before reminder email sent successfully');
}

async function sendDayOfReminder(event: any) {
  console.log('Sending day-of reminder for:', event.client_name);
  
  // Carregar configurações de email do fotógrafo
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const emailTemplates = event.photographers?.watermark_config?.emailTemplates;
  
  // Verificar se o email está habilitado
  if (!emailTemplates?.dayOfReminder?.enabled) {
    console.log('Day of reminder email is disabled');
    return;
  }

  const sessionTypeLabels: Record<string, string> = {
    'gestante': 'Sessão Gestante',
    'aniversario': 'Aniversário',
    'comerciais': 'Comerciais',
    'pre-wedding': 'Pré Wedding',
    'formatura': 'Formatura',
    'revelacao-sexo': 'Revelação de Sexo',
  };

  const sessionTypeLabel = event.session_type ? 
    sessionTypeLabels[event.session_type] || event.session_type : 
    'Sessão';

  const studioSettings = {
    businessName: event.photographers.business_name,
    phone: event.photographers.phone,
    email: event.photographers.watermark_config?.email || 'contato@estudio.com',
    address: event.photographers.watermark_config?.address || 'Estúdio Fotográfico',
    website: event.photographers.watermark_config?.website || '',
  };

  // Usar template personalizado
  let subject = emailTemplates.dayOfReminder.subject;
  let message = emailTemplates.dayOfReminder.message;

  // Substituir variáveis no assunto
  subject = subject
    .replace(/\[\[clientName\]\]/g, event.client_name)
    .replace(/\[\[sessionType\]\]/g, sessionTypeLabel)
    .replace(/\[\[studioName\]\]/g, studioSettings.businessName)
    .replace(/\[\[eventDate\]\]/g, new Date(event.event_date).toLocaleDateString('pt-BR'))
    .replace(/\[\[eventTime\]\]/g, new Date(event.event_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    .replace(/\[\[studioAddress\]\]/g, studioSettings.address || '')
    .replace(/\[\[studioPhone\]\]/g, studioSettings.phone || '')
    .replace(/\[\[studioEmail\]\]/g, studioSettings.email || '')
    .replace(/\[\[studioWebsite\]\]/g, studioSettings.website || '');

  // Substituir variáveis na mensagem
  message = message
    .replace(/\[\[clientName\]\]/g, event.client_name)
    .replace(/\[\[sessionType\]\]/g, sessionTypeLabel)
    .replace(/\[\[studioName\]\]/g, studioSettings.businessName)
    .replace(/\[\[eventDate\]\]/g, new Date(event.event_date).toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }))
    .replace(/\[\[eventTime\]\]/g, new Date(event.event_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    .replace(/\[\[studioAddress\]\]/g, studioSettings.address || '')
    .replace(/\[\[studioPhone\]\]/g, studioSettings.phone || '')
    .replace(/\[\[studioEmail\]\]/g, studioSettings.email || '')
    .replace(/\[\[studioWebsite\]\]/g, studioSettings.website || '');

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Hoje é o Dia!</h1>
      </div>
      
      <div style="padding: 30px; background: #f8f9fa;">
        <div style="white-space: pre-line; color: #333; line-height: 1.6;">
          ${message}
        </div>
      </div>
      
      <div style="text-align: center; padding: 20px; background: #333; color: white;">
        <p style="margin: 0; font-size: 14px;">
          ${studioSettings.businessName} - Capturando seus melhores momentos
        </p>
      </div>
    </div>
  `;

  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({
      to: event.client_email,
      subject: subject,
      html: emailHtml,
      type: 'session_reminder_day_of',
      eventData: event,
      studioData: studioSettings,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to send day-of reminder email:', errorText);
    throw new Error(`Email send failed: ${response.status}`);
  }
  
  console.log('Day-of reminder email sent successfully');
}