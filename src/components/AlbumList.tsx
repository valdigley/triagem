import React, { useState } from 'react';
import { Image, MessageCircle, Mail, Eye, Calendar, User, Plus, Upload, Trash2, X, Copy, FileText, Phone, Clock, Camera, Link } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

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

interface AlbumListProps {
  onViewAlbum?: (albumId: string) => void;
}

const sessionTypeLabels: Record<string, string> = {
  'gestante': 'Sessão Gestante',
  'aniversario': 'Aniversário',
  'comerciais': 'Comerciais',
  'pre-wedding': 'Pré Wedding',
  'formatura': 'Formatura',
  'revelacao-sexo': 'Revelação de Sexo',
};

const AlbumList: React.FC<AlbumListProps> = ({ onViewAlbum }) => {
  const { events, albums, photos, orders, createAlbum, uploadPhotos, deleteAlbum, addEvent, loading } = useSupabaseData();
  const { user } = useAuth();
  const [uploadingAlbumId, setUploadingAlbumId] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [reactivatingAlbumId, setReactivatingAlbumId] = useState<string | null>(null);
  const [showFilenames, setShowFilenames] = useState<Record<string, boolean>>({});
  const [editingDriveLink, setEditingDriveLink] = useState<string | null>(null);
  const [driveLink, setDriveLink] = useState('');
  const [savingDriveLink, setSavingDriveLink] = useState(false);
  const [sendingDriveMessage, setSendingDriveMessage] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionTypes, setSessionTypes] = useState<Array<{ value: string; label: string }>>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
  });

  // Carregar tipos de sessão das configurações
  React.useEffect(() => {
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

  // Forçar re-render quando álbuns mudarem
  React.useEffect(() => {
    // Este useEffect força o componente a re-renderizar quando os álbuns mudarem
  }, [albums]);

  const deletePhoto = async (photoId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta foto? Esta ação não pode ser desfeita.')) {
      return;
    }

    setDeletingPhotoId(photoId);
    try {
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase
        .from('photos')
        .delete()
        .eq('id', photoId);

      if (error) {
        console.error('Error deleting photo:', error);
        toast.error('Erro ao excluir foto');
        return;
      }

      toast.success('Foto excluída com sucesso!');
      // Forçar recarregamento dos dados
      window.location.reload();
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error('Erro ao excluir foto');
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const reactivateSelection = async (albumId: string) => {
    if (!confirm('Tem certeza que deseja reativar a seleção? O cliente poderá alterar suas fotos selecionadas.')) {
      return;
    }

    setReactivatingAlbumId(albumId);
    try {
      // Desmarcar todas as fotos como não selecionadas para permitir nova seleção
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase
        .from('photos')
        .update({ is_selected: false })
        .eq('album_id', albumId);

      if (error) {
        console.error('Error reactivating selection:', error);
        toast.error('Erro ao reativar seleção');
        return;
      }

      toast.success('Seleção reativada! O cliente pode fazer nova seleção.');
      // Forçar recarregamento dos dados
      window.location.reload();
    } catch (error) {
      console.error('Error reactivating selection:', error);
      toast.error('Erro ao reativar seleção');
    } finally {
      setReactivatingAlbumId(null);
    }
  };

  const handlePhotoUpload = async (albumId: string, files: FileList) => {
    if (!files || files.length === 0) return;

    setUploadingAlbumId(albumId);
    try {
      const success = await uploadPhotos(albumId, Array.from(files));
      if (success) {
        toast.success(`${files.length} fotos adicionadas com sucesso!`);
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
    } finally {
      setUploadingAlbumId(null);
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    if (!confirm('Tem certeza que deseja excluir este álbum? Todas as fotos serão permanentemente removidas. Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const success = await deleteAlbum(albumId);
      if (success) {
        toast.success('Álbum e todas as fotos excluídos com sucesso!');
      }
    } catch (error) {
      console.error('Error deleting album:', error);
    }
  };

  const shareViaWhatsApp = (shareToken: string, clientName: string, clientPhone: string) => {
    const shareUrl = `${window.location.origin}/album/${shareToken}`;
    const message = encodeURIComponent(`Olá ${clientName}! 📸 Suas fotos estão prontas para seleção! Acesse o link: ${shareUrl}`);
    
    // Limpar o telefone removendo caracteres especiais
    const cleanPhone = clientPhone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    const whatsappUrl = `https://wa.me/${fullPhone}?text=${message}`;
    window.open(whatsappUrl, '_blank');
    toast.success('Abrindo WhatsApp...');
  };

  const shareViaEmail = (shareToken: string, clientName: string, clientEmail: string) => {
    const shareUrl = `${window.location.origin}/album/${shareToken}`;
    const subject = encodeURIComponent('📸 Suas fotos estão prontas para seleção!');
    const body = encodeURIComponent(`Olá ${clientName}!\n\nSuas fotos estão prontas para seleção! 📸\n\nAcesse o link abaixo para visualizar e selecionar suas fotos favoritas:\n${shareUrl}\n\nQualquer dúvida, entre em contato conosco.\n\nObrigado!`);
    
    const emailUrl = `mailto:${clientEmail}?subject=${subject}&body=${body}`;
    window.open(emailUrl, '_blank');
    toast.success('Abrindo cliente de e-mail...');
  };

  const getAlbumPhotos = (albumId: string) => {
    return photos.filter(photo => photo.album_id === albumId);
  };

  const getSelectedPhotosCount = (albumId: string) => {
    return photos.filter(photo => photo.album_id === albumId && photo.is_selected).length;
  };

  const getEventForAlbum = (eventId: string) => {
    return events.find(event => event.id === eventId);
  };

  const getPaymentStatus = (albumId: string) => {
    const selectedCount = getSelectedPhotosCount(albumId);
    const totalPhotos = getAlbumPhotos(albumId).length;
    
    if (totalPhotos === 0) return 'Sem fotos';
    if (selectedCount > 0) return 'Selecionado!';
    return 'Não selecionado';
  };

  const getSelectionStatusColor = (albumId: string) => {
    const status = getPaymentStatus(albumId);
    switch (status) {
      case 'Selecionado!': return 'text-green-800';
      case 'Não selecionado': return 'text-yellow-800';
      case 'Sem fotos': return 'text-gray-600';
      default: return 'text-gray-500';
    }
  };

  const getSessionBackgroundColor = (albumId: string) => {
    const status = getPaymentStatus(albumId);
    switch (status) {
      case 'Selecionado!': return 'bg-green-50 border-green-200';
      case 'Não selecionado': return 'bg-yellow-50 border-yellow-200';
      case 'Sem fotos': return 'bg-gray-50 border-gray-200';
      default: return 'bg-white border-gray-200';
    }
  };

  const generateSearchableFilenames = (albumId: string, event: any) => {
    const albumPhotos = getAlbumPhotos(albumId);
    const selectedPhotos = albumPhotos.filter(photo => photo.is_selected);
    
    if (selectedPhotos.length === 0) return '';
    
    // Usar os nomes originais dos arquivos
    const filenames = selectedPhotos.map((photo) => {
      return `"${photo.filename}"`;
    });
    
    return filenames.join(' OR ');
  };

  const copyFilenames = (searchString: string) => {
    navigator.clipboard.writeText(searchString);
    toast.success('Nomes de arquivos copiados para a área de transferência!');
  };

  const toggleFilenames = (albumId: string) => {
    setShowFilenames(prev => ({
      ...prev,
      [albumId]: !prev[albumId]
    }));
  };

  const saveDriveLink = async (albumId: string) => {
    if (!driveLink.trim()) {
      toast.error('Digite um link válido');
      return;
    }

    setSavingDriveLink(true);
    try {
      const { supabase } = await import('../lib/supabase');
      
      // Buscar log atual do álbum
      const { data: currentAlbum } = await supabase
        .from('albums')
        .select('activity_log')
        .eq('id', albumId)
        .single();
      
      const currentLog = currentAlbum?.activity_log || [];
      const newActivity = {
        timestamp: new Date().toISOString(),
        type: 'drive_link_added',
        description: 'Link do Google Drive adicionado'
      };
      
      const { error } = await supabase
        .from('albums')
        .update({ 
          google_drive_link: driveLink.trim(),
          activity_log: [...currentLog, newActivity]
        })
        .eq('id', albumId);

      if (error) {
        console.error('Error saving drive link:', error);
        toast.error('Erro ao salvar link');
        return;
      }

      toast.success('Link do Google Drive salvo!');
      setEditingDriveLink(null);
      setDriveLink('');
      
      // Forçar recarregamento dos dados
      window.location.reload();
    } catch (error) {
      console.error('Error saving drive link:', error);
      toast.error('Erro ao salvar link');
    } finally {
      setSavingDriveLink(false);
    }
  };

  const sendDriveLinkViaWhatsApp = async (album: any, event: any) => {
    if (!album.google_drive_link) {
      toast.error('Nenhum link do Google Drive configurado para esta sessão');
      return;
    }

    setSendingDriveMessage(true);
    try {
      const sessionTypeLabel = event.session_type ? 
        sessionTypeLabels[event.session_type] || event.session_type : 
        'Sessão';

      const message = `Olá ${event.client_name}! 📸\n\nSuas fotos editadas estão prontas! 🎉\n\nAcesse o link abaixo para fazer o download:\n${album.google_drive_link}\n\nQualquer dúvida, entre em contato conosco.\n\nObrigado!`;
      
      // Limpar o telefone removendo caracteres especiais
      const cleanPhone = event.client_phone.replace(/\D/g, '');
      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      
      const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      
      toast.success('Abrindo WhatsApp com link do Google Drive...');
    } catch (error) {
      console.error('Error sending drive link:', error);
      toast.error('Erro ao enviar link');
    } finally {
      setSendingDriveMessage(false);
    }
  };

  const startEditingDriveLink = (albumId: string, currentLink: string = '') => {
    setEditingDriveLink(albumId);
    setDriveLink(currentLink);
  };

  const cancelEditingDriveLink = () => {
    setEditingDriveLink(null);
    setDriveLink('');
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
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Carregando álbuns...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Seleções</h1>
          <p className="text-gray-600">Gerencie seleções de fotos para seus clientes ({albums.length} seleções)</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar Seleção
        </button>
      </div>

      {/* Formulário de Criação de Sessão */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Criar Nova Seleção</h3>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Cliente *
                </label>
                <input
                  {...register('clientName')}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nome completo do cliente"
                />
                {errors.clientName && (
                  <p className="text-red-600 text-sm mt-1">{errors.clientName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Seleção *
                </label>
                <select
                  {...register('sessionType')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-mail *
                </label>
                <input
                  {...register('clientEmail')}
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="cliente@email.com"
                />
                {errors.clientEmail && (
                  <p className="text-red-600 text-sm mt-1">{errors.clientEmail.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone *
                </label>
                <input
                  {...register('clientPhone')}
                  type="tel"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="(11) 99999-9999"
                />
                {errors.clientPhone && (
                  <p className="text-red-600 text-sm mt-1">{errors.clientPhone.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data *
                </label>
                <input
                  {...register('eventDate')}
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.eventDate && (
                  <p className="text-red-600 text-sm mt-1">{errors.eventDate.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horário *
                </label>
                <input
                  {...register('eventTime')}
                  type="time"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.eventTime && (
                  <p className="text-red-600 text-sm mt-1">{errors.eventTime.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                {...register('notes')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Observações sobre a sessão..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Criando...' : 'Criar Sessão'}
              </button>
            </div>
          </form>
        </div>
      )}

      {albums.length === 0 ? (
        <div className="text-center py-12">
          <Image className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma seleção encontrada</h3>
          <p className="text-gray-600">As seleções aparecerão aqui quando forem criadas ou quando agendamentos forem confirmados</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-4">
          {albums.map((album) => {
            const event = getEventForAlbum(album.event_id);
            const albumPhotos = getAlbumPhotos(album.id);
            const selectedCount = getSelectedPhotosCount(album.id);
            
            return (
              <div key={album.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative max-w-lg mx-auto">
                {/* Status no canto superior direito */}
                <div className="absolute top-6 right-6">
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                    selectedCount > 0 
                      ? 'bg-green-100 text-green-800 border border-green-200' 
                      : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                  }`}>
                    {selectedCount > 0 ? 'Seleção Feita' : 'Aguardando Seleção'}
                  </span>
                </div>

                <div className="pr-32 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <Image className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{album.name}</h3>
                      {event && (
                        <p className="text-gray-600 flex items-center gap-1 mt-1">
                          <User className="w-4 h-4" />
                          {event.client_name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  {event && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar className="w-4 h-4" />
                      <span className="font-medium">{format(new Date(event.event_date), "dd/MM", { locale: ptBR })}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-700">
                    <Camera className="w-4 h-4" />
                    <span><span className="font-medium">{albumPhotos.length}</span> fotos</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Eye className="w-4 h-4" />
                    <span><span className="font-medium">{selectedCount}</span> selecionadas</span>
                  </div>
                </div>

                {/* Preview das fotos */}
                {albumPhotos.length > 0 ? (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Preview das Fotos</h4>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {albumPhotos.slice(0, 6).map((photo) => (
                        <div key={photo.id} className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                          <img
                            src={photo.thumbnail_path}
                            alt={photo.filename}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback para imagem de demonstração se a real falhar
                              e.currentTarget.src = `https://picsum.photos/200/200?random=${photo.id.slice(-6)}`;
                            }}
                          />
                        </div>
                      ))}
                      {albumPhotos.length > 6 && (
                        <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                          <span className="text-sm text-gray-500 font-medium">+{albumPhotos.length - 6}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 text-sm">Nenhuma foto carregada</p>
                    <p className="text-gray-500 text-xs">Adicione fotos para que o cliente possa fazer a seleção</p>
                  </div>
                )}

                {/* Log de Atividades */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Histórico de Atividades
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-3">
                    {album.activity_log && album.activity_log.length > 0 ? (
                      <div className="space-y-2">
                        {album.activity_log.slice(-3).map((activity: any, index: number) => (
                          <div key={index} className="flex items-start gap-2 text-xs">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                            <div className="flex-1">
                              <p className="text-gray-700">{activity.description}</p>
                              <p className="text-gray-500 mt-0.5">
                                {format(new Date(activity.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                        ))}
                        {album.activity_log.length > 3 && (
                          <p className="text-xs text-gray-500 text-center pt-1 border-t border-gray-200">
                            +{album.activity_log.length - 3} atividades anteriores
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <p className="text-xs text-gray-500">Nenhuma atividade registrada</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload de fotos - apenas quando não há seleção */}
                {selectedCount === 0 && (
                  <div className="mb-4">
                    <label className="flex items-center justify-center w-full h-20 border-2 border-gray-300 border-dashed rounded cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex flex-col items-center justify-center">
                        {uploadingAlbumId === album.id ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mb-1"></div>
                            <p className="text-xs text-gray-600">Enviando...</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-5 h-5 text-gray-400 mb-1" />
                            <p className="text-xs text-gray-600">
                              <span className="font-semibold">Adicionar fotos</span>
                            </p>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        accept="image/*"
                        onChange={(e) => e.target.files && handlePhotoUpload(album.id, e.target.files)}
                        disabled={uploadingAlbumId === album.id}
                      />
                    </label>
                  </div>
                )}

                {/* Botões de ação - só aparecem quando há fotos */}
                {albumPhotos.length > 0 ? (
                  <div className="flex justify-end gap-2 flex-wrap">
                    {event && (
                      <>
                        {selectedCount > 0 && (
                          <button 
                            onClick={() => copyFilenames(generateSearchableFilenames(album.id, event))}
                            className="flex items-center gap-1 px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-lg text-sm transition-colors"
                            title="Copiar nomes para busca no PC"
                          >
                            <Copy className="w-4 h-4" />
                            Copiar Nomes
                          </button>
                        )}
                        {album.google_drive_link && selectedCount > 0 && (
                          <button 
                            onClick={() => sendDriveLinkViaWhatsApp(album, event)}
                            disabled={sendingDriveMessage}
                            className="flex items-center gap-1 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg text-sm transition-colors disabled:opacity-50"
                            title="Enviar link do Google Drive via WhatsApp"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                            </svg>
                            {sendingDriveMessage ? 'Enviando...' : 'Enviar Drive'}
                          </button>
                        )}
                        <button 
                          onClick={() => shareViaWhatsApp(album.share_token, event.client_name, event.client_phone)}
                          className="flex items-center gap-1 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg text-sm transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          WhatsApp
                        </button>
                        <button 
                          onClick={() => shareViaEmail(album.share_token, event.client_name, event.client_email)}
                          className="flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                          E-mail
                        </button>
                      </>
                    )}
                    {selectedCount > 0 && (
                    <>
                        <button 
                          onClick={() => reactivateSelection(album.id)}
                          disabled={reactivatingAlbumId === album.id}
                          className="flex items-center gap-1 px-3 py-2 text-orange-600 hover:bg-orange-50 rounded-lg text-sm transition-colors disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {reactivatingAlbumId === album.id ? 'Reativando...' : 'Reativar'}
                        </button>
                    </>
                    )}
                    <button 
                      onClick={() => {
                        console.log('Clicking Ver Fotos for album:', album.id);
                        onViewAlbum?.(album.id);
                      }}
                      className="flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      Ver Fotos
                    </button>
                    <button 
                      onClick={() => handleDeleteAlbum(album.id)}
                      className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                  </div>
                ) : (
                  <div className="mb-4 text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 text-sm">Nenhuma foto carregada</p>
                    <p className="text-gray-500 text-xs">Adicione fotos para que o cliente possa fazer a seleção</p>
                  </div>
                )}

                {selectedCount > 0 && albumPhotos.length > 0 && (
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${(selectedCount / albumPhotos.length) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {Math.round((selectedCount / albumPhotos.length) * 100)}% das fotos selecionadas
                    </p>
                  </div>
                )}

                {/* Nomes de arquivos pesquisáveis */}
                {selectedCount > 0 && event && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-medium text-gray-700 flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        Nomes para Busca no PC ({selectedCount} fotos)
                      </h4>
                      <button
                        onClick={() => toggleFilenames(album.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {showFilenames[album.id] ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                    
                    {showFilenames[album.id] && (
                      <div className="bg-gray-50 border border-gray-200 rounded p-2">
                        <div className="flex items-start gap-1">
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 mb-2">
                              Cole no Windows Explorer ou Finder para localizar as fotos:
                            </p>
                            <div className="bg-white border border-gray-300 rounded p-1 font-mono text-xs text-gray-800 break-all max-h-20 overflow-y-auto">
                              {generateSearchableFilenames(album.id, event)}
                            </div>
                          </div>
                          <button
                            onClick={() => copyFilenames(generateSearchableFilenames(album.id, event))}
                            className="flex-shrink-0 p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Copiar nomes de arquivos"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        
                        <div className="mt-1 text-xs text-gray-500">
                          <p><strong>Formato:</strong> Nomes originais dos arquivos enviados</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Google Drive Link */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-medium text-gray-700 flex items-center gap-1">
                      <Link className="w-4 h-4" />
                      Link Google Drive (Fotos Editadas)
                    </h4>
                    {!editingDriveLink && (
                      <button
                        onClick={() => startEditingDriveLink(album.id, album.google_drive_link || '')}
                        className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {album.google_drive_link ? 'Editar' : 'Adicionar'}
                      </button>
                    )}
                  </div>
                  
                  {editingDriveLink === album.id ? (
                    <div className="bg-gray-50 border border-gray-200 rounded p-2">
                      <div className="flex gap-2 mb-2">
                        <input
                          type="url"
                          value={driveLink}
                          onChange={(e) => setDriveLink(e.target.value)}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                          placeholder="https://drive.google.com/drive/folders/..."
                        />
                        <button
                          onClick={() => saveDriveLink(album.id)}
                          disabled={savingDriveLink}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {savingDriveLink ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                          onClick={cancelEditingDriveLink}
                          className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Cole o link da pasta do Google Drive com as fotos editadas
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded p-2">
                      {album.google_drive_link ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 text-xs text-gray-700 break-all">
                            {album.google_drive_link}
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(album.google_drive_link)}
                            className="flex-shrink-0 p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Copiar link"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">Nenhum link configurado</p>
                      )}
                    </div>
                  )}
                </div>
                {/* Upload de fotos */}
                {/* Upload de fotos - apenas quando não há seleção */}
                {selectedCount === 0 && (
                  <div className="mb-4">
                    <label className="flex items-center justify-center w-full h-20 border-2 border-gray-300 border-dashed rounded cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex flex-col items-center justify-center">
                        {uploadingAlbumId === album.id ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mb-1"></div>
                            <p className="text-xs text-gray-600">Enviando...</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-5 h-5 text-gray-400 mb-1" />
                            <p className="text-xs text-gray-600">
                              <span className="font-semibold">Adicionar fotos</span>
                            </p>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        accept="image/*"
                        onChange={(e) => e.target.files && handlePhotoUpload(album.id, e.target.files)}
                        disabled={uploadingAlbumId === album.id}
                      />
                    </label>
                  </div>
                )}

                {/* Botões de ação - só aparecem quando há fotos */}
                {albumPhotos.length > 0 ? (
                  <div className="flex justify-end gap-2 flex-wrap">
                    {event && (
                      <>
                        {selectedCount > 0 && (
                          <button 
                            onClick={() => copyFilenames(generateSearchableFilenames(album.id, event))}
                            className="flex items-center gap-1 px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-lg text-sm transition-colors"
                            title="Copiar nomes para busca no PC"
                          >
                            <Copy className="w-4 h-4" />
                            Copiar Nomes
                          </button>
                        )}
                        {album.google_drive_link && selectedCount > 0 && (
                          <button 
                            onClick={() => sendDriveLinkViaWhatsApp(album, event)}
                            disabled={sendingDriveMessage}
                            className="flex items-center gap-1 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg text-sm transition-colors disabled:opacity-50"
                            title="Enviar link do Google Drive via WhatsApp"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                            </svg>
                            {sendingDriveMessage ? 'Enviando...' : 'Enviar Drive'}
                          </button>
                        )}
                        <button 
                          onClick={() => shareViaWhatsApp(album.share_token, event.client_name, event.client_phone)}
                          className="flex items-center gap-1 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg text-sm transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          WhatsApp
                        </button>
                        <button 
                          onClick={() => shareViaEmail(album.share_token, event.client_name, event.client_email)}
                          className="flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                          E-mail
                        </button>
                      </>
                    )}
                    {selectedCount > 0 && (
                    <>
                        <button 
                          onClick={() => reactivateSelection(album.id)}
                          disabled={reactivatingAlbumId === album.id}
                          className="flex items-center gap-1 px-3 py-2 text-orange-600 hover:bg-orange-50 rounded-lg text-sm transition-colors disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {reactivatingAlbumId === album.id ? 'Reativando...' : 'Reativar'}
                        </button>
                    </>
                    )}
                    <button 
                      onClick={() => {
                        console.log('Clicking Ver Fotos for album:', album.id);
                        onViewAlbum?.(album.id);
                      }}
                      className="flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      Ver Fotos
                    </button>
                    <button 
                      onClick={() => handleDeleteAlbum(album.id)}
                      className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-500">Adicione fotos para que o cliente possa fazer a seleção</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AlbumList;