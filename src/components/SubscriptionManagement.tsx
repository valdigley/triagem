import React, { useState, useEffect } from 'react';
import { Users, CreditCard, Calendar, DollarSign, Eye, RefreshCw, Crown, Clock, CheckCircle, X, MessageCircle, Mail, AlertTriangle } from 'lucide-react';
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
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null);
  const [creatingSubscription, setCreatingSubscription] = useState<string | null>(null);
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
      // Buscar todas as assinaturas
      const { data: subscriptionsData, error } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading subscriptions:', error);
        toast.error('Erro ao carregar assinaturas');
        return;
      }

      // Buscar dados dos usuários via Edge Function
      const userIds = subscriptionsData.map(sub => sub.user_id);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-users-by-ids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ user_ids: userIds }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error fetching users:', errorData);
        toast.error('Erro ao carregar dados dos usuários');
        return;
      }

      const { users } = await response.json();
      
      // Combinar dados de subscriptions com dados dos usuários
      const processedSubscriptions = subscriptionsData.map(sub => {
        const userData = users.find((u: any) => u.id === sub.user_id);
        return {
          ...sub,
          user: {
            email: userData?.email || 'Email não encontrado',
            name: userData?.name || 'Nome não encontrado',
          }
        };
      });

      setSubscriptions(processedSubscriptions);

      // Calcular estatísticas
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const stats = {
        totalUsers: processedSubscriptions.length,
        activeSubscriptions: processedSubscriptions.filter(s => {
          const expiresAt = s.expires_at ? new Date(s.expires_at) : null;
          return s.status === 'active' && 
                 s.plan_type !== 'master' && 
                 (!expiresAt || expiresAt > now);
        }).length,
        trialUsers: processedSubscriptions.filter(s => s.plan_type === 'trial').length,
        expiredUsers: processedSubscriptions.filter(s => {
          const expiresAt = s.expires_at ? new Date(s.expires_at) : new Date(s.trial_end_date);
          return s.status === 'active' && 
                 s.plan_type !== 'master' && 
                 expiresAt <= now;
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
          <AlertTriangle className="w-3 h-3" />
          {subscription.plan_type === 'trial' ? 'Teste Expirado' : 'Assinatura Expirada'}
        </span>
      );
    }

    if (subscription.plan_type === 'trial') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
          <Clock className="w-3 h-3" />
          Teste Ativo
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3" />
        Assinatura Ativa
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

  const sendWhatsAppMessage = async (subscription: UserSubscription) => {
    if (!subscription.user?.name) {
      toast.error('Nome do usuário não encontrado');
      return;
    }

    setSendingWhatsApp(subscription.id);
    
    try {
      // Buscar dados do fotógrafo para obter telefone
      const { data: photographer } = await supabase
        .from('photographers')
        .select('phone')
        .eq('user_id', subscription.user_id)
        .single();

      if (!photographer?.phone) {
        toast.error('Telefone do cliente não encontrado');
        return;
      }

      const now = new Date();
      const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : new Date(subscription.trial_end_date);
      const isExpired = expiresAt <= now;
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let message = `Olá ${subscription.user.name}! 👋\n\n`;
      
      if (subscription.plan_type === 'master') {
        message += `Você tem acesso Master ao sistema Triagem! 👑\n\nQualquer dúvida, estou à disposição.`;
      } else if (isExpired) {
        if (subscription.plan_type === 'trial') {
          message += `Seu período de teste de 7 dias expirou. 😔\n\nPara continuar usando o sistema Triagem, assine nosso plano mensal por apenas R$ 30,00.\n\n✅ Agendamentos ilimitados\n✅ Álbuns e fotos ilimitados\n✅ Sistema de pagamento integrado\n✅ Suporte técnico\n\nGostaria de assinar?`;
        } else {
          message += `Sua assinatura do sistema Triagem expirou. 😔\n\nRenove agora por R$ 30,00/mês para continuar aproveitando todos os recursos.\n\nPrecisa de ajuda?`;
        }
      } else {
        if (subscription.plan_type === 'trial') {
          message += `Você tem ${Math.max(0, daysRemaining)} dias restantes no seu teste gratuito do sistema Triagem! ⏰\n\nEstá gostando da experiência? Assine nosso plano mensal por R$ 30,00 e continue aproveitando todos os recursos.\n\nPrecisa de ajuda ou tem alguma dúvida?`;
        } else {
          message += `Sua assinatura do sistema Triagem está ativa! ✅\n\nExpira em ${Math.max(0, daysRemaining)} dias.\n\nComo posso ajudá-lo hoje?`;
        }
      }

      // Limpar telefone e adicionar código do país
      const cleanPhone = photographer.phone.replace(/\D/g, '');
      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      
      const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      
      toast.success('Abrindo WhatsApp...');
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast.error('Erro ao abrir WhatsApp');
    } finally {
      setSendingWhatsApp(null);
    }
  };

  const createSubscriptionForUser = async (subscription: UserSubscription) => {
    if (!subscription.user?.name || !subscription.user?.email) {
      toast.error('Dados do usuário incompletos');
      return;
    }

    setCreatingSubscription(subscription.id);

    try {
      // Buscar configuração do Mercado Pago
      const { data: photographer } = await supabase
        .from('photographers')
        .select('watermark_config')
        .limit(1)
        .single();

      const mercadoPagoToken = photographer?.watermark_config?.mercadoPagoAccessToken;

      if (!mercadoPagoToken) {
        toast.error('Mercado Pago não configurado. Configure em Configurações.');
        return;
      }

      console.log('Creating subscription payment for user:', subscription.user.name);
      
      // Criar pagamento via edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          user_id: subscription.user_id,
          subscription_id: subscription.id,
          amount: 30.00,
          access_token: mercadoPagoToken,
          client_name: subscription.user.name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Subscription payment error:', errorData);
        toast.error(errorData.error || 'Erro ao processar pagamento');
        return;
      }

      const paymentData = await response.json();
      console.log('Payment data received:', paymentData);
      
      if (paymentData.qr_code) {
        // Abrir modal de pagamento
        const paymentWindow = window.open('', '_blank', 'width=600,height=800');
        if (paymentWindow) {
          paymentWindow.document.write(`
            <html>
              <head>
                <title>Assinatura - ${subscription.user.name}</title>
                <style>
                  body { font-family: Arial, sans-serif; text-align: center; padding: 20px; background: #f5f5f5; }
                  .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                  .qr-code { margin: 20px 0; }
                  .qr-code img { max-width: 300px; border: 2px solid #ddd; border-radius: 8px; }
                  .pix-code { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
                  .pix-code textarea { width: 100%; height: 80px; font-family: monospace; font-size: 12px; border: 1px solid #ddd; border-radius: 4px; padding: 10px; }
                  .copy-btn { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 10px; }
                  .copy-btn:hover { background: #0056b3; }
                  .client-info { background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h2>🎯 Assinatura do Sistema Triagem</h2>
                  
                  <div class="client-info">
                    <h3>👤 Cliente: ${subscription.user.name}</h3>
                    <p>📧 ${subscription.user.email}</p>
                    <p><strong>💰 Valor: R$ 30,00/mês</strong></p>
                  </div>
                  
                  <p>Escaneie o QR Code para ativar a assinatura:</p>
                  
                  ${paymentData.qr_code_base64 ? `
                    <div class="qr-code">
                      <img src="data:image/png;base64,${paymentData.qr_code_base64}" alt="QR Code PIX">
                    </div>
                  ` : ''}
                  
                  <p>Ou copie o código PIX:</p>
                  <div class="pix-code">
                    <textarea readonly id="pixCode">${paymentData.qr_code || ''}</textarea>
                    <button class="copy-btn" onclick="copyPix()">📋 Copiar Código PIX</button>
                  </div>
                  
                  <p><small>⏱️ Após o pagamento, a assinatura será ativada automaticamente.</small></p>
                  
                  <script>
                    function copyPix() {
                      const textarea = document.getElementById('pixCode');
                      textarea.select();
                      document.execCommand('copy');
                      alert('Código PIX copiado!');
                    }
                  </script>
                </div>
              </body>
            </html>
          `);
        }
        
        toast.success(`PIX gerado para ${subscription.user.name}! Janela de pagamento aberta.`);
      } else {
        toast.error('Erro ao gerar PIX para pagamento');
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
      toast.error(`Erro ao processar assinatura: ${error.message}`);
    } finally {
      setCreatingSubscription(null);
    }
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
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
                    <div>
                      <div className="font-medium">
                        {getDaysRemaining(subscription)} dias
                      </div>
                      {(() => {
                        const now = new Date();
                        const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : new Date(subscription.trial_end_date);
                        const isExpired = expiresAt <= now;
                        
                        if (isExpired) {
                          return (
                            <div className="text-xs text-red-600 font-medium">
                              Expirou em {format(expiresAt, "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                          );
                        } else {
                          return (
                            <div className="text-xs text-gray-400">
                              Expira em {format(expiresAt, "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                          );
                        }
                      })()}
                    </div>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      {/* WhatsApp */}
                      <button
                        onClick={() => sendWhatsAppMessage(subscription)}
                        disabled={sendingWhatsApp === subscription.id}
                        className="flex items-center gap-1 px-3 py-1 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Enviar mensagem via WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                        {sendingWhatsApp === subscription.id ? 'Enviando...' : 'WhatsApp'}
                      </button>
                      
                      {/* Criar Assinatura - apenas para usuários sem assinatura ativa */}
                      {/* Apenas visualização no master - sem botão de pagamento */}
                      <button
                        className="flex items-center gap-1 px-3 py-1 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Visualizar detalhes"
                      >
                        <Eye className="w-4 h-4" />
                        Ver Detalhes
                      </button>
                    </div>
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