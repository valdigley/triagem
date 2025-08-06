import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, Clock, User, Mail, Phone, Camera } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const eventSchema = z.object({
  clientName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  clientEmail: z.string().email('E-mail inválido'),
  clientPhone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  sessionType: z.string().min(1, 'Tipo de sessão é obrigatório'),
  eventDate: z.string().min(1, 'Data é obrigatória'),
  eventTime: z.string().min(1, 'Horário é obrigatório'),
  notes: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

const sessionTypes = [
  { value: 'gestante', label: 'Sessão Gestante' },
  { value: 'aniversario', label: 'Aniversário' },
  { value: 'comerciais', label: 'Comerciais' },
  { value: 'pre-wedding', label: 'Pré Wedding' },
  { value: 'formatura', label: 'Formatura' },
  { value: 'revelacao-sexo', label: 'Revelação de Sexo' },
];

const PublicScheduling: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [photographerId, setPhotographerId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
  });

  useEffect(() => {
    loadPhotographerId();
  }, []);

  const loadPhotographerId = async () => {
    try {
      const { data: photographer } = await supabase
        .from('photographers')
        .select('id')
        .limit(1)
        .single();

      if (photographer) {
        setPhotographerId(photographer.id);
      }
    } catch (error) {
      console.error('Error loading photographer:', error);
    }
  };

  const onSubmit = async (data: EventFormData) => {
    if (!photographerId) {
      toast.error('Sistema não configurado');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const eventDateTime = new Date(`${data.eventDate}T${data.eventTime}`);
      
      const { error } = await supabase
        .from('events')
        .insert({
          photographer_id: photographerId,
          client_name: data.clientName,
          client_email: data.clientEmail,
          client_phone: data.clientPhone,
          session_type: data.sessionType,
          event_date: eventDateTime.toISOString(),
          location: 'Estúdio Fotográfico',
          notes: data.notes,
        });

      if (error) {
        toast.error('Erro ao criar agendamento');
        return;
      }

      setSuccess(true);
      reset();
      toast.success('Agendamento criado com sucesso!');
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Erro ao processar agendamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Agendamento Confirmado!</h2>
          <p className="text-gray-600 mb-6">
            Seu agendamento foi criado com sucesso. Entraremos em contato em breve.
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700"
          >
            Fazer Novo Agendamento
          </button>
        </div>
        <Toaster position="top-center" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Toaster position="top-center" />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Camera className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Estúdio Fotográfico</h1>
            <p className="text-xl text-gray-600">Agende sua sessão de fotos</p>
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Agende Agora</h2>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    {...register('clientName')}
                    type="text"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Seu nome completo"
                  />
                </div>
                {errors.clientName && (
                  <p className="text-red-600 text-sm mt-1">{errors.clientName.message}</p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    E-mail *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      {...register('clientEmail')}
                      type="email"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="seu@email.com"
                    />
                  </div>
                  {errors.clientEmail && (
                    <p className="text-red-600 text-sm mt-1">{errors.clientEmail.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefone *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      {...register('clientPhone')}
                      type="tel"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  {errors.clientPhone && (
                    <p className="text-red-600 text-sm mt-1">{errors.clientPhone.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Sessão *
                </label>
                <select
                  {...register('sessionType')}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Selecione o tipo...</option>
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

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      {...register('eventDate')}
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {errors.eventDate && (
                    <p className="text-red-600 text-sm mt-1">{errors.eventDate.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Horário *
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      {...register('eventTime')}
                      type="time"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {errors.eventTime && (
                    <p className="text-red-600 text-sm mt-1">{errors.eventTime.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  {...register('notes')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Observações sobre a sessão..."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors font-semibold text-lg"
              >
                {isSubmitting ? 'Processando...' : 'Agendar Sessão'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicScheduling;