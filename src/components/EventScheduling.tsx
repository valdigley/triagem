import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, Clock, MapPin, User, Mail, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendWebhookToN8n, createGoogleCalendarEvent } from '../lib/api';

const eventSchema = z.object({
  clientName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  clientEmail: z.string().email('E-mail inválido'),
  clientPhone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  eventDate: z.string().min(1, 'Data é obrigatória'),
  eventTime: z.string().min(1, 'Horário é obrigatório'),
  location: z.string().min(5, 'Local deve ter pelo menos 5 caracteres'),
  notes: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

const EventScheduling: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
  });

  const onSubmit = async (data: EventFormData) => {
    setIsSubmitting(true);
    
    try {
      // Combine date and time
      const eventDateTime = new Date(`${data.eventDate}T${data.eventTime}`);
      
      // Create Google Calendar event
      const googleEventId = await createGoogleCalendarEvent({
        summary: `Sessão de Fotos - ${data.clientName}`,
        description: `Cliente: ${data.clientName}\nE-mail: ${data.clientEmail}\nTelefone: ${data.clientPhone}\nNotas: ${data.notes || 'Nenhuma'}`,
        start: eventDateTime,
        end: new Date(eventDateTime.getTime() + 2 * 60 * 60 * 1000), // 2 hours later
        location: data.location,
      });

      // Save to database (simulated)
      const eventData = {
        id: `event_${Date.now()}`,
        photographerId: 'current_photographer_id',
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone,
        eventDate: eventDateTime,
        location: data.location,
        notes: data.notes,
        status: 'scheduled',
        googleCalendarEventId: googleEventId,
        createdAt: new Date(),
      };

      // Send webhook to n8n for automation
      await sendWebhookToN8n('booking_created', {
        event: eventData,
        client: {
          name: data.clientName,
          email: data.clientEmail,
          phone: data.clientPhone,
        },
        photographer: {
          id: 'current_photographer_id',
          name: 'Nome do Fotógrafo',
          email: 'fotografo@email.com',
        },
      });

      toast.success('Agendamento criado com sucesso!');
      reset();
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Erro ao criar agendamento. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Novo Agendamento</h2>
          <p className="text-gray-600 mt-2">Agende uma nova sessão de fotos</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Client Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <User className="w-5 h-5 mr-2" />
              Informações do Cliente
            </h3>
            
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

          {/* Event Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Detalhes do Evento
            </h3>

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
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                Local *
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  {...register('location')}
                  type="text"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Endereço completo do local da sessão"
                />
              </div>
              {errors.location && (
                <p className="text-red-600 text-sm mt-1">{errors.location.message}</p>
              )}
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
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Criando...' : 'Criar Agendamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventScheduling;