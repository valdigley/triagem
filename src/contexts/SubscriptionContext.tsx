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

  const isMasterUser = user?.email === 'valdigley2007@gmail.com' || user?.email === 'master@triagem.com';

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
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading subscription:', error);
        
        // Se não existe subscription, criar uma nova
        if (error.code === 'PGRST116' || error.message.includes('No rows found')) {
          console.log('Creating new subscription for user:', user.id);
          await createNewSubscription();
          return;
        }
        
        setLoading(false);
        return;
      }

      // Se não existe subscription, criar uma nova
      if (!data) {
        console.log('No subscription found, creating new one for user:', user.id);
        await createNewSubscription();
        return;
      }

      setSubscription(data);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan_type: 'trial',
          status: 'active',
          trial_start_date: new Date().toISOString(),
          trial_end_date: new Date().toISOString(), // 0 dias
          expires_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating subscription:', error);
        return;
      }

      console.log('New subscription created:', data.id);
      setSubscription(data);
    } catch (error) {
      console.error('Error creating new subscription:', error);
    }
  };

  const refreshSubscription = async () => {
    await loadSubscription();
  };

  const upgradeSubscription = async (): Promise<boolean> => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return false;
    }

    if (!subscription) {
      toast.error('Subscription não encontrada');
      return false;
    }

    try {
      console.log('Starting subscription upgrade process...');
      
      // Criar pagamento para upgrade
      const { data: photographer } = await supabase
        .from('photographers')
        .select('watermark_config')
        .eq('user_id', user.id)
        .maybeSingle();

      const mercadoPagoToken = photographer?.watermark_config?.mercadoPagoAccessToken;

      if (!mercadoPagoToken) {
        toast.error('Sistema de pagamento não configurado. Configure o Mercado Pago em Configurações.');
        return false;
      }

      console.log('Creating subscription payment...');
      
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

      console.log('Subscription payment response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Subscription payment error:', errorData);
        toast.error(errorData.error || 'Erro ao processar pagamento');
        return false;
      }

      const paymentData = await response.json();
      console.log('Payment data received:', paymentData);
      
      if (paymentData.qr_code) {
        // Abrir modal ou página de pagamento
        const paymentWindow = window.open('', '_blank', 'width=600,height=800');
        if (paymentWindow) {
          paymentWindow.document.write(`
            <html>
              <head><title>Pagamento da Assinatura</title></head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                <h2>Finalize sua Assinatura</h2>
                <p>Escaneie o QR Code para pagar R$ 30,00</p>
                ${paymentData.qr_code_base64 ? `<img src="data:image/png;base64,${paymentData.qr_code_base64}" style="max-width: 300px;">` : ''}
                <p>Ou copie o código PIX:</p>
                <textarea readonly style="width: 100%; height: 100px; font-family: monospace;">${paymentData.qr_code || ''}</textarea>
                <p><small>Após o pagamento, sua assinatura será ativada automaticamente.</small></p>
              </body>
            </html>
          `);
        }
        
        toast.success('PIX gerado! Complete o pagamento na nova janela para ativar sua assinatura.');
        return true;
      } else {
        toast.error('Erro ao gerar PIX para pagamento');
        return false;
      }
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      toast.error(`Erro ao processar upgrade: ${error.message}`);
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