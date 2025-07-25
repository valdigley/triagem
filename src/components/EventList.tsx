import React, { useState } from 'react';
import { Calendar, MapPin, User, Phone, Mail, Eye, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Event {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  eventDate: Date;
  location: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
  albumId?: string;
}

const EventList: React.FC = () => {
  const [events] = useState<Event[]>([
    {
      id: '1',
      clientName: 'Ana Silva',
      clientEmail: 'ana@email.com',
      clientPhone: '(11) 99999-1111',
      eventDate: new Date('2024-01-25T14:00:00'),
      location: 'Parque Ibirapuera, São Paulo',
      status: 'completed',
      notes: 'Ensaio de família',
      albumId: 'album_1',
    },
    {
      id: '2',
      clientName: 'João Santos',
      clientEmail: 'joao@email.com',
      clientPhone: '(11) 99999-2222',
      eventDate: new Date('2024-01-28T16:00:00'),
      location: 'Praia de Copacabana, Rio de Janeiro',
      status: 'scheduled',
      notes: 'Ensaio pré-wedding',
    },
    {
      id: '3',
      clientName: 'Maria Costa',
      clientEmail: 'maria@email.com',
      clientPhone: '(11) 99999-3333',
      eventDate: new Date('2024-01-30T10:00:00'),
      location: 'Centro Histórico, Salvador',
      status: 'in-progress',
      notes: 'Book profissional',
    },
  ]);

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>
          <p className="text-gray-600">Gerencie suas sessões de fotos</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          Novo Agendamento
        </button>
      </div>

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
                  <p className="text-gray-600">{event.notes}</p>
                </div>
              </div>
              {getStatusBadge(event.status)}
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
                <button className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Eye className="w-4 h-4" />
                  Ver Álbum
                </button>
              )}
              <button className="px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventList;