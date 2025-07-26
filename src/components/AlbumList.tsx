import React, { useState } from 'react';
import { Image, MessageCircle, Mail, Eye, Download, Calendar, User, Plus, Upload, Trash2, X, Copy, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useSupabaseData } from '../hooks/useSupabaseData';

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
  const { events, albums, photos, orders, createAlbum, uploadPhotos, deleteAlbum, loading } = useSupabaseData();
  const [uploadingAlbumId, setUploadingAlbumId] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [reactivatingAlbumId, setReactivatingAlbumId] = useState<string | null>(null);
  const [showFilenames, setShowFilenames] = useState<Record<string, boolean>>({});

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
      case 'Selecionado!': return 'text-green-600';
      case 'Não selecionado': return 'text-orange-600';
      case 'Sem fotos': return 'text-gray-400';
      default: return 'text-gray-500';
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
          <h1 className="text-2xl font-bold text-gray-900">Sessões</h1>
          <p className="text-gray-600">Visualize as sessões criadas automaticamente a partir dos agendamentos ({albums.length} sessões)</p>
        </div>
      </div>

      {albums.length === 0 ? (
        <div className="text-center py-12">
          <Image className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma sessão encontrada</h3>
          <p className="text-gray-600">As sessões aparecerão aqui automaticamente quando os agendamentos forem confirmados</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {albums.map((album) => {
            const event = getEventForAlbum(album.event_id);
            const albumPhotos = getAlbumPhotos(album.id);
            const selectedCount = getSelectedPhotosCount(album.id);
            
            return (
              <div key={album.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <Image className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{album.name}</h3>
                      {event && (
                        <p className="text-gray-600 flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {event.client_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                    album.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {album.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  {event && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                  )}
                  <div className="text-gray-600">
                    <span className="font-medium">{albumPhotos.length}</span> fotos
                  </div>
                  <div className="text-gray-600">
                    <span className="font-medium">{selectedCount}</span> selecionadas
                  </div>
                </div>

                {/* Preview das fotos */}
                {albumPhotos.length > 0 && (
                  <div className="mb-4">
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
                          <span className="text-xs text-gray-500">+{albumPhotos.length - 6}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedCount > 0 && albumPhotos.length > 0 && (
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(selectedCount / albumPhotos.length) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {Math.round((selectedCount / albumPhotos.length) * 100)}% das fotos selecionadas
                    </p>
                  </div>
                )}

                {/* Nomes de arquivos pesquisáveis */}
                {selectedCount > 0 && event && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
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
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 mb-2">
                              Cole no Windows Explorer ou Finder para localizar as fotos:
                            </p>
                            <div className="bg-white border border-gray-300 rounded p-2 font-mono text-xs text-gray-800 break-all max-h-32 overflow-y-auto">
                              {generateSearchableFilenames(album.id, event)}
                            </div>
                          </div>
                          <button
                            onClick={() => copyFilenames(generateSearchableFilenames(album.id, event))}
                            className="flex-shrink-0 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Copiar nomes de arquivos"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="mt-2 text-xs text-gray-500">
                          <p><strong>Formato:</strong> Nomes originais dos arquivos enviados</p>
                          <p><strong>Exemplo:</strong> "DSC_0001.jpg" OR "IMG_2345.jpg" OR "foto_sessao_01.jpg"</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Upload de fotos */}
                <div className="mb-4">
                  <label className="flex items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {uploadingAlbumId === album.id ? (
                        <>
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                          <p className="text-sm text-gray-600">Enviando fotos...</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold">Clique para adicionar fotos</span> ou arraste aqui
                          </p>
                          <p className="text-xs text-gray-500">PNG, JPG até 10MB cada</p>
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

                <div className="flex justify-end gap-2">
                  {event && (
                    <>
                      {selectedCount > 0 && (
                        <button 
                          onClick={() => copyFilenames(generateSearchableFilenames(album.id, event))}
                          className="flex items-center gap-2 px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Copiar nomes para busca no PC"
                        >
                          <Copy className="w-4 h-4" />
                          Copiar Nomes
                        </button>
                      )}
                      <button 
                        onClick={() => shareViaWhatsApp(album.share_token, event.client_name, event.client_phone)}
                        className="flex items-center gap-2 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </button>
                      <button 
                        onClick={() => shareViaEmail(album.share_token, event.client_name, event.client_email)}
                        className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                        E-mail
                      </button>
                    </>
                  )}
                  {selectedCount > 0 && (
                    <button 
                      onClick={() => reactivateSelection(album.id)}
                      disabled={reactivatingAlbumId === album.id}
                      className="flex items-center gap-2 px-3 py-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {reactivatingAlbumId === album.id ? 'Reativando...' : 'Reativar Seleção'}
                    </button>
                  )}
                  <button 
                    onClick={() => onViewAlbum?.(album.id)}
                    className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Ver Fotos
                  </button>
                  {selectedCount > 0 && (
                    <button className="flex items-center gap-2 px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeleteAlbum(album.id)}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Status da seleção:</span>
                  <span className={`font-semibold ${getSelectionStatusColor(album.id)}`}>
                    {getPaymentStatus(album.id)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AlbumList;