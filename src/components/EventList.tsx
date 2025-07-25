import React, { useState } from 'react';
import { Calendar, MapPin, User, Phone, Mail, Eye, Plus, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useData } from '../contexts/DataContext';
import toast from 'react-hot-toast';

interface EventListProps {
  onCreateNew?: () => void;
  onViewAlbum?: (eventId: string) => void;
}

const EventList: React.FC<EventListProps> = ({ onCreateNew, onViewAlbum }) => {
  const { events, updateEvent, deleteEvent } = useData();
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleStatusChange = (eventId: string, newStatus: string) => {
    updateEvent(eventId, { status: newStatus as any });
    toast.success('Status atualizado com sucesso!');
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) {
      return;
    }

    setDeletingId(eventId);
    try {
      // Simula delay
      await new Promise(resolve => setTimeout(resolve, 500));
      deleteEvent(eventId);
      toast.success('Agendamento excluído com sucesso!');
    } catch (error) {
      toast.error('Erro ao excluir agendamento');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>
          <p className="text-gray-600">Gerencie suas sessões de fotos ({events.length} agendamentos)</p>
        </div>
        <button 
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Agendamento
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum agendamento encontrado</h3>
          <p className="text-gray-600 mb-4">Comece criando seu primeiro agendamento</p>
          <button 
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar Agendamento
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {events.map((event) => (
            <div key={event.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{event.clientName}</h3>
                    <p className="text-gray-600">{event.notes || 'Sem observações'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(event.status)}
                  <select
                    value={event.status}
                    onChange={(e) => handleStatusChange(event.id, e.target.value)}
                    className="ml-2 text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <span>{format(event.eventDate, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{event.location}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span>{event.clientEmail}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-4 h-4" />
                  <span>{event.clientPhone}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                {event.albumId && (
                  <button 
                    onClick={() => onViewAlbum?.(event.id)}
                    className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Ver Álbum
                  </button>
                )}
                <button className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventList;