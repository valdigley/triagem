export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          phone: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          phone?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      photographers: {
        Row: {
          id: string;
          user_id: string;
          business_name: string;
          phone: string;
          google_calendar_id: string | null;
          ftp_config: any | null;
          watermark_config: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          business_name: string;
          phone: string;
          google_calendar_id?: string | null;
          ftp_config?: any | null;
          watermark_config?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          business_name?: string;
          phone?: string;
          google_calendar_id?: string | null;
          ftp_config?: any | null;
          watermark_config?: any | null;
          created_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          photographer_id: string;
          client_name: string;
          client_email: string;
          client_phone: string;
          session_type: string | null;
          event_date: string;
          location: string;
          notes: string | null;
          status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
          google_calendar_event_id: string | null;
          album_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          photographer_id: string;
          client_name: string;
          client_email: string;
          client_phone: string;
          session_type?: string | null;
          event_date: string;
          location: string;
          notes?: string | null;
          status?: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
          google_calendar_event_id?: string | null;
          album_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          photographer_id?: string;
          client_name?: string;
          client_email?: string;
          client_phone?: string;
          session_type?: string | null;
          event_date?: string;
          location?: string;
          notes?: string | null;
          status?: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
          google_calendar_event_id?: string | null;
          album_id?: string | null;
          created_at?: string;
        };
      };
      albums: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          share_token: string;
          is_active: boolean;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          share_token?: string;
          is_active?: boolean;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          name?: string;
          share_token?: string;
          is_active?: boolean;
          expires_at?: string | null;
          created_at?: string;
        };
      };
      photos: {
        Row: {
          id: string;
          album_id: string;
          filename: string;
          original_path: string;
          thumbnail_path: string;
          watermarked_path: string;
          is_selected: boolean;
          price: number;
          metadata: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          album_id: string;
          filename: string;
          original_path: string;
          thumbnail_path: string;
          watermarked_path: string;
          is_selected?: boolean;
          price?: number;
          metadata?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          album_id?: string;
          filename?: string;
          original_path?: string;
          thumbnail_path?: string;
          watermarked_path?: string;
          is_selected?: boolean;
          price?: number;
          metadata?: any | null;
          created_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          event_id: string;
          client_email: string;
          selected_photos: string[];
          total_amount: number;
          status: 'pending' | 'paid' | 'cancelled' | 'expired';
          payment_intent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          client_email: string;
          selected_photos: string[];
          total_amount: number;
          status?: 'pending' | 'paid' | 'cancelled' | 'expired';
          payment_intent_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          client_email?: string;
          selected_photos?: string[];
          total_amount?: number;
          status?: 'pending' | 'paid' | 'cancelled' | 'expired';
          payment_intent_id?: string | null;
          created_at?: string;
        };
      };
      webhook_logs: {
        Row: {
          id: string;
          event_type: string;
          payload: any;
          response: any | null;
          status: 'success' | 'failed';
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          payload: any;
          response?: any | null;
          status: 'success' | 'failed';
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          payload?: any;
          response?: any | null;
          status?: 'success' | 'failed';
          created_at?: string;
        };
      };
    };
    subscriptions: {
      Row: {
        id: string;
        user_id: string;
        plan_type: 'trial' | 'paid' | 'master';
        status: 'active' | 'expired' | 'cancelled' | 'pending_payment';
        trial_start_date: string;
        trial_end_date: string;
        payment_date: string | null;
        payment_amount: number | null;
        payment_intent_id: string | null;
        expires_at: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        user_id: string;
        plan_type?: 'trial' | 'paid' | 'master';
        status?: 'active' | 'expired' | 'cancelled' | 'pending_payment';
        trial_start_date?: string;
        trial_end_date?: string;
        payment_date?: string | null;
        payment_amount?: number | null;
        payment_intent_id?: string | null;
        expires_at?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        user_id?: string;
        plan_type?: 'trial' | 'paid' | 'master';
        status?: 'active' | 'expired' | 'cancelled' | 'pending_payment';
        trial_start_date?: string;
        trial_end_date?: string;
        payment_date?: string | null;
        payment_amount?: number | null;
        payment_intent_id?: string | null;
        expires_at?: string | null;
        created_at?: string;
        updated_at?: string;
      };
    };
    subscription_plans: {
      Row: {
        id: string;
        name: string;
        price: number;
        duration_days: number;
        features: string[];
        is_active: boolean;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        name: string;
        price?: number;
        duration_days?: number;
        features?: string[];
        is_active?: boolean;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        name?: string;
        price?: number;
        duration_days?: number;
        features?: string[];
        is_active?: boolean;
        created_at?: string;
        updated_at?: string;
      };
    };
    api_access: {
      Row: {
        id: string;
        user_id: string;
        api_key: string;
        webhook_url: string | null;
        ftp_config: any | null;
        rate_limit: number;
        created_at: string;
        last_used_at: string | null;
      };
      Insert: {
        id?: string;
        user_id: string;
        api_key?: string;
        webhook_url?: string | null;
        ftp_config?: any | null;
        rate_limit?: number;
        created_at?: string;
        last_used_at?: string | null;
      };
      Update: {
        id?: string;
        user_id?: string;
        api_key?: string;
        webhook_url?: string | null;
        ftp_config?: any | null;
        rate_limit?: number;
        created_at?: string;
        last_used_at?: string | null;
      };
    };
    payment_transactions: {
      Row: {
        id: string;
        user_id: string;
        subscription_id: string | null;
        amount: number;
        payment_method: string;
        payment_intent_id: string | null;
        status: string;
        metadata: any | null;
        created_at: string;
      };
      Insert: {
        id?: string;
        user_id: string;
        subscription_id?: string | null;
        amount: number;
        payment_method?: string;
        payment_intent_id?: string | null;
        status?: string;
        metadata?: any | null;
        created_at?: string;
      };
      Update: {
        id?: string;
        user_id?: string;
        subscription_id?: string | null;
        amount?: number;
        payment_method?: string;
        payment_intent_id?: string | null;
        status?: string;
        metadata?: any | null;
        created_at?: string;
      };
    };
  };
}