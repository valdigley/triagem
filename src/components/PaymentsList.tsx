import React, { useState, useEffect } from 'react';
import { CreditCard, Eye, RefreshCw, CheckCircle, XCircle, Clock, DollarSign, Calendar, User, Mail, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface PaymentDetails {
  id: string;
  event_id: string;
  client_email: string;
  total_amount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  payment_intent_id: string | null;
  created_at: string;
  metadata?: {
    payment_type?: string;
    mercadopago_fee?: number;
    net_amount?: number;
    payment_method?: string;
  };
  event?: {
    client_name: string;
    client_phone: string;
    session_type: string;
    event_date: string;
  };
}

const sessionTypeLabels: Record<string, string> = {
  'gestante': 'Sessão Gestante',
  'aniversario': 'Aniversário',
  'comerciais': 'Comerciais',
  'pre-wedding': 'Pré Wedding',
  'formatura': 'Formatura',
  'revelacao-sexo': 'Revelação de Sexo',
};

const PaymentsList: React.FC = () => {
  const { events, loading: eventsLoading } = useSupabaseData();
  const [payments, setPayments] = useState<PaymentDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDetails | null>(null);

  // Escutar eventos de atualização de pagamento
  useEffect(() => {
    const handlePaymentUpdate = () => {
      console.log('Payment status updated, refreshing payments list');
      loadPayments();
    };

    window.addEventListener('paymentStatusUpdated', handlePaymentUpdate);
    return () => {
      window.removeEventListener('paymentStatusUpdated', handlePaymentUpdate);
    };
  }, []);

  useEffect(() => {
    loadPayments();
  }, [events]);

  const loadPayments = async () => {
    try {
      // Buscar apenas pedidos com valor > 0 (pagamentos reais)
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .gt('total_amount', 0) // Apenas pagamentos com valor
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading payments:', error);
        toast.error('Erro ao carregar pagamentos');
        return;
      }

      // Combinar com dados dos eventos
      const paymentsWithEvents = ordersData.map(order => {
        const event = events.find(e => e.id === order.event_id);
        return {
          ...order,
          event: event ? {
            client_name: event.client_name,
            client_phone: event.client_phone,
            session_type: event.session_type,
            event_date: event.event_date,
          } : null,
        };
      });

      setPayments(paymentsWithEvents);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setLoading(false);
    }
  };

  const refreshPayments = async () => {
    setRefreshing(true);
    await loadPayments();
    setRefreshing(false);
    toast.success('Pagamentos atualizados!');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { 
        bg: 'bg-yellow-100', 
        text: 'text-yellow-800', 
        icon: Clock,
        label: 'Pendente' 
      },
      paid: { 
        bg: 'bg-green-100', 
        text: 'text-green-800', 
        icon: CheckCircle,
        label: 'Pago' 
      },
      cancelled: { 
        bg: 'bg-red-100', 
        text: 'text-red-800', 
        icon: XCircle,
        label: 'Cancelado' 
      },
      expired: { 
        bg: 'bg-gray-100', 
        text: 'text-gray-800', 
        icon: XCircle,
        label: 'Expirado' 
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      icon: Clock,
      label: status || 'Desconhecido'
    };

    const IconComponent = config.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full ${config.bg} ${config.text}`}>
        <IconComponent className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const getPaymentTypeLabel = (amount: number) => {
    return 'Fotos Extras';
  };

  const getPaymentOrigin = (payment: PaymentDetails) => {
    // Verificar metadata primeiro para identificação precisa
    if (payment.metadata?.payment_type === 'advance_booking') {
      return 'Pagamento antecipado do agendamento';
    }
    if (payment.metadata?.payment_type === 'extra_photos') {
      return 'Compra de fotos extras';
    }
    
    // Fallback: usar valor para determinar tipo
    if (payment.total_amount >= 150 && payment.total_amount <= 300) {
      return 'Pagamento antecipado do agendamento';
    }
    
    return 'Compra de fotos extras';
  };

  const getTotalRevenue = () => {
    const grossRevenue = payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.total_amount, 0);
    
    const netRevenue = payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => {
        const netAmount = p.metadata?.net_amount || p.total_amount;
        return sum + netAmount;
      }, 0);
    
    const totalFees = grossRevenue - netRevenue;
    
    return { grossRevenue, netRevenue, totalFees };
  };

  const getPaymentStats = () => {
    const total = payments.length;
    const paid = payments.filter(p => p.status === 'paid').length;
    const pending = payments.filter(p => p.status === 'pending').length;
    const cancelled = payments.filter(p => p.status === 'cancelled' || p.status === 'expired').length;

    return { total, paid, pending, cancelled };
  };

  const stats = getPaymentStats();
  const revenueStats = getTotalRevenue();

  if (loading || eventsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Carregando pagamentos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagamentos</h1>
          <p className="text-gray-600">Acompanhe todos os pagamentos e seus status ({payments.length} pagamentos)</p>
        </div>
        <button 
          onClick={refreshPayments}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Pagamentos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pagamentos Confirmados</p>
              <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pagamentos Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Receita Bruta</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {revenueStats.grossRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500">
                Líquido: R$ {revenueStats.netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {revenueStats.totalFees > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Taxas MP</p>
                <p className="text-2xl font-bold text-red-600">
                  R$ {revenueStats.totalFees.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500">
                  {((revenueStats.totalFees / revenueStats.grossRevenue) * 100).toFixed(1)}% do total
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payments List */}
      {payments.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum pagamento encontrado</h3>
          <p className="text-gray-600">Os pagamentos aparecerão aqui conforme forem sendo realizados</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID Pagamento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {payment.event?.client_name || 'Cliente não encontrado'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {payment.client_email}
                        </div>
                        {payment.event?.client_phone && (
                          <div className="text-sm text-gray-500">
                            {payment.event.client_phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getPaymentTypeLabel(payment.total_amount)}
                      </div>
                      {payment.event?.session_type && (
                        <div className="text-sm text-gray-500">
                          {sessionTypeLabels[payment.event.session_type] || payment.event.session_type}
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        R$ {payment.total_amount.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        R$ {payment.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(payment.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(payment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-500">
                        {payment.payment_intent_id ? (
                          <span title={payment.payment_intent_id}>
                            {payment.payment_intent_id.length > 20 
                              ? `${payment.payment_intent_id.substring(0, 20)}...`
                              : payment.payment_intent_id
                            }
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedPayment(payment)}
                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Detalhes do Pagamento</h2>
              <button
                onClick={() => setSelectedPayment(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status:</span>
                {getStatusBadge(selectedPayment.status)}
              </div>

              {/* Cliente */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cliente
                  </label>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span>{selectedPayment.event?.client_name || 'N/A'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail
                  </label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{selectedPayment.client_email}</span>
                  </div>
                </div>

                {selectedPayment.event?.client_phone && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefone
                    </label>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{selectedPayment.event.client_phone}</span>
                    </div>
                  </div>
                )}

                {selectedPayment.event?.event_date && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data da Sessão
                    </label>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>
                        {format(new Date(selectedPayment.event.event_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Pagamento */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">Informações do Pagamento</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Valor:</span>
                    <span className="ml-2 font-medium">
                      R$ {selectedPayment.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Tipo:</span>
                    <span className="ml-2 font-medium">
                      {getPaymentTypeLabel(selectedPayment.total_amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Origem:</span>
                    <span className="ml-2 font-medium">
                      {getPaymentOrigin(selectedPayment)}
                    </span>
                  </div>
                  {selectedPayment.metadata?.payment_method && (
                    <div>
                      <span className="text-gray-600">Método:</span>
                      <span className="ml-2 font-medium capitalize">
                        {selectedPayment.metadata.payment_method}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">Data de Criação:</span>
                    <span className="ml-2 font-medium">
                      {format(new Date(selectedPayment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {selectedPayment.payment_intent_id && (
                    <div className="md:col-span-2">
                      <span className="text-gray-600">ID do Pagamento:</span>
                      <span className="ml-2 font-mono text-sm break-all">
                        {selectedPayment.payment_intent_id}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sessão */}
              {selectedPayment.event && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-3">Informações da Sessão</h3>
                  <div className="text-sm">
                    <div className="mb-2">
                      <span className="text-gray-600">Tipo de Sessão:</span>
                      <span className="ml-2 font-medium">
                        {selectedPayment.event.session_type 
                          ? sessionTypeLabels[selectedPayment.event.session_type] || selectedPayment.event.session_type
                          : 'Não definido'
                        }
                      </span>
                    </div>
                    {selectedPayment.metadata?.net_amount && (
                      <div className="text-xs text-gray-500 mt-1">
                        Líquido: R$ {selectedPayment.metadata.net_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {selectedPayment.metadata.mercadopago_fee && (
                          <span className="text-red-600 ml-2">
                            (Taxa: R$ {selectedPayment.metadata.mercadopago_fee.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end p-6 border-t">
              <button
                onClick={() => setSelectedPayment(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsList;