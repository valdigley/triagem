import React, { useState, useEffect } from 'react';
import { Users, CreditCard, Calendar, DollarSign, Eye, RefreshCw, Crown, Clock, CheckCircle, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { useSubscription } from '../contexts/SubscriptionContext';
import toast from 'react-hot-toast';

interface UserSubscription {
  id: string;
  user_id: string;
  plan_type: 'trial' | 'paid' | 'master';
  status: 'active' | 'expired' | 'cancelled' | 'pending_payment';
  trial_start_date: string;
  trial_end_date: string;
  payment_date?: string;
  payment_amount?: number;
  expires_at?: string;
  created_at: string;
  user?: {
    email: string;
    name: string;
  };
}

const SubscriptionManagement: React.FC = () => {
  const { isMasterUser } = useSubscription();
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    trialUsers: 0,
    expiredUsers: 0,
    monthlyRevenue: 0,
  });

  useEffect(() => {
    if (isMasterUser) {
      loadSubscriptions();
    }
  }, [isMasterUser]);

  const loadSubscriptions = async () => {
    try {
      // Buscar todas as assinaturas com dados do usuário
      const { data: subscriptionsData, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          users:user_id (
            email,
            raw_user_meta_data
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading subscriptions:', error);
        toast.error('Erro ao carregar assinaturas');
        return;
      }

      // Processar dados
      const processedSubscriptions = subscriptionsData.map(sub => ({
        ...sub,
        user: {
          email: sub.users?.email || 'Email não encontrado',
          name: sub.users?.raw_user_meta_data?.name || 'Nome não encontrado',
        }
      }));

      setSubscriptions(processedSubscriptions);

      // Calcular estatísticas
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const stats = {
        totalUsers: processedSubscriptions.length,
        activeSubscriptions: processedSubscriptions.filter(s => {
          const expiresAt = s.expires_at ? new Date(s.expires_at) : null;
          return s.status === 'active' && (!expiresAt || expiresAt > now);
        }).length,
        trialUsers: processedSubscriptions.filter(s => s.plan_type === 'trial').length,
        expiredUsers: processedSubscriptions.filter(s => {
          const expiresAt = s.expires_at ? new Date(s.expires_at) : new Date(s.trial_end_date);
          return s.status === 'active' && expiresAt <= now;
        }).length,
        monthlyRevenue: 0, // Será calculado dos pagamentos
      };

      setStats(stats);

    } catch (error) {
      console.error('Error loading subscriptions:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (subscription: UserSubscription) => {
    const now = new Date();
    const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : new Date(subscription.trial_end_date);
    const isExpired = expiresAt <= now;

    if (subscription.plan_type === 'master') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full bg-yellow-100 text-yellow-800">
          <Crown className="w-3 h-3" />
          Master
        </span>
      );
    }

    if (isExpired) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-800">
          <X className="w-3 h-3" />
          Expirado
        </span>
      );
    }

    if (subscription.plan_type === 'trial') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
          <Clock className="w-3 h-3" />
          Teste
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3" />
        Ativo
      </span>
    );
  };

  const getDaysRemaining = (subscription: UserSubscription) => {
    const now = new Date();
    const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : new Date(subscription.trial_end_date);
    const diffTime = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (subscription.plan_type === 'master') return '∞';
    return Math.max(0, diffDays).toString();
  };

  if (!isMasterUser) {
    return (
      <div className="text-center py-12">
        <Crown className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Acesso Restrito</h3>
        <p className="text-gray-600">Apenas o usuário master pode acessar esta seção</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Carregando assinaturas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Assinaturas</h1>
          <p className="text-gray-600">Controle de usuários e assinaturas do sistema</p>
        </div>
        <button
          onClick={loadSubscriptions}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Usuários</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Assinaturas Ativas</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeSubscriptions}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Usuários em Teste</p>
              <p className="text-2xl font-bold text-blue-600">{stats.trialUsers}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Receita Mensal</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {(stats.activeSubscriptions * 30).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Lista de Usuários</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plano
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dias Restantes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data de Cadastro
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Último Pagamento
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subscriptions.map((subscription) => (
                <tr key={subscription.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {subscription.user?.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {subscription.user?.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 capitalize">
                      {subscription.plan_type === 'master' ? 'Master' : 
                       subscription.plan_type === 'trial' ? 'Teste Gratuito' : 
                       'Plano Pago'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(subscription)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getDaysRemaining(subscription)} dias
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(subscription.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {subscription.payment_date ? (
                      <div>
                        <div>{format(new Date(subscription.payment_date), "dd/MM/yyyy", { locale: ptBR })}</div>
                        <div className="text-xs text-green-600">
                          R$ {subscription.payment_amount?.toFixed(2)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManagement;