import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, Clock, MapPin, User, Mail, Phone, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSupabaseData } from '../hooks/useSupabaseData';

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

interface EventSchedulingProps {
  onBack?: () => void;
}

const EventScheduling: React.FC<EventSchedulingProps> = ({ onBack }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addEvent } = useSupabaseData();
  
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
      
      // Adiciona o evento
      const success = await addEvent({
        client_name: data.clientName,
        client_email: data.clientEmail,
        client_phone: data.clientPhone,
        event_date: eventDateTime.toISOString(),
        location: data.location,
        notes: data.notes,
        status: 'scheduled',
      });

      if (success) {
        reset();
        // Volta para a lista após 1 segundo
        setTimeout(() => {
          onBack?.();
        }, 1000);
      }
      
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Erro ao criar agendamento. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Agendamentos
        </button>
      )}

      <div className="max-w-2xl">
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
            <div className="flex justify-end gap-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              )}
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
    </div>
  );
};

export default EventScheduling;