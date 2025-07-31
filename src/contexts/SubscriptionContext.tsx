import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { Subscription } from '../types/subscription';
import toast from 'react-hot-toast';

interface SubscriptionContextType {
  subscription: Subscription | null;
  hasActiveAccess: boolean;
  isMasterUser: boolean;
  isTrialExpired: boolean;
  daysRemaining: number;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
  upgradeSubscription: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const isMasterUser = user?.email === 'valdigley2007@gmail.com';

  useEffect(() => {
    if (user) {
      loadSubscription();
    } else {
      setSubscription(null);
      setLoading(false);
    }
  }, [user]);

  const loadSubscription = async () => {
    if (!user) return;

    try {
      // Verificar se as variáveis de ambiente estão configuradas
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        console.error('Supabase environment variables not configured');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading subscription:', error);
        setLoading(false);
        return;
      }

      setSubscription(data);
    } catch (error) {
      console.error('Error loading subscription:', error);
      // Se for erro de rede/fetch, não mostrar erro para o usuário
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.warn('Network error loading subscription - Supabase may not be configured');
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshSubscription = async () => {
    await loadSubscription();
  };

  const upgradeSubscription = async (): Promise<boolean> => {
    if (!user || !subscription) return false;

    try {
      // Criar pagamento para upgrade
      const { data: photographer } = await supabase
        .from('photographers')
        .select('watermark_config')
        .eq('user_id', user.id)
        .maybeSingle();

      const mercadoPagoToken = photographer?.watermark_config?.mercadoPagoAccessToken;

      if (!mercadoPagoToken) {
        toast.error('Sistema de pagamento não configurado');
        return false;
      }

      // Criar pagamento via edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          subscription_id: subscription.id,
          amount: 30.00,
          access_token: mercadoPagoToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erro ao processar pagamento');
        return false;
      }

      const paymentData = await response.json();
      
      if (paymentData.qr_code) {
        // Mostrar QR code para pagamento
        // Implementar modal de pagamento aqui
        toast.success('PIX gerado! Complete o pagamento para ativar sua assinatura.');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      toast.error('Erro ao processar upgrade');
      return false;
    }
  };

  // Calcular status de acesso
  const hasActiveAccess = (() => {
    if (isMasterUser) return true;
    if (!subscription) return false;
    
    const now = new Date();
    const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
    
    return subscription.status === 'active' && (!expiresAt || expiresAt > now);
  })();

  const isTrialExpired = (() => {
    if (isMasterUser || !subscription) return false;
    
    const now = new Date();
    const trialEnd = new Date(subscription.trial_end_date);
    
    return subscription.plan_type === 'trial' && now > trialEnd;
  })();

  const daysRemaining = (() => {
    if (isMasterUser) return 999;
    if (!subscription) return 0;
    
    const now = new Date();
    const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : new Date(subscription.trial_end_date);
    const diffTime = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  })();

  return (
    <SubscriptionContext.Provider value={{
      subscription,
      hasActiveAccess,
      isMasterUser,
      isTrialExpired,
      daysRemaining,
      loading,
      refreshSubscription,
      upgradeSubscription,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};