import React, { useState } from 'react';
import { Image, Share2, Eye, Download, Calendar, User, Plus, Upload, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useSupabaseData } from '../hooks/useSupabaseData';

interface AlbumListProps {
  onViewAlbum?: (albumId: string) => void;
}

const AlbumList: React.FC<AlbumListProps> = ({ onViewAlbum }) => {
  const { events, albums, photos, createAlbum, uploadPhotos, deleteAlbum, loading } = useSupabaseData();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [albumName, setAlbumName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [uploadingAlbumId, setUploadingAlbumId] = useState<string | null>(null);

  // Eventos que ainda não têm álbum
  const eventsWithoutAlbum = events.filter(event => 
    !albums.some(album => album.event_id === event.id)
  );

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !albumName.trim()) {
      toast.error('Selecione um evento e digite um nome para o álbum');
      return;
    }

    setIsCreating(true);
    try {
      const success = await createAlbum({
        event_id: selectedEventId,
        name: albumName.trim(),
      });

      if (success) {
        setShowCreateForm(false);
        setSelectedEventId('');
        setAlbumName('');
        toast.success('Álbum criado com sucesso!');
      }
    } catch (error) {
      console.error('Error creating album:', error);
    } finally {
      setIsCreating(false);
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
    if (!confirm('Tem certeza que deseja excluir este álbum? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const success = await deleteAlbum(albumId);
      if (success) {
        toast.success('Álbum excluído com sucesso!');
      }
    } catch (error) {
      console.error('Error deleting album:', error);
    }
  };

  const copyShareLink = (shareToken: string) => {
    const shareUrl = `${window.location.origin}/album/${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copiado para a área de transferência!');
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
          <h1 className="text-2xl font-bold text-gray-900">Álbuns</h1>
          <p className="text-gray-600">Gerencie os álbuns de fotos dos seus clientes ({albums.length} álbuns)</p>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Criar Novo Álbum</h3>
          <form onSubmit={handleCreateAlbum} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecionar Evento
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Selecione um evento...</option>
                {eventsWithoutAlbum.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.client_name} - {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Álbum
              </label>
              <input
                type="text"
                value={albumName}
                onChange={(e) => setAlbumName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: Ensaio João e Maria"
                required
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
                disabled={isCreating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isCreating ? 'Criando...' : 'Criar Álbum'}
              </button>
            </div>
          </form>
        </div>
      )}

      {albums.length === 0 ? (
        <div className="text-center py-12">
          <Image className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum álbum encontrado</h3>
          <p className="text-gray-600 mb-4">Comece criando seu primeiro álbum</p>
          <button 
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar Álbum
          </button>
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
                            src={`https://picsum.photos/200/200?random=${photo.id.slice(-6)}`}
                            alt={photo.filename}
                            className="w-full h-full object-cover"
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
                  <button 
                    onClick={() => copyShareLink(album.share_token)}
                    className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Compartilhar
                  </button>
                  <button 
                    onClick={() => onViewAlbum?.(album.id)}
                    className="flex items-center gap-2 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Visualizar
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AlbumList;