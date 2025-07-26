import React from 'react';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { 
  Calendar,
  Image,
  DollarSign,
  Users,
  TrendingUp,
  Clock,
  Camera,
  CheckCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

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
  
  // Pedidos pagos do mês atual
  const paidOrdersThisMonth = orders.filter(order => {
    const orderDate = new Date(order.created_at);
    return order.status === 'paid' && 
           orderDate.getMonth() === currentMonth && 
           orderDate.getFullYear() === currentYear;
  });
  
  // Receita mensal real
  const monthlyRevenue = paidOrdersThisMonth.reduce((sum, order) => sum + order.total_amount, 0);
  
  // Receita dos últimos 6 meses
  const last6MonthsRevenue = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = date.getMonth();
    const year = date.getFullYear();
    
    const monthOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return order.status === 'paid' && 
             orderDate.getMonth() === month && 
             orderDate.getFullYear() === year;
    });
    
    const monthRevenue = monthOrders.reduce((sum, order) => sum + order.total_amount, 0);
    
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
    totalEvents: events.length,
    activeAlbums: albums.filter(album => album.isActive).length,
    pendingSelections: albums.filter(album => {
      const albumPhotos = photos.filter(p => p.albumId === album.id);
      const selectedPhotos = albumPhotos.filter(p => p.isSelected);
      return albumPhotos.length > 0 && selectedPhotos.length === 0;
    }).length,
    monthlyRevenue: monthlyRevenue,
    completedEvents: events.filter(e => e.status === 'completed').length,
    totalPhotos: photos.length,
    totalRevenue: orders.filter(o => o.status === 'paid').reduce((sum, o) => sum + o.total_amount, 0),
    paidOrders: orders.filter(o => o.status === 'paid').length,
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
        eventDate: event.event_date,
        status: event.status,
        photos: eventPhotos.length,
        selected: selectedPhotos.length,
        revenue: revenue,
        paymentStatus: paidOrders.length > 0 ? 'paid' : eventOrders.length > 0 ? 'pending' : 'none'
      };
    });

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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Eventos Este Mês"
          value={stats.totalEvents}
          icon={Calendar}
          change="+12% vs mês anterior"
          changeType="positive"
        />
        <StatCard
          title="Álbuns Ativos"
          value={stats.activeAlbums}
          icon={Image}
          change="5 aguardando seleção"
        />
        <StatCard
          title="Receita Mensal"
          value={`R$ ${stats.monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={DollarSign}
          change={stats.paidOrders > 0 ? `${stats.paidOrders} pedidos pagos` : 'Nenhum pedido pago'}
        />
        <StatCard
          title="Total de Clientes"
          value={stats.completedEvents}
          icon={Users}
          change={`R$ ${stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total`}
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
                  Tipo de Sessão
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
                    {event.sessionType}
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