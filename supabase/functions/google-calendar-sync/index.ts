import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface GoogleCalendarEvent {
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  reminders: {
    useDefault: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
}

interface CalendarRequest {
  action: 'create' | 'update' | 'delete';
  eventData: any;
  googleCalendarId?: string;
  googleEventId?: string;
  accessToken: string;
}

const sessionTypeLabels: Record<string, string> = {
  'gestante': 'Sessão Gestante',
  'aniversario': 'Aniversário',
  'comerciais': 'Comerciais',
  'pre-wedding': 'Pré Wedding',
  'formatura': 'Formatura',
  'revelacao-sexo': 'Revelação de Sexo',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('Google Calendar sync function called');
  console.log('Request method:', req.method);

  try {
    const { action, eventData, googleCalendarId, googleEventId, accessToken }: CalendarRequest = await req.json()

    console.log('Calendar request:', {
      action,
      hasEventData: !!eventData,
      hasAccessToken: !!accessToken,
      googleCalendarId,
      googleEventId
    });

    if (!action || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: action, accessToken' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const calendarId = googleCalendarId || 'primary';
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    switch (action) {
      case 'create':
        return await createCalendarEvent(baseUrl, eventData, accessToken);
      case 'update':
        return await updateCalendarEvent(baseUrl, googleEventId, eventData, accessToken);
      case 'delete':
        return await deleteCalendarEvent(baseUrl, googleEventId, accessToken);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

  } catch (error) {
    console.error('Error in Google Calendar sync:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function createCalendarEvent(baseUrl: string, eventData: any, accessToken: string) {
  console.log('Creating Google Calendar event...');
  
  const sessionTypeLabel = eventData.session_type ? 
    sessionTypeLabels[eventData.session_type] || eventData.session_type : 
    'Sessão de Fotos';

  // Calcular horário de fim (2 horas após o início)
  const startDate = new Date(eventData.event_date);
  const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000)); // +2 horas

  const calendarEvent: GoogleCalendarEvent = {
    summary: `📸 ${sessionTypeLabel} - ${eventData.client_name}`,
    description: `
Sessão de Fotos - ${sessionTypeLabel}

👤 Cliente: ${eventData.client_name}
📧 Email: ${eventData.client_email}
📱 Telefone: ${eventData.client_phone}
📍 Local: ${eventData.location}

${eventData.notes ? `📝 Observações: ${eventData.notes}` : ''}

🎯 Criado pelo sistema Triagem
    `.trim(),
    start: {
      dateTime: startDate.toISOString(),
      timeZone: 'America/Sao_Paulo',
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: 'America/Sao_Paulo',
    },
    attendees: [
      {
        email: eventData.client_email,
        displayName: eventData.client_name,
      }
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 }, // 1 dia antes
        { method: 'popup', minutes: 60 }, // 1 hora antes
        { method: 'popup', minutes: 15 }, // 15 minutos antes
      ],
    },
  };

  console.log('Calendar event payload:', JSON.stringify(calendarEvent, null, 2));

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(calendarEvent),
  });

  console.log('Google Calendar API response status:', response.status);

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Google Calendar API error:', errorData);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create calendar event', 
        details: errorData 
      }),
      { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const createdEvent = await response.json();
  console.log('Calendar event created successfully:', createdEvent.id);

  return new Response(
    JSON.stringify({
      success: true,
      googleEventId: createdEvent.id,
      htmlLink: createdEvent.htmlLink,
      summary: createdEvent.summary,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function updateCalendarEvent(baseUrl: string, googleEventId: string, eventData: any, accessToken: string) {
  if (!googleEventId) {
    return new Response(
      JSON.stringify({ error: 'Google event ID required for update' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  console.log('Updating Google Calendar event:', googleEventId);

  const sessionTypeLabel = eventData.session_type ? 
    sessionTypeLabels[eventData.session_type] || eventData.session_type : 
    'Sessão de Fotos';

  const startDate = new Date(eventData.event_date);
  const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));

  const calendarEvent: GoogleCalendarEvent = {
    summary: `📸 ${sessionTypeLabel} - ${eventData.client_name}`,
    description: `
Sessão de Fotos - ${sessionTypeLabel}

👤 Cliente: ${eventData.client_name}
📧 Email: ${eventData.client_email}
📱 Telefone: ${eventData.client_phone}
📍 Local: ${eventData.location}

${eventData.notes ? `📝 Observações: ${eventData.notes}` : ''}

🎯 Atualizado pelo sistema Triagem
    `.trim(),
    start: {
      dateTime: startDate.toISOString(),
      timeZone: 'America/Sao_Paulo',
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: 'America/Sao_Paulo',
    },
    attendees: [
      {
        email: eventData.client_email,
        displayName: eventData.client_name,
      }
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 15 },
      ],
    },
  };

  const response = await fetch(`${baseUrl}/${googleEventId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(calendarEvent),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Google Calendar update error:', errorData);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update calendar event', 
        details: errorData 
      }),
      { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const updatedEvent = await response.json();
  console.log('Calendar event updated successfully');

  return new Response(
    JSON.stringify({
      success: true,
      googleEventId: updatedEvent.id,
      htmlLink: updatedEvent.htmlLink,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function deleteCalendarEvent(baseUrl: string, googleEventId: string, accessToken: string) {
  if (!googleEventId) {
    return new Response(
      JSON.stringify({ error: 'Google event ID required for deletion' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  console.log('Deleting Google Calendar event:', googleEventId);

  const response = await fetch(`${baseUrl}/${googleEventId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errorData = await response.text();
    console.error('Google Calendar delete error:', errorData);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to delete calendar event', 
        details: errorData 
      }),
      { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  console.log('Calendar event deleted successfully');

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Event deleted from Google Calendar',
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}