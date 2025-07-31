import { supabase } from './supabase';

interface GoogleCalendarConfig {
  accessToken: string;
  calendarId?: string;
}

export class GoogleCalendarService {
  private config: GoogleCalendarConfig;

  constructor(config: GoogleCalendarConfig) {
    this.config = config;
  }

  async createEvent(eventData: any): Promise<string | null> {
    try {
      console.log('🚀 Chamando edge function do Google Calendar...');
      console.log('🔑 Access Token configurado:', !!this.config.accessToken);
      console.log('📅 Calendar ID:', this.config.calendarId || 'primary');
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'create',
          eventData,
          googleCalendarId: this.config.calendarId,
          accessToken: this.config.accessToken,
        }),
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Falha na edge function:', errorData);
        
        // Verificar se é erro de autenticação
        if (errorData.details?.error?.code === 401 || 
            errorData.details?.error?.message?.includes('invalid authentication')) {
          throw new Error('Google Calendar token expirado. Configure um novo token em Configurações → Google Calendar');
        }
        
        throw new Error(errorData.error || 'Failed to create calendar event');
      }

      const result = await response.json();
      console.log('✅ Edge function executada com sucesso!');
      console.log('🆔 Google Event ID retornado:', result.googleEventId);
      console.log('🔗 Link do evento:', result.htmlLink);
      
      return result.googleEventId;
    } catch (error) {
      console.error('💥 Erro na criação do evento:', error);
      throw error;
    }
  }

  async updateEvent(googleEventId: string, eventData: any): Promise<boolean> {
    try {
      console.log('Updating Google Calendar event:', googleEventId);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'update',
          eventData,
          googleEventId,
          googleCalendarId: this.config.calendarId,
          accessToken: this.config.accessToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to update Google Calendar event:', errorData);
        throw new Error(errorData.error || 'Failed to update calendar event');
      }

      console.log('Google Calendar event updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating Google Calendar event:', error);
      throw error;
    }
  }

  async deleteEvent(googleEventId: string): Promise<boolean> {
    try {
      console.log('Deleting Google Calendar event:', googleEventId);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'delete',
          googleEventId,
          googleCalendarId: this.config.calendarId,
          accessToken: this.config.accessToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to delete Google Calendar event:', errorData);
        throw new Error(errorData.error || 'Failed to delete calendar event');
      }

      console.log('Google Calendar event deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      throw error;
    }
  }
}

// Função helper para obter configuração do Google Calendar
export const getGoogleCalendarConfig = async (userId: string): Promise<GoogleCalendarConfig | null> => {
  try {
    const { data: photographer } = await supabase
      .from('photographers')
      .select('watermark_config')
      .eq('user_id', userId)
      .limit(1);

    const config = photographer && photographer.length > 0 ? photographer[0].watermark_config : null;
    
    if (!config?.googleCalendarAccessToken) {
      console.warn('Google Calendar not configured for user:', userId);
      return null;
    }

    return {
      accessToken: config.googleCalendarAccessToken,
      calendarId: config.googleCalendarId || 'primary',
    };
  } catch (error) {
    console.error('Error loading Google Calendar config:', error);
    return null;
  }
};

// Função para inicializar o serviço do Google Calendar
export const createGoogleCalendarService = async (userId: string): Promise<GoogleCalendarService | null> => {
  const config = await getGoogleCalendarConfig(userId);
  
  if (!config) {
    return null;
  }

  return new GoogleCalendarService(config);
};