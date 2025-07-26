import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, MessageCircle, Calendar, Camera, Search, Filter, Plus, Edit, Trash2, X, Save } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';

const clientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  notes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalEvents: number;
  lastEventDate?: string;
  sessionTypes: string[];
  totalSpent: number;
}

const sessionTypeLabels: Record<string, string> = {
  'gestante': 'Sessão Gestante',
  'aniversario': 'Aniversário',
  'comerciais': 'Comerciais',
  'pre-wedding': 'Pré Wedding',
  'formatura': 'Formatura',
  'revelacao-sexo': 'Revelação de Sexo',
};

const ClientsList: React.FC = () => {
  const { events, orders, clients: supabaseClients, loading, addClient, updateClient, deleteClient } = useSupabaseData();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'recent' | 'frequent'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
  });

  useEffect(() => {
    if (events.length > 0 || supabaseClients.length > 0) {
      processClientsData();
    }
  }, [events, orders, supabaseClients]);

  const processClientsData = () => {
    const clientsMap = new Map<string, Client>();

    // Primeiro, adicionar todos os clientes do Supabase
    supabaseClients.forEach(client => {
      const clientKey = client.email.toLowerCase();
      clientsMap.set(clientKey, {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        totalEvents: 0,
        sessionTypes: [],
        totalSpent: 0,
      });
    });

    // Processar eventos para extrair dados dos clientes
    events.forEach(event => {
      const clientKey = event.client_email.toLowerCase();
      
      if (!clientsMap.has(clientKey)) {
        // Se não existe no Supabase, criar entrada temporária
        clientsMap.set(clientKey, {
          id: `temp_${clientKey}`,
          name: event.client_name,
          email: event.client_email,
          phone: event.client_phone,
          totalEvents: 0,
          sessionTypes: [],
          totalSpent: 0,
        });
      }

      const client = clientsMap.get(clientKey)!;
      client.totalEvents += 1;
      
      // Atualizar data do último evento
      const eventDate = new Date(event.event_date);
      if (!client.lastEventDate || eventDate > new Date(client.lastEventDate)) {
        client.lastEventDate = event.event_date;
      }

      // Adicionar tipo de sessão se não existir
      if (event.session_type && !client.sessionTypes.includes(event.session_type)) {
        client.sessionTypes.push(event.session_type);
      }
    });

    // Processar pedidos para calcular valor gasto
    orders.forEach(order => {
      if (order.status === 'paid') {
        const clientKey = order.client_email.toLowerCase();
        const client = clientsMap.get(clientKey);
        if (client) {
          client.totalSpent += order.total_amount;
        }
      }
    });

    const clientsArray = Array.from(clientsMap.values());
    setClients(clientsArray);
  };

  const openWhatsApp = (phone: string, clientName: string) => {
    // Limpar o telefone removendo caracteres especiais
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Adicionar código do país se não tiver
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    const message = encodeURIComponent(`Olá ${clientName}! Como posso ajudá-lo(a)?`);
    const whatsappUrl = `https://wa.me/${fullPhone}?text=${message}`;
    
    window.open(whatsappUrl, '_blank');
    toast.success('Abrindo WhatsApp...');
  };

  const onSubmit = async (data: ClientFormData) => {
    setIsSubmitting(true);
    
    try {
      if (editingClient) {
        // Atualizar cliente existente
        const success = await updateClient(editingClient, data);
        if (success) {
          setEditingClient(null);
          reset();
        }
      } else {
        // Adicionar novo cliente
        const success = await addClient(data);
        if (success) {
          setShowAddForm(false);
          reset();
        }
      }
    } catch (error) {
      console.error('Error submitting client:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (client: Client) => {
    // Só permitir edição de clientes que existem no Supabase (não temporários)
    if (client.id.startsWith('temp_')) {
      toast.error('Este cliente precisa ser adicionado primeiro');
      return;
    }
    
    setEditingClient(client.id);
    setValue('name', client.name);
    setValue('email', client.email);
    setValue('phone', client.phone);
    setValue('notes', '');
  };

  const handleDelete = async (clientId: string) => {
    if (clientId.startsWith('temp_')) {
      toast.error('Este cliente não pode ser excluído pois não está salvo');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.')) {
      return;
    }

    await deleteClient(clientId);
  };

  const cancelEdit = () => {
    setEditingClient(null);
    setShowAddForm(false);
    reset();
  };

  const filteredClients = clients.filter(client => {
    // Filtro de busca
    const matchesSearch = 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.includes(searchTerm);

    if (!matchesSearch) return false;

    // Filtro por tipo
    switch (filterType) {
      case 'recent':
        // Clientes com eventos nos últimos 30 dias
        if (!client.lastEventDate) return false;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return new Date(client.lastEventDate) >= thirtyDaysAgo;
      
      case 'frequent':
        // Clientes com mais de 1 evento
        return client.totalEvents > 1;
      
      default:
        return true;
    }
  });

  const sortedClients = filteredClients.sort((a, b) => {
    // Ordenar por data do último evento (mais recente primeiro)
    if (!a.lastEventDate && !b.lastEventDate) return 0;
    if (!a.lastEventDate) return 1;
    if (!b.lastEventDate) return -1;
    return new Date(b.lastEventDate).getTime() - new Date(a.lastEventDate).getTime();
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Carregando clientes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <p className="text-gray-600">Gerencie seus clientes e entre em contato facilmente ({clients.length} clientes)</p>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Busca */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Buscar por nome, e-mail ou telefone..."
              />
            </div>
          </div>

          {/* Filtro */}
          <div className="sm:w-48">
            <div className="relative">
              <Filter className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Todos os clientes</option>
                <option value="recent">Recentes (30 dias)</option>
                <option value="frequent">Frequentes (2+ eventos)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Estatísticas rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{clients.length}</div>
            <div className="text-sm text-gray-600">Total de Clientes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {clients.filter(c => c.totalEvents > 1).length}
            </div>
            <div className="text-sm text-gray-600">Clientes Recorrentes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              R$ {clients.reduce((sum, c) => sum + c.totalSpent, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-gray-600">Receita Total</div>
          <p className="text-gray-600">Gerencie seus clientes e entre em contato facilmente ({supabaseClients.length} salvos, {clients.length} total)</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar Cliente
        </button>
      </div>

      {/* Formulário de Adicionar/Editar Cliente */}
      {(showAddForm || editingClient) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingClient ? 'Editar Cliente' : 'Adicionar Novo Cliente'}
            </h3>
            <button
              onClick={cancelEdit}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  {...register('name')}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nome completo do cliente"
                />
                {errors.name && (
                  <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-mail *
                </label>
                <input
                  {...register('email')}
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="cliente@email.com"
                />
                {errors.email && (
                  <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone *
                </label>
                <input
                  {...register('phone')}
                  type="tel"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="(11) 99999-9999"
                />
                {errors.phone && (
                  <p className="text-red-600 text-sm mt-1">{errors.phone.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <input
                  {...register('notes')}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Observações sobre o cliente"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Salvando...' : editingClient ? 'Atualizar' : 'Adicionar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Clientes */}
      {sortedClients.length === 0 ? (
        <div className="text-center py-12">
          <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || filterType !== 'all' ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          </h3>
          <p className="text-gray-600">
            {searchTerm || filterType !== 'all' 
              ? 'Tente ajustar os filtros de busca'
              : 'Os clientes aparecerão aqui conforme fizerem agendamentos'
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {sortedClients.map((client) => (
            <div key={client.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Informações do Cliente */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{client.name}</h3>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        <span>{client.email}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        <span>{client.phone}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Estatísticas e Ações */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                  {/* Estatísticas */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-600">{client.totalEvents}</div>
                      <div className="text-xs text-gray-500">Eventos</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-600">
                        R$ {client.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500">Gasto</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-purple-600">{client.sessionTypes.length}</div>
                      <div className="text-xs text-gray-500">Tipos</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-600">
                        {client.lastEventDate 
                          ? format(new Date(client.lastEventDate), 'dd/MM/yy', { locale: ptBR })
                          : 'N/A'
                        }
                      </div>
                      <div className="text-xs text-gray-500">Último</div>
                    </div>
                  </div>

                  {/* Botão WhatsApp */}
                  <button
                    onClick={() => openWhatsApp(client.phone, client.name)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </button>

                  {/* Botões de Ação */}
                  <div className="flex gap-2">
                    {!client.id.startsWith('temp_') ? (
                      <>
                        <button
                          onClick={() => handleEdit(client)}
                          className="flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(client.id)}
                          className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir
                        </button>
                      </>
                    ) : (
                      <div className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm">
                        Cliente temporário - adicione para gerenciar
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Detalhes Expandidos */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tipos de Sessão */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <Camera className="w-4 h-4" />
                      Tipos de Sessão
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {client.sessionTypes.length > 0 ? (
                        client.sessionTypes.map((type) => (
                          <span
                            key={type}
                            className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                          >
                            {sessionTypeLabels[type] || type}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">Nenhum tipo registrado</span>
                      )}
                    </div>
                  </div>

                  {/* Última Atividade */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Última Atividade
                    </h4>
                    <div className="text-sm text-gray-600">
                      {client.lastEventDate ? (
                        <>
                          <div>
                            {format(new Date(client.lastEventDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {Math.floor((new Date().getTime() - new Date(client.lastEventDate).getTime()) / (1000 * 60 * 60 * 24))} dias atrás
                          </div>
                        </>
                      ) : (
                        <span>Nenhuma atividade registrada</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientsList;