import { supabase } from './supabase';

// Webhook integration for n8n automation
export const sendWebhookToN8n = async (eventType: string, data: any) => {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.warn('N8N webhook URL not configured');
    return;
  }

  const payload = {
    eventType,
    timestamp: new Date().toISOString(),
    data,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Log webhook call
    await supabase.from('webhook_logs').insert({
      event_type: eventType,
      payload,
      response: await response.json(),
      status: response.ok ? 'success' : 'failed',
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send webhook:', error);
    
    // Log failed webhook
    await supabase.from('webhook_logs').insert({
      event_type: eventType,
      payload,
      status: 'failed',
    });

    return false;
  }
};

// Google Calendar integration
export const createGoogleCalendarEvent = async (event: any) => {
  // This would integrate with Google Calendar API
  // For now, we'll simulate the integration
  console.log('Creating Google Calendar event:', event);
  
  // Return a mock event ID
  return `gcal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// FTP monitoring (would be implemented in a separate service)
export const startFTPMonitoring = async (photographerId: string, eventId: string) => {
  // This would start monitoring the FTP folder for new photos
  console.log('Starting FTP monitoring for event:', eventId);
  
  // In a real implementation, this would:
  // 1. Connect to FTP server
  // 2. Monitor specified folder
  // 3. Process new images (resize, watermark, etc.)
  // 4. Save to database and file system
};

// Photo processing utilities
export const processPhotoUpload = async (photoFile: File, albumId: string) => {
  // This would handle photo processing:
  // 1. Generate thumbnail
  // 2. Apply watermark
  // 3. Extract metadata
  // 4. Save to storage
  
  const photoId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: photoId,
    albumId,
    filename: photoFile.name,
    originalPath: `/photos/original/${photoId}`,
    thumbnailPath: `/photos/thumbnails/${photoId}`,
    watermarkedPath: `/photos/watermarked/${photoId}`,
    isSelected: false,
    price: 25.00, // Default price
    metadata: {
      width: 4000,
      height: 3000,
      size: photoFile.size,
      format: photoFile.type,
    },
  };
};

// Payment processing
export const createPaymentIntent = async (amount: number, eventId: string) => {
  // This would integrate with payment provider (Stripe, MercadoPago, etc.)
  console.log('Creating payment intent for amount:', amount);
  
  return {
    clientSecret: `pi_${Date.now()}_secret`,
    paymentIntentId: `pi_${Date.now()}`,
  };
};