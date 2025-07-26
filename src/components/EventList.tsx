import React, { useState } from 'react';
import { Calendar, MapPin, User, Phone, Mail, Eye, Plus, Edit, Trash2, X, Save, Camera, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import SchedulingPayment from './SchedulingPayment';

const eventSchema = z.object({
  clientName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  clientEmail: z.string().email('E-mail inválido'),
  clientPhone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  sessionType: z.string().min(1, 'Tipo de sessão é obrigatório'),
  eventDate: z.string().min(1, 'Data é obrigatória').refine((date) => {
    const selectedDate = new Date(date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate >= today;
  }, 'A data não pode ser anterior a hoje'),
  eventTime: z.string().min(1, 'Horário é obrigatório'),
  notes: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

interface EventListProps {
  onViewAlbum?: (eventId: string) => void;
}

const sessionTypeLabels: Record<string, string> = {
  'gestante': 'Sessão Gestante',
  'aniversario': 'Aniversário',
  'comerciais': 'Comerciais',
  'pre-wedding': 'Pré Wedding',
  'formatura': 'Formatura',
  'revelacao-sexo': 'Revelação de Sexo',
};

const sessionTypes = [
  { value: 'gestante', label: 'Sessão Gestante' },
  { value: 'aniversario', label: 'Aniversário' },
  { value: 'comerciais', label: 'Comerciais' },
  { value: 'pre-wedding', label: 'Pré Wedding' },
  { value: 'formatura', label: 'Formatura' },
  { value: 'revelacao-sexo', label: 'Revelação de Sexo' },
];

const EventList: React.FC<EventListProps> = ({ onViewAlbum }) => {
  const { events, updateEvent, deleteEvent, addEvent, loading } = useSupabaseData();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [pendingEventData, setPendingEventData] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    session_type: '',
    event_date: '',
    event_time: '',
    notes: '',
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      scheduled: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Agendado' },
      'in-progress': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Em Andamento' },
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Concluído' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelado' },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const handleStatusChange = async (eventId: string, newStatus: string) => {
    setUpdatingId(eventId);
    const success = await updateEvent(eventId, { status: newStatus as any });
    setUpdatingId(null);
  };

  const handleEditStart = (event: any) => {
    const eventDate = new Date(event.event_date);
    setEditingId(event.id);
    setEditForm({
      client_name: event.client_name,
      client_email: event.client_email,
      client_phone: event.client_phone,
      session_type: event.session_type || '',
      event_date: eventDate.toISOString().split('T')[0],
      event_time: eventDate.toTimeString().slice(0, 5),
      notes: event.notes || '',
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm({
      client_name: '',
      client_email: '',
      client_phone: '',
      session_type: '',
      event_date: '',
      event_time: '',
      notes: '',
    });
  };

  const handleEditSave = async () => {
    if (!editingId) return;

    // Validar campos obrigatórios
    if (!editForm.client_name.trim() || !editForm.client_email.trim() || 
        !editForm.client_phone.trim() || !editForm.session_type || 
        !editForm.event_date || !editForm.event_time) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Validar data
    const selectedDate = new Date(`${editForm.event_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      toast.error('A data não pode ser anterior a hoje');
      return;
    }

    setUpdatingId(editingId);
    
    try {
      const eventDateTime = new Date(`${editForm.event_date}T${editForm.event_time}`);
      
      const success = await updateEvent(editingId, {
        client_name: editForm.client_name.trim(),
        client_email: editForm.client_email.trim(),
        client_phone: editForm.client_phone.trim(),
        session_type: editForm.session_type,
        event_date: eventDateTime.toISOString(),
        notes: editForm.notes.trim() || null,
      });

      if (success) {
        handleEditCancel();
      }
    } catch (error) {
      console.error('Error updating event:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Tem certeza que deseja excluir este agendamento? Todos os álbuns e fotos relacionados serão permanentemente removidos. Esta ação não pode ser desfeita.')) {
      return;
    }

    setDeletingId(eventId);
    try {
      await deleteEvent(eventId);
    } catch (error) {
      console.error('Error deleting event:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const onSubmit = async (data: EventFormData) => {
    // Combine date and time
    const eventDateTime = new Date(`${data.eventDate}T${data.eventTime}`);
    
    // Preparar dados do evento para pagamento
    const eventData = {
      client_name: data.clientName,
      client_email: data.clientEmail,
      client_phone: data.clientPhone,
      session_type: data.sessionType,
      event_date: eventDateTime.toISOString(),
      location: 'Estúdio Fotográfico',
      notes: data.notes,
      status: 'scheduled',
    };
    
    setPendingEventData(eventData);
    setShowPayment(true);
  };

  const handlePaymentComplete = async () => {
    if (!pendingEventData) return;
    
    setIsSubmitting(true);
    try {
      const success = await addEvent(pendingEventData);
      if (success) {
        reset();
        setShowCreateForm(false);
        setShowPayment(false);
        setPendingEventData(null);
        toast.success('Sua sessão foi agendada com sucesso!');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Erro ao confirmar agendamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentCancel = () => {
    setShowPayment(false);
    setPendingEventData(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Carregando agendamentos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>
          <p className="text-gray-600">Gerencie suas sessões de fotos ({events.length} agendamentos)</p>
        </div>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Agendamento
        </button>
      </div>

      {/* Formulário de criação */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Novo Agendamento</h3>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {showPayment && (
            <div className="absolute inset-0 bg-white rounded-lg z-10">
              <SchedulingPayment
                eventData={pendingEventData}
                onComplete={handlePaymentComplete}
                onCancel={handlePaymentCancel}
              />
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Client Information */}
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-gray-900 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Informações do Cliente
              </h4>
              
              <div>
                <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  {...register('clientName')}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Digite o nome completo do cliente"
                />
                {errors.clientName && (
                  <p className="text-red-600 text-sm mt-1">{errors.clientName.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="clientEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      {...register('clientEmail')}
                      type="email"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="cliente@email.com"
                    />
                  </div>
                  {errors.clientEmail && (
                    <p className="text-red-600 text-sm mt-1">{errors.clientEmail.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="clientPhone" className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      {...register('clientPhone')}
                      type="tel"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  {errors.clientPhone && (
                    <p className="text-red-600 text-sm mt-1">{errors.clientPhone.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Session Type */}
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-gray-900 flex items-center">
                <Camera className="w-4 h-4 mr-2" />
                Tipo de Sessão
              </h4>
              
              <div>
                <label htmlFor="sessionType" className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria da Sessão *
                </label>
                <select
                  {...register('sessionType')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Selecione o tipo de sessão...</option>
                  {sessionTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {errors.sessionType && (
                  <p className="text-red-600 text-sm mt-1">{errors.sessionType.message}</p>
                )}
              </div>
            </div>

            {/* Event Details */}
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-gray-900 flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Detalhes do Evento
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Data *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      {...register('eventDate')}
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {errors.eventDate && (
                    <p className="text-red-600 text-sm mt-1">{errors.eventDate.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="eventTime" className="block text-sm font-medium text-gray-700 mb-1">
                    Horário *
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      {...register('eventTime')}
                      type="time"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {errors.eventTime && (
                    <p className="text-red-600 text-sm mt-1">{errors.eventTime.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  {...register('notes')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Informações adicionais sobre a sessão..."
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Processando...' : 'Prosseguir para Pagamento'}
              </button>
            </div>
          </form>
        </div>
      )}

      {events.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum agendamento encontrado</h3>
          <p className="text-gray-600 mb-4">Comece criando seu primeiro agendamento</p>
          <button 
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar Agendamento
          </button>
        </div>
      ) : (
        !showCreateForm && (
        <div className="grid gap-6">
          {events.map((event) => (
            <div key={event.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {editingId === event.id ? (
                // Formulário de edição
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Editando Agendamento</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={handleEditCancel}
                        className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Cancelar
                      </button>
                      <button
                        onClick={handleEditSave}
                        disabled={updatingId === event.id}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {updatingId === event.id ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome do Cliente *
                      </label>
                      <input
                        type="text"
                        value={editForm.client_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, client_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Sessão *
                      </label>
                      <select
                        value={editForm.session_type}
                        onChange={(e) => setEditForm(prev => ({ ...prev, session_type: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Selecione...</option>
                        {sessionTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        E-mail *
                      </label>
                      <input
                        type="email"
                        value={editForm.client_email}
                        onChange={(e) => setEditForm(prev => ({ ...prev, client_email: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Telefone *
                      </label>
                      <input
                        type="tel"
                        value={editForm.client_phone}
                        onChange={(e) => setEditForm(prev => ({ ...prev, client_phone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data *
                      </label>
                      <input
                        type="date"
                        value={editForm.event_date}
                        onChange={(e) => setEditForm(prev => ({ ...prev, event_date: e.target.value }))}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Horário *
                      </label>
                      <input
                        type="time"
                        value={editForm.event_time}
                        onChange={(e) => setEditForm(prev => ({ ...prev, event_time: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Observações
                    </label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              ) : (
                // Visualização normal
                <>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{event.client_name}</h3>
                        <p className="text-gray-600">
                          {event.session_type ? `${sessionTypeLabels[event.session_type] || event.session_type} - ${event.client_name}` : `Tipo não definido - ${event.client_name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(event.status)}
                      <select
                        value={event.status}
                        onChange={(e) => handleStatusChange(event.id, e.target.value)}
                        disabled={updatingId === event.id}
                        className="ml-2 text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                      >
                        <option value="scheduled">Agendado</option>
                        <option value="in-progress">Em Andamento</option>
                        <option value="completed">Concluído</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(event.event_date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span>{event.client_email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4" />
                      <span>{event.client_phone}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    {event.album_id && (
                      <button 
                        onClick={() => onViewAlbum?.(event.id)}
                        className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Ver Sessão
                      </button>
                    )}
                    <button 
                      onClick={() => handleEditStart(event)}
                      className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </button>
                    <button 
                      onClick={() => handleDelete(event.id)}
                      disabled={deletingId === event.id}
                      className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deletingId === event.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        )
      )}
    </div>
  );
};

export default EventList;