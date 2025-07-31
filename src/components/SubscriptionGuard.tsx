import React from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { CreditCard, Clock, Crown, CheckCircle, X } from 'lucide-react';

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children }) => {
  const { 
    hasActiveAccess, 
    subscription,
    isMasterUser,
    isTrialExpired, 
    daysRemaining, 
    loading,
    upgradeSubscription 
  } = useSubscription();

  const expiresAt = subscription?.plan_type === 'trial' 
    ? new Date(subscription.trial_end_date)
    : subscription?.expires_at 
    ? new Date(subscription.expires_at) 
    : subscription?.trial_end_date 
    ? new Date(subscription.trial_end_date)
    : null;

  const handleUpgradeClick = async () => {
    console.log('Upgrade button clicked');
    const success = await upgradeSubscription();
    if (success) {
      console.log('Upgrade process started successfully');
    } else {
      console.log('Upgrade process failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (hasActiveAccess) {
    return <>{children}</>;
  }

  // Usuário sem acesso ativo
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          {isMasterUser ? (
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Crown className="w-8 h-8 text-yellow-600" />
            </div>
          ) : isTrialExpired ? (
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          )}
        {!isMasterUser && !hasActiveAccess && (
          <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isMasterUser ? 'Conta Master' : isTrialExpired ? 'Período de Teste Expirado' : 'Acesso Limitado'}
          </h1>

          <p className="text-gray-600 mb-6">
            {isMasterUser 
              ? 'Você tem acesso total ao sistema'
              : isTrialExpired 
              ? 'Seu período de teste de 7 dias expirou. Assine para continuar usando o sistema.'
              : `Você tem ${daysRemaining} dias restantes no seu período de teste.`
            }
          </p>

          {!isMasterUser && (
            <div className="bg-blue-50 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">📸 Sistema de Seleção de Fotos</h3>
              <div className="text-left space-y-2 text-sm text-blue-800">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Agendamentos ilimitados</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Álbuns e fotos ilimitados</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Sistema de pagamento integrado</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Integração Google Calendar</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>API para automação (n8n)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Acesso FTP automático</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Suporte técnico</span>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-900 mb-1">R$ 30,00</p>
                  <p className="text-sm text-blue-700">por mês</p>
                </div>
              </div>
            </div>
          )}

          {!isMasterUser && (
            <button
              onClick={handleUpgradeClick}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <CreditCard className="w-5 h-5" />
              {isTrialExpired ? 'Assinar Agora' : 'Assinar e Continuar'}
            </button>
          )}

          {!isTrialExpired && !isMasterUser && (
            <p className="text-xs text-gray-500 mt-4">
              Você ainda pode usar o sistema por {daysRemaining} dias
            </p>
          )}
          </div>
        )}
        {!isMasterUser && hasActiveAccess && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Assinatura Ativa</h2>
            <p className="text-gray-600 mb-4">
              Você tem acesso completo ao sistema por mais {daysRemaining} dias.
            </p>
            <button
              onClick={handleUpgradeClick}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <CreditCard className="w-5 h-5" />
              Renovar Assinatura
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionGuard;