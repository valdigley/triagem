import React, { useState, useEffect } from 'react';
import { Image, Eye, Share2, Calendar, User, Plus, Trash2, Upload, Wifi, WifiOff, RefreshCw, Folder, CheckCircle, AlertTriangle, Clock, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface AlbumListProps {
  onViewAlbum?: (albumId: string) => void;
}

const AlbumList: React.FC<AlbumListProps> = ({ onViewAlbum }) => {
  const { events, albums, photos, createAlbum, uploadPhotos, deleteAlbum, loading } = useSupabaseData();
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [uploadingToAlbum, setUploadingToAlbum] = useState<string | null>(null);
  const [ftpReceivingAlbums, setFtpReceivingAlbums] = useState<Set<string>>(new Set());
  const [lastFtpCheck, setLastFtpCheck] = useState<Record<string, Date>>({});
  const [togglingFtp, setTogglingFtp] = useState<string | null>(null);

  // Carregar estado inicial do FTP
  useEffect(() => {
    loadFtpStates();
  }, [albums]);

  const loadFtpStates = async () => {
    try {
      const ftpStates = new Set<string>();
      const checkTimes: Record<string, Date> = {};

      for (const album of albums) {
        // Verificar se tem monitoramento FTP ativo
        const hasActiveFtp = album.activity_log?.some(log => 
          log.type === 'ftp_monitoring_enabled' && 
          !album.activity_log?.some(laterLog => 
            laterLog.type === 'ftp_monitoring_disabled' && 
            new Date(laterLog.timestamp) > new Date(log.timestamp)
          )
        );

        if (hasActiveFtp) {
          ftpStates.add(album.id);
        }

        // Última verificação FTP
        const lastCheck = album.activity_log?.find(log => 
          log.type === 'ftp_scan_completed'
        );
        if (lastCheck) {
          checkTimes[album.id] = new Date(lastCheck.timestamp);
        }
      }

      setFtpReceivingAlbums(ftpStates);
      setLastFtpCheck(checkTimes);
    } catch (error) {
      console.error('Error loading FTP states:', error);
    }
  };

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim() || !selectedEventId) {
      toast.error('Preencha todos os campos');
      return;
    }

    console.log('Creating album:', { name: newAlbumName.trim(), eventId: selectedEventId });
    
    try {
      const success = await createAlbum(newAlbumName.trim(), selectedEventId);
      if (success) {
        setNewAlbumName('');
        setSelectedEventId('');
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
      console.log(`Starting upload of ${fileArray.length} files to album ${albumId}`);
      
      const success = await uploadPhotos(albumId, fileArray);
      
      if (success) {
        toast.success(`${fileArray.length} fotos reais enviadas com sucesso!`);
        
        // Atualizar log de atividade
        const album = albums.find(a => a.id === albumId);
        if (album) {
          try {
            const { data: currentAlbum } = await supabase
              .from('albums')
              .select('activity_log')
              .eq('id', albumId)
              .single();

            const currentLog = currentAlbum?.activity_log || [];
            const newActivity = {
              timestamp: new Date().toISOString(),
              type: 'manual_upload',
              description: `${fileArray.length} fotos reais adicionadas via upload manual`
            };

            await supabase
              .from('albums')
              .update({ 
                activity_log: [...currentLog, newActivity]
              })
              .eq('id', albumId);
          } catch (error) {
            console.error('Error updating activity log:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast.error('Erro no upload das fotos');
    } finally {
      setUploadingToAlbum(null);
    }
  };

  const toggleFtpReceiving = async (albumId: string) => {
    setTogglingFtp(albumId);
    
    try {
      const isCurrentlyReceiving = ftpReceivingAlbums.has(albumId);
      const newState = !isCurrentlyReceiving;
      
      // Atualizar log de atividade
      const { data: currentAlbum } = await supabase
        .from('albums')
        .select('activity_log')
        .eq('id', albumId)
        .single();

      const currentLog = currentAlbum?.activity_log || [];
      const newActivity = {
        timestamp: new Date().toISOString(),
        type: newState ? 'ftp_monitoring_enabled' : 'ftp_monitoring_disabled',
        description: newState 
          ? 'Monitoramento FTP ativado para recebimento automático'
          : 'Monitoramento FTP desativado'
      };

      const { error } = await supabase
        .from('albums')
        .update({ 
          activity_log: [...currentLog, newActivity]
        })
        .eq('id', albumId);

      if (error) {
        console.error('Error updating FTP state:', error);
        toast.error('Erro ao alterar estado do FTP');
        return;
      }

      // Atualizar estado local
      const newFtpStates = new Set(ftpReceivingAlbums);
      if (newState) {
        newFtpStates.add(albumId);
      } else {
        newFtpStates.delete(albumId);
      }
      setFtpReceivingAlbums(newFtpStates);

      toast.success(newState ? 'FTP ativado para este álbum!' : 'FTP desativado para este álbum!');
      
      // Se ativou, executar scan imediatamente
      if (newState) {
        await runFtpScan(albumId);
      }
      
    } catch (error) {
      console.error('Error toggling FTP:', error);
      toast.error('Erro ao alterar estado do FTP');
    } finally {
      setTogglingFtp(null);
    }
  };

  const runFtpScan = async (albumId?: string) => {
    try {
      if (!user) return;

      // Buscar photographer_id
      const { data: photographer } = await supabase
        .from('photographers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!photographer) {
        toast.error('Perfil do fotógrafo não encontrado');
        return;
      }

      // Verificar se as variáveis de ambiente estão configuradas
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        console.error('Supabase environment variables not configured');
        toast.error('Configuração do Supabase não encontrada');
        return;
      }

      console.log('🔍 Executando scan FTP REAL...');
      console.log('📁 Album ID:', albumId || 'Mais recente');
      console.log('👤 Photographer ID:', photographer.id);

      let response;
      try {
        response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ftp-monitor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            photographer_id: photographer.id,
            target_album_id: albumId,
            force_scan: true,
          }),
        });
      } catch (fetchError) {
        console.error('❌ Network error calling FTP monitor:', fetchError);
        
        // Verificar se é erro de conectividade
        if (fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
          toast.error('❌ Função FTP não disponível. Verifique se as Edge Functions estão ativas no Supabase.');
          console.log('💡 Possíveis soluções:');
          console.log('   1. Verifique se a função ftp-monitor está deployada no Supabase');
          console.log('   2. Confirme se as variáveis de ambiente estão corretas');
          console.log('   3. Verifique as configurações de CORS no Supabase');
        } else {
          toast.error(`❌ Erro de rede: ${fetchError.message}`);
        }
        return;
      }

      console.log('📡 FTP Monitor response status:', response.status);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('❌ Failed to parse error response:', parseError);
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        console.error('❌ FTP scan error:', errorData);
        toast.error(`❌ ${errorData.error || 'Erro no scan FTP'}`);
        return;
      }

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('❌ Failed to parse success response:', parseError);
        toast.error('❌ Erro ao processar resposta do servidor');
        return;
      }
      
      console.log('✅ FTP scan result:', result);
      console.log('📊 Photos processed:', result.photosProcessed);
      console.log('📂 Album used:', result.albumName);

      if (result.photosProcessed > 0) {
        toast.success(`🎉 ${result.photosProcessed} fotos REAIS adicionadas do FTP!`);
        console.log('🔄 Reloading page to show new photos...');
        // Recarregar dados
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        const ftpHost = result.ftpConfig?.host || 'servidor';
        const ftpPath = result.ftpPath || '';
        toast.warning(`⚠️ FTP verificado em ${ftpHost}${ftpPath} - nenhuma foto nova encontrada`);
        console.log('📭 No new photos found in FTP');
        console.log('🔧 Check if:');
        console.log('   1. Photos are in the correct folder:', ftpPath);
        console.log('   2. FTP credentials are correct');
        console.log('   3. Photos are image files (jpg, png, etc.)');
      }

      // Atualizar timestamp da última verificação
      if (albumId) {
        setLastFtpCheck(prev => ({
          ...prev,
          [albumId]: new Date()
        }));
      }

    } catch (error) {
      console.error('❌ Error in FTP scan:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`❌ Erro no scan FTP: ${errorMessage}`);
    }
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Criar Novo Álbum</h3>
          
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Evento Relacionado
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecione um evento...</option>
                {events.filter(event => event.status !== 'cancelled').map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.client_name} - {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })} ({event.status})
                  </option>
                ))}
              </select>
              {events.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Nenhum evento disponível. Crie um agendamento primeiro.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateAlbum}
                disabled={!newAlbumName.trim() || !selectedEventId}
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
            const event = getEventForAlbum(album.event_id);
            const albumPhotos = getAlbumPhotos(album.id);
            const selectedCount = getSelectedPhotosCount(album.id);
            const status = getAlbumStatus(album);
            const isFtpActive = ftpReceivingAlbums.has(album.id);
            const lastCheck = lastFtpCheck[album.id];
            
            return (
              <div key={album.id} className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${status.bgColor}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{album.name}</h3>
                    {event && (
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
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${status.color} bg-white border`}>
                      {status.label}
                    </span>
                    {isFtpActive && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <Wifi className="w-3 h-3" />
                        <span>FTP Ativo</span>
                      </div>
                    )}
                  </div>
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

                {/* Controles de FTP e Upload */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      {isFtpActive ? (
                        <Wifi className="w-4 h-4 text-green-600" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-gray-400" />
                      )}
                      <div>
                        <span className="text-sm font-medium text-blue-900">
                          Recepção FTP
                        </span>
                        {lastCheck && (
                          <div className="text-xs text-blue-700">
                            Última verificação: {format(lastCheck, "HH:mm", { locale: ptBR })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {/* Upload Manual */}
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
                          className={`flex items-center gap-1 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors cursor-pointer text-sm font-medium ${
                            uploadingToAlbum === album.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {uploadingToAlbum === album.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              📸 Upload Real
                            </>
                          )}
                        </label>
                      </div>

                      {/* FTP Toggle */}
                      <button
                        onClick={() => toggleFtpReceiving(album.id)}
                        disabled={togglingFtp === album.id}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 ${
                          isFtpActive
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {togglingFtp === album.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        ) : (
                          isFtpActive ? 'Desativar' : 'Ativar'
                        )}
                      </button>
                    </div>
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
                      onClick={() => runFtpScan(album.id)}
                      className="flex items-center gap-1 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors text-sm"
                      title="Verificar FTP agora"
                    >
                      <RefreshCw className="w-4 h-4" />
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