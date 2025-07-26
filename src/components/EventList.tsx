import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, User, Phone, Mail, Eye, Plus, Edit, Trash2, X, Save, Camera, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface EventListProps {
  onViewAlbum?: (albumId: string) => void;
}

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

const sessionTypeLabels: Record<string, string> = {
  'gestante': 'Sessão Gestante',
  'aniversario': 'Aniversário',
  'comerciais': 'Comerciais',
  'pre-wedding': 'Pré Wedding',
  'formatura': 'Formatura',
  'revelacao-sexo': 'Revelação de Sexo',
};

const sessionTypes = [
  // Será carregado dinamicamente das configurações
];

const EventList: React.FC<EventListProps> = ({ onViewAlbum }) => {
  const { events, albums, updateEvent, deleteEvent, addEvent, loading } = useSupabaseData();
  const { user } = useAuth();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sessionTypes, setSessionTypes] = useState<Array<{ value: string; label: string }>>([]);
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

  // Carregar tipos de sessão das configurações
  useEffect(() => {
    loadSessionTypes();
  }, [user]);

  const loadSessionTypes = async () => {
    if (!user) return;

    try {
      const { data: photographer } = await supabase
        .from('photographers')
        .select('watermark_config')
        .eq('user_id', user.id)
        .limit(1);

      if (photographer && photographer.length > 0 && photographer[0].watermark_config?.sessionTypes) {
        setSessionTypes(photographer[0].watermark_config.sessionTypes);
      } else {
        // Tipos padrão se não houver configuração
        setSessionTypes([
          { value: 'gestante', label: 'Sessão Gestante' },
          { value: 'aniversario', label: 'Aniversário' },
          { value: 'comerciais', label: 'Comerciais' },
          { value: 'pre-wedding', label: 'Pré Wedding' },
          { value: 'formatura', label: 'Formatura' },
          { value: 'revelacao-sexo', label: 'Revelação de Sexo' },
        ]);
      }
    } catch (error) {
      console.error('Error loading session types:', error);
    }
  };
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
      // toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Validar data
    const selectedDate = new Date(`${editForm.event_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      // toast.error('A data não pode ser anterior a hoje');
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
        // toast.success('Sua sessão foi agendada com sucesso!');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      // toast.error('Erro ao confirmar agendamento.');
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
          <p className="text-gray-600">Visualize e gerencie seus agendamentos ({events.length} agendamentos)</p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum agendamento encontrado</h3>
          <p className="text-gray-600">Os agendamentos feitos através do link público aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-6">
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
                    {(() => {
                      // Buscar álbum relacionado ao evento
                      const relatedAlbum = albums.find(album => album.event_id === event.id);
                      return relatedAlbum && (
                      <button 
                        onClick={() => onViewAlbum?.(relatedAlbum.id)}
                        className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Ver Sessão
                      </button>
                    );
                    })()}
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
      )}
    </div>
  );
};

export default EventList;