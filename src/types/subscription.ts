export interface Subscription {
  id: string;
  user_id: string;
  plan_type: 'trial' | 'paid' | 'master';
  status: 'active' | 'expired' | 'cancelled';
  trial_start_date: string;
  trial_end_date: string;
  payment_date?: string;
  payment_amount?: number;
  payment_intent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  features: string[];
  is_active: boolean;
}

export interface ApiAccess {
  id: string;
  user_id: string;
  api_key: string;
  webhook_url?: string;
  ftp_config?: {
    host: string;
    username: string;
    password: string;
    port: number;
    monitor_path: string;
    auto_upload: boolean;
  };
  rate_limit: number;
  created_at: string;
  last_used_at?: string;
}