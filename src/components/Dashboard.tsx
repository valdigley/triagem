import React, { useState, useEffect } from 'react';
import { Calendar, Image, Users, Plus, Eye, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  session_type: string;
  event_date: string;
  location: string;
  status: string;
  created_at: string;
}

interface Album {
  id: string;
  event_id: string;
  name: string;
  share_token: string;
  is_active: boolean;
  created_at: string;
}

interface Photo {
  id: string;
  album_id: string;
  filename: string;
  thumbnail_path: string;
  is_selected: boolean;
  price: number;
  created_at: string;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [photographerId, setPhotographerId] = useState<string | null>(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [uploadingToAlbum, setUploadingToAlbum] = useState<string | null>(null);

  // Form states
  const [eventForm, setEventForm] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    session_type: 'gestante',
    event_date: '',
    event_time: '',
    location: 'Estúdio Fotográfico',
    notes: ''
  });

  const [albumForm, setAlbumForm] = useState({
    name: '',
    event_id: ''
  });

  const sessionTypes = [
    { value: 'gestante', label: 'Sessão Gestante' },
    { value: 'aniversario', label: 'Aniversário' },
    { value: 'comerciais', label: 'Comerciais' },
    { value: 'pre-wedding', label: 'Pré Wedding' },
    { value: 'formatura', label: 'Formatura' },
    { value: 'revelacao-sexo', label: 'Revelação de Sexo' },
  ];

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      // Get photographer profile
      const { data: photographer } = await supabase
        .from('photographers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!photographer) {
        setLoading(false);
        return;
      }

      setPhotographerId(photographer.id);

      // Load events
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('photographer_id', photographer.id)
        .order('created_at', { ascending: false });

      setEvents(eventsData || []);

      // Load albums
      const { data: albumsData } = await supabase
        .from('albums')
        .select('*')
        .eq('photographer_id', photographer.id)
        .order('created_at', { ascending: false });

      setAlbums(albumsData || []);

      // Load photos
      if (albumsData && albumsData.length > 0) {
        const albumIds = albumsData.map(a => a.id);
        const { data: photosData } = await supabase
          .from('photos')
          .select('*')
          .in('album_id', albumIds)
          .order('created_at', { ascending: false });

        setPhotos(photosData || []);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async () => {
    if (!photographerId) return;

    try {
      const eventDateTime = new Date(`${eventForm.event_date}T${eventForm.event_time}`);
      
      const { data, error } = await supabase
        .from('events')
        .insert({
          photographer_id: photographerId,
          client_name: eventForm.client_name,
          client_email: eventForm.client_email,
          client_phone: eventForm.client_phone,
          session_type: eventForm.session_type,
          event_date: eventDateTime.toISOString(),
          location: eventForm.location,
          notes: eventForm.notes,
        })
        .select()
        .single();

      if (error) {
        toast.error('Erro ao criar evento');
        return;
      }

      setEvents(prev => [data, ...prev]);
      setEventForm({
        client_name: '',
        client_email: '',
        client_phone: '',
        session_type: 'gestante',
        event_date: '',
        event_time: '',
        location: 'Estúdio Fotográfico',
        notes: ''
      });
      setShowCreateEvent(false);
      toast.success('Evento criado com sucesso!');
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Erro ao criar evento');
    }
  };

  const createAlbum = async () => {
    if (!photographerId) return;

    try {
      const { data, error } = await supabase
        .from('albums')
        .insert({
          photographer_id: photographerId,
          event_id: albumForm.event_id || null,
          name: albumForm.name,
        })
        .select()
        .single();

      if (error) {
        toast.error('Erro ao criar álbum');
        return;
      }

      setAlbums(prev => [data, ...prev]);
      setAlbumForm({ name: '', event_id: '' });
      setShowCreateAlbum(false);
      toast.success('Álbum criado com sucesso!');
    } catch (error) {
      console.error('Error creating album:', error);
      toast.error('Erro ao criar álbum');
    }
  };

  const uploadPhotos = async (albumId: string, files: FileList) => {
    setUploadingToAlbum(albumId);
    
    try {
      const fileArray = Array.from(files);
      const uploadPromises = fileArray.map(async (file, index) => {
        const timestamp = Date.now() + index;
        const fileName = `${albumId}/${timestamp}_${file.name}`;
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('photos')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          return null;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('photos')
          .getPublicUrl(fileName);

        // Save to database
        const { data: photoData, error: photoError } = await supabase
          .from('photos')
          .insert({
            album_id: albumId,
            filename: file.name,
            original_path: publicUrl,
            thumbnail_path: publicUrl,
            watermarked_path: publicUrl,
            price: 25.00,
          })
          .select()
          .single();

        if (photoError) {
          console.error('Photo save error:', photoError);
          return null;
        }

        return photoData;
      });

      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(Boolean);
      
      setPhotos(prev => [...prev, ...successfulUploads]);
      toast.success(`${successfulUploads.length} fotos carregadas!`);
      
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast.error('Erro ao fazer upload');
    } finally {
      setUploadingToAlbum(null);
    }
  };

  const copyShareLink = (shareToken: string) => {
    const shareUrl = `${window.location.origin}/album/${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copiado!');
  };

  const deleteAlbum = async (albumId: string) => {
    if (!confirm('Excluir álbum e todas as fotos?')) return;

    try {
      const { error } = await supabase
        .from('albums')
        .delete()
        .eq('id', albumId);

      if (error) {
        toast.error('Erro ao excluir álbum');
        return;
      }

      setAlbums(prev => prev.filter(a => a.id !== albumId));
      setPhotos(prev => prev.filter(p => p.album_id !== albumId));
      toast.success('Álbum excluído!');
    } catch (error) {
      console.error('Error deleting album:', error);
      toast.error('Erro ao excluir álbum');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">Sistema de Seleção de Fotos</p>
            </div>
            <button
              onClick={() => logout()}
              className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{events.length}</p>
                <p className="text-gray-600">Eventos</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Image className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{albums.length}</p>
                <p className="text-gray-600">Álbuns</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{photos.length}</p>
                <p className="text-gray-600">Fotos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <button
            onClick={() => setShowCreateEvent(true)}
            className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow text-left"
          >
            <Plus className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900">Criar Evento</h3>
            <p className="text-gray-600">Agendar nova sessão de fotos</p>
          </button>

          <button
            onClick={() => setShowCreateAlbum(true)}
            className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow text-left"
          >
            <Image className="w-8 h-8 text-green-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900">Criar Álbum</h3>
            <p className="text-gray-600">Novo álbum de fotos</p>
          </button>
        </div>

        {/* Recent Albums */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Álbuns Recentes</h2>
          
          {albums.length === 0 ? (
            <p className="text-gray-600">Nenhum álbum criado ainda</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {albums.map((album) => {
                const albumPhotos = photos.filter(p => p.album_id === album.id);
                const selectedCount = albumPhotos.filter(p => p.is_selected).length;
                
                return (
                  <div key={album.id} className="border rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">{album.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      {albumPhotos.length} fotos • {selectedCount} selecionadas
                    </p>
                    
                    {/* Photo upload */}
                    <div className="mb-3">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => e.target.files && uploadPhotos(album.id, e.target.files)}
                        className="hidden"
                        id={`upload-${album.id}`}
                      />
                      <label
                        htmlFor={`upload-${album.id}`}
                        className={`flex items-center gap-2 w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer text-sm ${
                          uploadingToAlbum === album.id ? 'opacity-50' : ''
                        }`}
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingToAlbum === album.id ? 'Uploading...' : 'Upload Fotos'}
                      </label>
                    </div>

                    <div className="flex justify-between">
                      <button
                        onClick={() => copyShareLink(album.share_token)}
                        className="text-green-600 hover:text-green-700 text-sm"
                      >
                        Copiar Link
                      </button>
                      <button
                        onClick={() => deleteAlbum(album.id)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Criar Novo Evento</h3>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Nome do cliente"
                value={eventForm.client_name}
                onChange={(e) => setEventForm(prev => ({ ...prev, client_name: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              />
              
              <input
                type="email"
                placeholder="E-mail do cliente"
                value={eventForm.client_email}
                onChange={(e) => setEventForm(prev => ({ ...prev, client_email: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              />
              
              <input
                type="tel"
                placeholder="Telefone do cliente"
                value={eventForm.client_phone}
                onChange={(e) => setEventForm(prev => ({ ...prev, client_phone: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              />
              
              <select
                value={eventForm.session_type}
                onChange={(e) => setEventForm(prev => ({ ...prev, session_type: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {sessionTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              
              <input
                type="date"
                value={eventForm.event_date}
                onChange={(e) => setEventForm(prev => ({ ...prev, event_date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              />
              
              <input
                type="time"
                value={eventForm.event_time}
                onChange={(e) => setEventForm(prev => ({ ...prev, event_time: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateEvent(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={createEvent}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Criar Evento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Album Modal */}
      {showCreateAlbum && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Criar Novo Álbum</h3>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Nome do álbum"
                value={albumForm.name}
                onChange={(e) => setAlbumForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              />
              
              <select
                value={albumForm.event_id}
                onChange={(e) => setAlbumForm(prev => ({ ...prev, event_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Álbum independente</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.client_name} - {new Date(event.event_date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateAlbum(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={createAlbum}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Criar Álbum
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;