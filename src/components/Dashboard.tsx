import React from 'react';
import { useData } from '../contexts/DataContext';
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

const Dashboard: React.FC = () => {
  const { events, albums, photos } = useData();

  // Calcular estatísticas reais
  const stats = {
    totalEvents: events.length,
    activeAlbums: albums.filter(album => album.isActive).length,
    pendingSelections: albums.filter(album => {
      const albumPhotos = photos.filter(p => p.albumId === album.id);
      const selectedPhotos = albumPhotos.filter(p => p.isSelected);
      return albumPhotos.length > 0 && selectedPhotos.length === 0;
    }).length,
    monthlyRevenue: photos.filter(p => p.isSelected).reduce((sum, p) => sum + p.price, 0),
    completedEvents: events.filter(e => e.status === 'completed').length,
    totalPhotos: photos.length,
  };

  const revenueData = [
    { month: 'Jan', revenue: 3200 },
    { month: 'Fev', revenue: 4100 },
    { month: 'Mar', revenue: 3800 },
    { month: 'Abr', revenue: 4850 },
    { month: 'Mai', revenue: 5200 },
    { month: 'Jun', revenue: 4650 },
  ];

  const eventsData = [
    { month: 'Jan', events: 18 },
    { month: 'Fev', events: 22 },
    { month: 'Mar', events: 19 },
    { month: 'Abr', events: 24 },
    { month: 'Mai', events: 26 },
    { month: 'Jun', events: 23 },
  ];

  // Eventos recentes (últimos 5)
  const recentEvents = events
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map(event => {
      const eventPhotos = photos.filter(p => {
        const album = albums.find(a => a.eventId === event.id);
        return album && p.albumId === album.id;
      });
      const selectedPhotos = eventPhotos.filter(p => p.isSelected);
      
      return {
        id: event.id,
        client: event.clientName,
        date: event.eventDate.toISOString().split('T')[0],
        status: event.status,
        photos: eventPhotos.length,
        selected: selectedPhotos.length,
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
          value={`R$ ${stats.monthlyRevenue.toLocaleString('pt-BR')}`}
          icon={DollarSign}
          change="+18% vs mês anterior"
          changeType="positive"
        />
        <StatCard
          title="Total de Clientes"
          value={stats.completedEvents}
          icon={Users}
        />
        <StatCard
          title="Fotos Capturadas"
          value={stats.totalPhotos.toLocaleString('pt-BR')}
          icon={Camera}
        />
        <StatCard
          title="Taxa de Conversão"
          value="78%"
          icon={TrendingUp}
          change="+5% vs mês anterior"
          changeType="positive"
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
              <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
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
              <Tooltip />
              <Line type="monotone" dataKey="events" stroke="#10B981" strokeWidth={2} />
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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentEvents.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {event.client}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(event.date).toLocaleDateString('pt-BR')}
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