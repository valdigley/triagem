import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, User, Phone, Mail, Eye, Plus, Edit, Trash2, X, Save, Camera, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGoogleDriveModal, setShowGoogleDriveModal] = useState(false);
  const [selectedEventForDrive, setSelectedEventForDrive] = useState<any>(null);
  const [googleDriveLink, setGoogleDriveLink] = useState('');
  const [sendingDriveLink, setSendingDriveLink] = useState(false);
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
      } else if (photographer && photographer.watermark_config?.sessionTypes) {
        setSessionTypes(photographer.watermark_config.sessionTypes);
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
    setIsSubmitting(true);
    try {
      // Combine date and time
      const eventDateTime = new Date(`${data.eventDate}T${data.eventTime}`);
      
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
      
      const success = await addEvent(eventData);
      if (success) {
        reset();
        setShowCreateForm(false);
        toast.success('Sessão criada com sucesso!');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Erro ao criar sessão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleDriveShare = (event: any) => {
    setSelectedEventForDrive(event);
    setGoogleDriveLink('');
    setShowGoogleDriveModal(true);
  };

  const sendGoogleDriveLink = async () => {
    if (!selectedEventForDrive || !googleDriveLink.trim()) {
      toast.error('Digite o link do Google Drive');
      return;
    }

    setSendingDriveLink(true);
    try {
      // Enviar via Evolution API
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          phone: selectedEventForDrive.client_phone,
          message: `Olá ${selectedEventForDrive.client_name}! 📸\n\nSuas fotos editadas estão prontas! 🎉\n\nAcesse o link abaixo para fazer o download:\n${googleDriveLink}\n\nQualquer dúvida, entre em contato conosco.\n\nObrigado!`,
          event_id: selectedEventForDrive.id,
          type: 'google_drive_share'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao enviar mensagem');
      }

      toast.success('Link do Google Drive enviado via WhatsApp!');
      setShowGoogleDriveModal(false);
      setSelectedEventForDrive(null);
      setGoogleDriveLink('');
    } catch (error) {
      console.error('Error sending Google Drive link:', error);
      toast.error(error.message || 'Erro ao enviar link');
    } finally {
      setSendingDriveLink(false);
    }
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
                    {event.status === 'completed' && (
                      <button 
                        onClick={() => handleGoogleDriveShare(event)}
                        className="flex items-center gap-2 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12.01 2C6.5 2 2.01 6.49 2.01 12s4.49 10 9.99 10c5.51 0 10-4.49 10-10S17.52 2 12.01 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                        </svg>
                        Compartilhar Drive
                      </button>
                    )}
                    <button 
                      onClick={() => handleGoogleDriveShare(event)}
                      className="flex items-center gap-2 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                      </svg>
                      Enviar Drive
                    </button>
                    {(() => {
                      // Buscar álbum relacionado ao evento
                      const relatedAlbum = albums.find(album => album.event_id === event.id);
                      return relatedAlbum && (
                      <button 
                        onClick={() => {
                          console.log('Clicking Ver Sessão for album:', relatedAlbum.id);
                          onViewAlbum?.(relatedAlbum.id);
                        }}
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

      {/* Modal do Google Drive */}
      {showGoogleDriveModal && selectedEventForDrive && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Compartilhar Google Drive</h2>
              <button
                onClick={() => setShowGoogleDriveModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Cliente:</strong> {selectedEventForDrive.client_name}
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  <strong>WhatsApp:</strong> {selectedEventForDrive.client_phone}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link do Google Drive *
                </label>
                <input
                  type="url"
                  value={googleDriveLink}
                  onChange={(e) => setGoogleDriveLink(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://drive.google.com/drive/folders/..."
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">📱 Mensagem que será enviada:</h4>
                <div className="text-sm text-blue-800 bg-white p-3 rounded border">
                  <p>Olá {selectedEventForDrive.client_name}! 📸</p>
                  <p className="mt-2">Suas fotos editadas estão prontas! 🎉</p>
                  <p className="mt-2">Acesse o link abaixo para fazer o download:</p>
                  <p className="mt-1 text-blue-600">{googleDriveLink || '[LINK DO GOOGLE DRIVE]'}</p>
                  <p className="mt-2">Qualquer dúvida, entre em contato conosco.</p>
                  <p className="mt-2">Obrigado!</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t">
              <button
                onClick={() => setShowGoogleDriveModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={sendGoogleDriveLink}
                disabled={sendingDriveLink || !googleDriveLink.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {sendingDriveLink ? 'Enviando...' : 'Enviar via WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventList;