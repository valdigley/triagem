import React from 'react';
import { supabase } from '../lib/supabase';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { 
  Calendar,
  Image,
  DollarSign,
  Users,
  TrendingUp,
  Clock,
  Camera,
  CheckCircle,
  Link,
  Copy
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import toast from 'react-hot-toast';

const sessionTypeLabels: Record<string, string> = {
  'gestante': 'Sessão Gestante',
  'aniversario': 'Aniversário',
  'comerciais': 'Comerciais',
  'pre-wedding': 'Pré Wedding',
  'formatura': 'Formatura',
  'revelacao-sexo': 'Revelação de Sexo',
};
const Dashboard: React.FC = () => {
  const { events, albums, photos, orders, loading } = useSupabaseData();

  // Calcular estatísticas reais baseadas nos dados do banco
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  // Buscar receita de assinaturas (não de clientes)
  const [subscriptionRevenue, setSubscriptionRevenue] = React.useState(0);
  const [subscriptionStats, setSubscriptionStats] = React.useState({
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    monthlyRevenue: 0,
  });

  // Carregar dados de assinaturas
  React.useEffect(() => {
    loadSubscriptionStats();
  }, []);

  const loadSubscriptionStats = async () => {
    try {
      // Buscar apenas transações de assinatura REALMENTE APROVADAS do mês atual
      const { data: transactions } = await supabase
        .from('payment_transactions')
        .select('amount, created_at, status')
        .eq('status', 'approved') // Apenas status aprovado
        .eq('payment_method', 'mercadopago')
        .gte('created_at', new Date(currentYear, currentMonth, 1).toISOString())
        .lt('created_at', new Date(currentYear, currentMonth + 1, 1).toISOString());

      console.log('Transactions found for current month:', transactions);
      const monthlyRevenue = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
      console.log('Calculated monthly revenue from transactions:', monthlyRevenue);

      // Buscar apenas assinaturas REALMENTE PAGAS (com payment_date preenchido)
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('status, plan_type, expires_at, trial_end_date, payment_date, payment_amount');

      console.log('All subscriptions:', subscriptions);
      
      const now = new Date();
      const paidSubscriptions = subscriptions?.filter(s => {
        const expiresAt = s.expires_at ? new Date(s.expires_at) : new Date(s.trial_end_date);
        const isPaid = s.status === 'active' && 
               s.plan_type === 'paid' && 
               s.payment_date && // Deve ter data de pagamento
               s.payment_amount && // Deve ter valor pago
               expiresAt > now;
        console.log(`Subscription ${s.plan_type} - isPaid: ${isPaid}, has payment_date: ${!!s.payment_date}, has payment_amount: ${!!s.payment_amount}`);
        return isPaid;
      }).length || 0;

      console.log('Paid subscriptions count:', paidSubscriptions);
      
      setSubscriptionStats({
        totalSubscriptions: subscriptions?.length || 0,
        activeSubscriptions: paidSubscriptions,
        monthlyRevenue,
      });
    } catch (error) {
      console.error('Error loading subscription stats:', error);
    }
  };
  
  // Pedidos pagos do mês atual (clientes)
  const paidOrdersThisMonth = orders.filter(order => {
    const orderDate = new Date(order.created_at);
    return order.status === 'paid' && 
           orderDate.getMonth() === currentMonth && 
           orderDate.getFullYear() === currentYear;
  });
  
  // Receita de clientes (fotos extras)
  const clientRevenue = paidOrdersThisMonth.reduce((sum, order) => sum + order.total_amount, 0);
  
  // Função para calcular taxas do Mercado Pago dinamicamente
  const calculateMercadoPagoFees = (amount: number, paymentMethod: string = 'pix') => {
    // Taxas atuais do Mercado Pago (2024/2025)
    const fees = {
      pix: 0.99, // 0.99% para PIX
      credit_card: 4.99, // 4.99% + R$ 0.39 para cartão de crédito
      debit_card: 3.99, // 3.99% para cartão de débito
      boleto: 3.49, // R$ 3.49 fixo para boleto
    };
    
    let feeAmount = 0;
    
    switch (paymentMethod.toLowerCase()) {
      case 'pix':
        feeAmount = amount * (fees.pix / 100);
        break;
      case 'credit_card':
      case 'visa':
      case 'master':
      case 'mastercard':
        feeAmount = (amount * (fees.credit_card / 100)) + 0.39;
        break;
      case 'debit_card':
      case 'maestro':
        feeAmount = amount * (fees.debit_card / 100);
        break;
      case 'boleto':
        feeAmount = fees.boleto;
        break;
      default:
        // Para métodos desconhecidos, assumir PIX (taxa mais baixa)
        feeAmount = amount * (fees.pix / 100);
    }
    
    return Math.round(feeAmount * 100) / 100; // Arredondar para 2 casas decimais
  };
  
  const clientNetRevenue = paidOrdersThisMonth.reduce((sum, order) => {
    // Usar taxa real do webhook se disponível, senão calcular dinamicamente
    let netAmount;
    if (order.metadata?.net_amount && order.metadata?.mercadopago_fee) {
      // Usar dados reais do webhook
      netAmount = order.metadata.net_amount;
    } else {
      // Calcular dinamicamente baseado no método de pagamento
      const paymentMethod = order.metadata?.payment_method || 'pix';
      const fee = calculateMercadoPagoFees(order.total_amount, paymentMethod);
      netAmount = order.total_amount - fee;
    }
    return sum + netAmount;
  }, 0);
  
  // Receita dos últimos 6 meses
  const last6MonthsRevenue = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = date.getMonth();
    const year = date.getFullYear();
    
    // Receita de clientes (fotos extras)
    const monthOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return order.status === 'paid' && 
             orderDate.getMonth() === month && 
             orderDate.getFullYear() === year;
    });
    
    const clientMonthRevenue = monthOrders.reduce((sum, order) => sum + order.total_amount, 0);
    
    // Receita de assinaturas (apenas mês atual por enquanto)
    let subscriptionMonthRevenue = 0;
    if (month === currentMonth && year === currentYear) {
      subscriptionMonthRevenue = subscriptionStats.monthlyRevenue;
    }
    
    const monthRevenue = clientMonthRevenue + subscriptionMonthRevenue;
    
    last6MonthsRevenue.push({
      month: date.toLocaleDateString('pt-BR', { month: 'short' }),
      revenue: monthRevenue
    });
  }
  
  // Eventos dos últimos 6 meses
  const last6MonthsEvents = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = date.getMonth();
    const year = date.getFullYear();
    
    const monthEvents = events.filter(event => {
      const eventDate = new Date(event.created_at);
      return eventDate.getMonth() === month && 
             eventDate.getFullYear() === year;
    });
    
    last6MonthsEvents.push({
      month: date.toLocaleDateString('pt-BR', { month: 'short' }),
      events: monthEvents.length
    });
  }

  const stats = {
    eventsThisMonth: events.filter(event => {
      const eventDate = new Date(event.created_at);
      return eventDate.getMonth() === currentMonth && 
             eventDate.getFullYear() === currentYear;
    }).length,
    totalEvents: events.length,
    activeAlbums: albums.filter(album => album.isActive).length,
    pendingSelections: albums.filter(album => {
      const albumPhotos = photos.filter(p => p.album_id === album.id);
      const selectedPhotos = albumPhotos.filter(p => p.isSelected);
      return albumPhotos.length > 0 && selectedPhotos.length === 0;
    }).length,
    monthlyRevenue: subscriptionStats.monthlyRevenue + clientRevenue, // Receita real baseada em transações aprovadas
    completedEvents: events.filter(e => e.status === 'completed').length,
    totalPhotos: photos.length,
    totalRevenue: orders.filter(o => o.status === 'paid').reduce((sum, o) => sum + o.total_amount, 0),
    paidOrders: orders.filter(o => o.status === 'paid').length,
    subscriptionRevenue: subscriptionStats.monthlyRevenue,
    clientRevenue: clientRevenue,
    clientNetRevenue: clientNetRevenue,
    totalFees: clientRevenue - clientNetRevenue,
  };

  // Usar dados reais calculados
  const revenueData = last6MonthsRevenue;
  const eventsData = last6MonthsEvents;

  // Eventos recentes (últimos 5)
  const recentEvents = events
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map(event => {
      // Buscar álbum do evento
      const album = albums.find(a => a.event_id === event.id);
      const eventPhotos = album ? photos.filter(p => p.album_id === album.id) : [];
      const selectedPhotos = eventPhotos.filter(p => p.is_selected);
      
      // Buscar pedidos do evento
      const eventOrders = orders.filter(o => o.event_id === event.id);
      const paidOrders = eventOrders.filter(o => o.status === 'paid');
      const revenue = paidOrders.reduce((sum, o) => sum + o.total_amount, 0);
      
      return {
        id: event.id,
        clientName: event.client_name,
        sessionType: event.session_type ? sessionTypeLabels[event.session_type] || event.session_type : 'Tipo não definido',
        displayName: event.session_type ? `${sessionTypeLabels[event.session_type] || event.session_type} - ${event.client_name}` : `Tipo não definido - ${event.client_name}`,
        eventDate: event.event_date,
        status: event.status,
        photos: eventPhotos.length,
        selected: selectedPhotos.length,
        revenue: revenue,
        paymentStatus: paidOrders.length > 0 ? 'paid' : eventOrders.length > 0 ? 'pending' : 'none'
      };
    });

  // Função para copiar link de agendamento
  const copySchedulingLink = () => {
    const schedulingUrl = `${window.location.origin}/agendar`;
    navigator.clipboard.writeText(schedulingUrl);
    toast.success('Link de agendamento copiado para a área de transferência!');
  };

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ElementType;
    change?: string;
    changeType?: 'positive' | 'negative';
  }> = ({ title, value, icon: Icon, change, changeType }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <p className={`text-sm mt-1 ${
              changeType === 'positive' ? 'text-green-600' : 'text-red-600'
            }`}>
              {change}
            </p>
          )}
        </div>
        <div className="p-3 bg-blue-50 rounded-lg">
          <Icon className="w-6 h-6 text-blue-600" />
        </div>
      </div>
    </div>
  );

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      scheduled: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Agendado' },
      'in-progress': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Em Andamento' },
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Concluído' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelado' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      label: status || 'Desconhecido'
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Carregando dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Visão geral do seu negócio fotográfico</p>
      </div>

      {/* Link de Agendamento */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Link className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Link de Agendamento</h3>
              <p className="text-gray-600">Compartilhe este link com seus clientes para que possam agendar e pagar diretamente</p>
            </div>
          </div>
          <button
            onClick={copySchedulingLink}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copiar Link
          </button>
        </div>
        <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
          <code className="text-sm text-gray-700 break-all">
            {window.location.origin}/agendar
          </code>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <StatCard
          title="Eventos Este Mês"
          value={stats.eventsThisMonth}
          icon={Calendar}
          change={`${stats.totalEvents} eventos no total`}
        />
        <StatCard
          title="Sessões Ativas"
          value={stats.activeAlbums}
          icon={Image}
          change="5 aguardando seleção"
        />
        <StatCard
          title="Receita Bruta"
          value={`R$ ${stats.monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={DollarSign}
          change={`Antes das taxas do Mercado Pago`}
        />
        <StatCard
          title="Valor Líquido Recebido"
          value={`R$ ${(stats.subscriptionRevenue + stats.clientNetRevenue).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={TrendingUp}
          change={stats.totalFees > 0 
            ? `Taxas MP: R$ ${stats.totalFees.toFixed(2)} (${((stats.totalFees / stats.monthlyRevenue) * 100).toFixed(1)}%)`
            : 'Sem taxas este mês'}
        />
        <StatCard
          title="Taxas Mercado Pago"
          value={`R$ ${stats.totalFees.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={DollarSign}
          change={stats.totalFees > 0 
            ? `${((stats.totalFees / stats.monthlyRevenue) * 100).toFixed(1)}% da receita bruta`
            : 'Nenhuma taxa cobrada'}
        />
        <StatCard
          title="Total de Clientes"
          value={stats.completedEvents}
          icon={Users}
          change={stats.totalRevenue > 0 
            ? `R$ ${stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total arrecadado`
            : 'Nenhuma receita ainda'
          }
        />
        <StatCard
          title="Fotos Capturadas"
          value={stats.totalPhotos.toLocaleString('pt-BR')}
          icon={Camera}
          change={`${photos.filter(p => p.is_selected).length} selecionadas`}
        />
        <StatCard
          title="Pedidos Pagos"
          value={stats.paidOrders}
          icon={TrendingUp}
          change={`de ${orders.length} pedidos totais`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Receita Mensal</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => [`R$ ${value}`, 'Receita']} />
              <Bar 
                dataKey="revenue" 
                fill="#3B82F6" 
                radius={[4, 4, 0, 0]}
                name="Receita"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Eventos por Mês</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={eventsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value}`, 'Eventos']} />
              <Line 
                type="monotone" 
                dataKey="events" 
                stroke="#10B981" 
                strokeWidth={2}
                name="Eventos"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Eventos Recentes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sessão
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fotos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Selecionadas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sessão
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Receita
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentEvents.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {event.clientName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.displayName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(event.eventDate).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(event.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.photos}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.selected}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.sessionType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-col">
                      <span className={`font-medium ${event.revenue > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        R$ {event.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className={`text-xs ${
                        event.paymentStatus === 'paid' ? 'text-green-600' : 
                        event.paymentStatus === 'pending' ? 'text-yellow-600' : 
                        'text-gray-400'
                      }`}>
                        {event.paymentStatus === 'paid' ? 'Pago' : 
                         event.paymentStatus === 'pending' ? 'Pendente' : 
                         'Sem pedido'}
                      </span>
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

export default Dashboard;