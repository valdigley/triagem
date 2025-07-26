export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'photographer' | 'client';
  avatar?: string;
  createdAt: Date;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Photographer {
  id: string;
  userId: string;
  businessName: string;
  phone: string;
  googleCalendarId?: string;
  ftpConfig?: FTPConfig;
  watermarkConfig?: WatermarkConfig;
  user?: User;
}

export interface FTPConfig {
  host: string;
  username: string;
  password: string;
  monitorPath: string;
  port?: number;
}

export interface WatermarkConfig {
  text: string;
  opacity: number;
  position: 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  fontSize: number;
  color: string;
}

export interface Event {
  id: string;
  photographerId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  sessionType?: string;
  eventDate: Date;
  location: string;
  notes?: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  googleCalendarEventId?: string;
  albumId?: string;
  createdAt: Date;
  photographer?: Photographer;
  album?: Album;
}

export interface Album {
  id: string;
  eventId: string;
  name: string;
  shareToken: string;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  event?: Event;
  photos?: Photo[];
}

export interface Photo {
  id: string;
  albumId: string;
  filename: string;
  originalPath: string;
  thumbnailPath: string;
  watermarkedPath: string;
  isSelected: boolean;
  price: number;
  metadata?: PhotoMetadata;
  createdAt: Date;
  album?: Album;
}

export interface PhotoMetadata {
  width: number;
  height: number;
  size: number;
  format: string;
  camera?: string;
  lens?: string;
  settings?: {
    iso?: number;
    aperture?: string;
    shutterSpeed?: string;
    focalLength?: string;
  };
}

export interface Order {
  id: string;
  eventId: string;
  clientEmail: string;
  selectedPhotos: string[];
  totalAmount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  paymentIntentId?: string;
  createdAt: Date;
  event?: Event;
}

export interface WebhookLog {
  id: string;
  eventType: string;
  payload: any;
  response?: any;
  status: 'success' | 'failed';
  createdAt: Date;
}

export interface NotificationTemplate {
  id: string;
  photographerId: string;
  name: string;
  type: 'booking_confirmation' | 'album_ready' | 'selection_reminder' | 'payment_confirmation';
  message: string;
  isActive: boolean;
  createdAt: Date;
}