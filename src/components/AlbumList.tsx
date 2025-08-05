import React, { useState } from 'react';
import { Image, Eye, Share2, Calendar, User, Plus, Trash2, Upload, Folder, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSupabaseData } from '../hooks/useSupabaseData';
import toast from 'react-hot-toast';

interface AlbumListProps {
  onViewAlbum?: (albumId: string) => void;
}

const AlbumList: React.FC<AlbumListProps> = ({ onViewAlbum }) => {
  const { events, albums, photos, createAlbum, uploadPhotos, deleteAlbum, loading } = useSupabaseData();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [createIndependent, setCreateIndependent] = useState(false);
  const [uploadingToAlbum, setUploadingToAlbum] = useState<string | null>(null);

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) {
      toast.error('Nome do álbum é obrigatório');
      return;
    }

    if (!createIndependent && !selectedEventId) {
      toast.error('Selecione um evento ou marque como álbum independente');
      return;
    }

    const eventId = createIndependent ? undefined : selectedEventId;
    console.log('Creating album:', { name: newAlbumName.trim(), eventId, independent: createIndependent });
    
    try {
      const success = await createAlbum(newAlbumName.trim(), eventId);
      if (success) {
        setNewAlbumName('');
        setSelectedEventId('');
        setCreateIndependent(false);
        setShowCreateForm(false);
      }
    } catch (error) {
      console.error('Error creating album:', error);
      toast.error('Erro ao criar álbum');
    }
  };

  const handlePhotoUpload = async (albumId: string, files: FileList) => {
    if (!files || files.length === 0) return;

    setUploadingToAlbum(albumId);
    
    try {
      const fileArray = Array.from(files);
      console.log(`Creating ${fileArray.length} demo photos for album ${albumId}`);
      
      const success = await uploadPhotos(albumId, fileArray);
      
      if (success) {
        toast.success(`${fileArray.length} fotos de demonstração criadas!`);
      }
    } catch (error) {
      console.error('Error creating demo photos:', error);
      toast.error('Erro ao criar fotos de demonstração');
    } finally {
      setUploadingToAlbum(null);
    }
  };

  const copyShareLink = (shareToken: string) => {
    const shareUrl = `${window.location.origin}/album/${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link de compartilhamento copiado!');
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

  const getAlbumStatus = (album: any) => {
    const albumPhotos = getAlbumPhotos(album.id);
    const selectedCount = getSelectedPhotosCount(album.id);
    
    if (albumPhotos.length === 0) {
      return { status: 'empty', label: 'Sem fotos', color: 'text-gray-500', bgColor: 'bg-gray-50' };
    }
    
    if (selectedCount > 0) {
      return { status: 'selected', label: 'Selecionado', color: 'text-green-600', bgColor: 'bg-green-50' };
    }
    
    return { status: 'pending', label: 'Aguardando', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
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
          <h1 className="text-2xl font-bold text-gray-900">Álbuns de Fotos</h1>
          <p className="text-gray-600">Gerencie álbuns e seleções de fotos para seus clientes</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Álbum
        </button>
      </div>

      {/* Formulário de criação */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Criar Novo Álbum
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Álbum
              </label>
              <input
                type="text"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: Sessão João e Maria - 15/03/2024"
              />
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={createIndependent}
                  onChange={(e) => {
                    setCreateIndependent(e.target.checked);
                    if (e.target.checked) {
                      setSelectedEventId('');
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Criar álbum independente (sem vincular a evento)
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Álbuns independentes podem ser usados para ensaios avulsos
              </p>
            </div>

            {!createIndependent && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Evento Relacionado *
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Selecione um evento...</option>
                  {events.filter(event => event.status !== 'cancelled').map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.client_name} - {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}
                    </option>
                  ))}
                </select>
                {events.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    Nenhum evento disponível. Crie um agendamento primeiro.
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewAlbumName('');
                  setSelectedEventId('');
                  setCreateIndependent(false);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateAlbum}
                disabled={!newAlbumName.trim() || (!createIndependent && !selectedEventId)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Criar Álbum
              </button>
            </div>
          </div>
        </div>
      )}

      {albums.length === 0 ? (
        <div className="text-center py-12">
          <Folder className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum álbum encontrado</h3>
          <p className="text-gray-600">Crie seu primeiro álbum para começar a organizar as fotos dos seus clientes</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => {
            const event = album.event_id ? getEventForAlbum(album.event_id) : null;
            const albumPhotos = getAlbumPhotos(album.id);
            const selectedCount = getSelectedPhotosCount(album.id);
            const status = getAlbumStatus(album);
            
            return (
              <div key={album.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{album.name}</h3>
                    {event ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User className="w-4 h-4" />
                          <span>{event.client_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Folder className="w-4 h-4" />
                        <span>Álbum independente</span>
                      </div>
                    )}
                  </div>
                  
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${status.color} ${status.bgColor} border`}>
                    {status.label}
                  </span>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{albumPhotos.length}</div>
                    <div className="text-xs text-gray-600">Total de Fotos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{selectedCount}</div>
                    <div className="text-xs text-gray-600">Selecionadas</div>
                  </div>
                </div>

                {/* Preview das fotos */}
                {albumPhotos.length > 0 && (
                  <div className="mb-4">
                    <div className="grid grid-cols-4 gap-1">
                      {albumPhotos.slice(0, 4).map((photo) => (
                        <div key={photo.id} className="aspect-square bg-gray-100 rounded overflow-hidden">
                          <img
                            src={photo.thumbnail_path}
                            alt={photo.filename}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = `https://picsum.photos/200/200?random=${photo.id.slice(-6)}`;
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    {albumPhotos.length > 4 && (
                      <p className="text-xs text-gray-500 mt-1 text-center">
                        +{albumPhotos.length - 4} fotos
                      </p>
                    )}
                  </div>
                )}

                {/* Upload de Fotos */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => e.target.files && handlePhotoUpload(album.id, e.target.files)}
                      className="hidden"
                      id={`upload-${album.id}`}
                      disabled={uploadingToAlbum === album.id}
                    />
                    <label
                      htmlFor={`upload-${album.id}`}
                      className={`flex items-center gap-2 w-full px-4 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors cursor-pointer text-sm font-medium justify-center ${
                        uploadingToAlbum === album.id ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {uploadingToAlbum === album.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Fazendo upload...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Upload de Fotos
                        </>
                      )}
                    </label>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => onViewAlbum?.(album.id)}
                    className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    Ver Fotos
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => copyShareLink(album.share_token)}
                      className="flex items-center gap-1 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors text-sm"
                      title="Copiar link de compartilhamento"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => deleteAlbum(album.id)}
                      className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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