import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { supabase } from '../lib/supabase';
import { Crown, Clock, CheckCircle, XCircle, RefreshCw, CreditCard, AlertTriangle, User, Calendar, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

const SubscriptionTest: React.FC = () => {
  const { user } = useAuth();
  const { 
    subscription, 
    hasActiveAccess, 
    isMasterUser, 
    isTrialExpired, 
    daysRemaining, 
    loading,
    refreshSubscription,
    upgradeSubscription 
  } = useSubscription();
  
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [paymentTransactions, setPaymentTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadDetailedData();
    }
  }, [user]);

  const loadDetailedData = async () => {
    try {
      // Carregar dados detalhados da subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      setSubscriptionData(subData);

      // Carregar transações de pagamento
      const { data: transactions } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      setPaymentTransactions(transactions || []);
    } catch (error) {
      console.error('Error loading detailed data:', error);
    }
  };

  const runTests = async () => {
    setTesting(true);
    const results: any[] = [];

    try {
      // Teste 1: Verificar se usuário existe
      results.push({
        test: 'Usuário Autenticado',
        status: user ? 'PASS' : 'FAIL',
        details: user ? `ID: ${user.id}, Email: ${user.email}` : 'Usuário não encontrado',
        icon: user ? CheckCircle : XCircle,
        color: user ? 'text-green-600' : 'text-red-600'
      });

      // Teste 2: Verificar subscription
      results.push({
        test: 'Subscription Existe',
        status: subscription ? 'PASS' : 'FAIL',
        details: subscription ? `ID: ${subscription.id}, Tipo: ${subscription.plan_type}` : 'Subscription não encontrada',
        icon: subscription ? CheckCircle : XCircle,
        color: subscription ? 'text-green-600' : 'text-red-600'
      });

      // Teste 3: Verificar acesso ativo
      results.push({
        test: 'Acesso Ativo',
        status: hasActiveAccess ? 'PASS' : 'FAIL',
        details: hasActiveAccess ? 'Usuário tem acesso ao sistema' : 'Acesso negado',
        icon: hasActiveAccess ? CheckCircle : XCircle,
        color: hasActiveAccess ? 'text-green-600' : 'text-red-600'
      });

      // Teste 4: Verificar se é master
      results.push({
        test: 'Usuário Master',
        status: isMasterUser ? 'PASS' : 'INFO',
        details: isMasterUser ? 'Usuário tem privilégios master' : 'Usuário comum',
        icon: isMasterUser ? Crown : User,
        color: isMasterUser ? 'text-yellow-600' : 'text-blue-600'
      });

      // Teste 5: Verificar expiração
      results.push({
        test: 'Status de Expiração',
        status: isTrialExpired ? 'FAIL' : 'PASS',
        details: isTrialExpired ? 'Período expirado' : `${daysRemaining} dias restantes`,
        icon: isTrialExpired ? AlertTriangle : Clock,
        color: isTrialExpired ? 'text-red-600' : 'text-green-600'
      });

      // Teste 6: Verificar configuração do Mercado Pago
      const { data: photographer } = await supabase
        .from('photographers')
        .select('watermark_config')
        .eq('user_id', user?.id)
        .single();

      const hasMercadoPago = photographer?.watermark_config?.mercadoPagoAccessToken;
      results.push({
        test: 'Mercado Pago Configurado',
        status: hasMercadoPago ? 'PASS' : 'WARN',
        details: hasMercadoPago ? 'Token configurado' : 'Token não configurado',
        icon: hasMercadoPago ? CheckCircle : AlertTriangle,
        color: hasMercadoPago ? 'text-green-600' : 'text-yellow-600'
      });

      // Teste 7: Verificar edge functions
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ test: true }),
        });

        results.push({
          test: 'Edge Functions Disponíveis',
          status: response.status === 400 ? 'PASS' : 'WARN', // 400 é esperado para teste
          details: `Status: ${response.status}`,
          icon: response.status === 400 ? CheckCircle : AlertTriangle,
          color: response.status === 400 ? 'text-green-600' : 'text-yellow-600'
        });
      } catch (error) {
        results.push({
          test: 'Edge Functions Disponíveis',
          status: 'FAIL',
          details: 'Erro de conexão com edge functions',
          icon: XCircle,
          color: 'text-red-600'
        });
      }

      setTestResults(results);
    } catch (error) {
      console.error('Error running tests:', error);
      toast.error('Erro ao executar testes');
    } finally {
      setTesting(false);
    }
  };

  const testUpgrade = async () => {
    const success = await upgradeSubscription();
    if (success) {
      toast.success('Teste de upgrade iniciado!');
      setTimeout(() => {
        refreshSubscription();
        loadDetailedData();
      }, 2000);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🧪 Teste de Assinaturas</h1>
          <p className="text-gray-600">Verificar se o sistema de assinaturas está funcionando corretamente</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              refreshSubscription();
              loadDetailedData();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar Dados
          </button>
          <button
            onClick={runTests}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {testing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {testing ? 'Testando...' : 'Executar Testes'}
          </button>
        </div>
      </div>

      {/* Status Atual */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Status de Acesso</p>
              <p className={`text-lg font-bold ${hasActiveAccess ? 'text-green-600' : 'text-red-600'}`}>
                {hasActiveAccess ? 'ATIVO' : 'INATIVO'}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${hasActiveAccess ? 'bg-green-50' : 'bg-red-50'}`}>
              {hasActiveAccess ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tipo de Plano</p>
              <p className="text-lg font-bold text-gray-900 capitalize">
                {subscription?.plan_type || 'N/A'}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              {isMasterUser ? (
                <Crown className="w-6 h-6 text-yellow-600" />
              ) : (
                <User className="w-6 h-6 text-blue-600" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Dias Restantes</p>
              <p className={`text-lg font-bold ${daysRemaining > 3 ? 'text-green-600' : 'text-red-600'}`}>
                {isMasterUser ? '∞' : daysRemaining}
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
              <p className={`text-lg font-bold ${subscription?.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                {subscription?.status?.toUpperCase() || 'N/A'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <Calendar className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Dados Detalhados da Subscription */}
      {subscriptionData && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Dados da Subscription</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600">ID da Subscription</label>
                <p className="font-mono text-sm text-gray-800 bg-gray-50 p-2 rounded">{subscriptionData.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Tipo de Plano</label>
                <p className="text-sm text-gray-800 capitalize">{subscriptionData.plan_type}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <p className="text-sm text-gray-800 capitalize">{subscriptionData.status}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Início do Teste</label>
                <p className="text-sm text-gray-800">{formatDate(subscriptionData.trial_start_date)}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600">Fim do Teste</label>
                <p className="text-sm text-gray-800">{formatDate(subscriptionData.trial_end_date)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Data de Pagamento</label>
                <p className="text-sm text-gray-800">
                  {subscriptionData.payment_date ? formatDate(subscriptionData.payment_date) : 'Não pago'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Valor Pago</label>
                <p className="text-sm text-gray-800">
                  {subscriptionData.payment_amount ? `R$ ${subscriptionData.payment_amount.toFixed(2)}` : 'R$ 0,00'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Expira em</label>
                <p className="text-sm text-gray-800">
                  {subscriptionData.expires_at ? formatDate(subscriptionData.expires_at) : 'Não definido'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transações de Pagamento */}
      {paymentTransactions.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">💳 Transações de Pagamento</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2">Data</th>
                  <th className="text-left py-2">Valor</th>
                  <th className="text-left py-2">Método</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Payment ID</th>
                </tr>
              </thead>
              <tbody>
                {paymentTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-100">
                    <td className="py-2">{formatDate(transaction.created_at)}</td>
                    <td className="py-2 font-medium">R$ {transaction.amount.toFixed(2)}</td>
                    <td className="py-2 capitalize">{transaction.payment_method}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        transaction.status === 'approved' ? 'bg-green-100 text-green-800' :
                        transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {transaction.status}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-xs">{transaction.payment_intent_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resultados dos Testes */}
      {testResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🔍 Resultados dos Testes</h3>
          <div className="space-y-4">
            {testResults.map((result, index) => {
              const IconComponent = result.icon;
              return (
                <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <IconComponent className={`w-5 h-5 ${result.color}`} />
                    <div>
                      <h4 className="font-medium text-gray-900">{result.test}</h4>
                      <p className="text-sm text-gray-600">{result.details}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    result.status === 'PASS' ? 'bg-green-100 text-green-800' :
                    result.status === 'FAIL' ? 'bg-red-100 text-red-800' :
                    result.status === 'WARN' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {result.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ações de Teste */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Ações de Teste</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={testUpgrade}
            disabled={isMasterUser}
            className="flex items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CreditCard className="w-5 h-5" />
            Testar Upgrade de Assinatura
          </button>

          <button
            onClick={async () => {
              await refreshSubscription();
              await loadDetailedData();
              toast.success('Dados atualizados!');
            }}
            className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Recarregar Dados
          </button>

          <button
            onClick={() => {
              console.log('=== SUBSCRIPTION DEBUG ===');
              console.log('User:', user);
              console.log('Subscription:', subscription);
              console.log('Has Active Access:', hasActiveAccess);
              console.log('Is Master User:', isMasterUser);
              console.log('Is Trial Expired:', isTrialExpired);
              console.log('Days Remaining:', daysRemaining);
              console.log('Loading:', loading);
              console.log('Subscription Data:', subscriptionData);
              console.log('Payment Transactions:', paymentTransactions);
              toast.success('Debug info logged to console');
            }}
            className="flex items-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <AlertTriangle className="w-5 h-5" />
            Debug Console
          </button>

          <button
            onClick={async () => {
              try {
                const { data, error } = await supabase
                  .from('subscriptions')
                  .select('*')
                  .eq('user_id', user?.id);
                
                if (error) {
                  toast.error(`Erro: ${error.message}`);
                } else {
                  toast.success(`Encontradas ${data?.length || 0} subscriptions`);
                  console.log('Raw subscription data:', data);
                }
              } catch (error) {
                toast.error('Erro na consulta');
                console.error('Query error:', error);
              }
            }}
            className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <DollarSign className="w-5 h-5" />
            Testar Query Direta
          </button>
        </div>
      </div>

      {/* Informações de Debug */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🔧 Informações de Debug</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Variáveis de Ambiente</h4>
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-gray-600">SUPABASE_URL:</span>
                <span className="ml-2 font-mono">{import.meta.env.VITE_SUPABASE_URL ? '✅ Configurado' : '❌ Não configurado'}</span>
              </div>
              <div>
                <span className="text-gray-600">SUPABASE_ANON_KEY:</span>
                <span className="ml-2 font-mono">{import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Configurado' : '❌ Não configurado'}</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Estado do Context</h4>
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-gray-600">Loading:</span>
                <span className="ml-2">{loading ? '🔄 Sim' : '✅ Não'}</span>
              </div>
              <div>
                <span className="text-gray-600">User ID:</span>
                <span className="ml-2 font-mono text-xs">{user?.id || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-600">Subscription ID:</span>
                <span className="ml-2 font-mono text-xs">{subscription?.id || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Instruções */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">📋 Como Testar</h3>
        <div className="space-y-3 text-blue-800">
          <div className="flex items-start gap-2">
            <span className="font-bold">1.</span>
            <span>Clique em "Executar Testes" para verificar todos os componentes</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold">2.</span>
            <span>Verifique se todos os testes passaram (status PASS)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold">3.</span>
            <span>Se não for usuário master, teste o "Testar Upgrade de Assinatura"</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold">4.</span>
            <span>Use "Debug Console" para ver logs detalhados no console do navegador</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold">5.</span>
            <span>Verifique se as transações de pagamento aparecem após upgrade</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionTest;