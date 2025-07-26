import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export interface Event {
  id: string;
  photographer_id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  event_date: string;
  location: string;
  notes?: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  google_calendar_event_id?: string;
  album_id?: string;
  created_at: string;
}

export interface Album {
  id: string;
  event_id: string;
  name: string;
  share_token: string;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
}

export interface Photo {
  id: string;
  album_id: string;
  filename: string;
  original_path: string;
  thumbnail_path: string;
  watermarked_path: string;
  is_selected: boolean;
  price: number;
  metadata?: any;
  created_at: string;
}

export interface Order {
  id: string;
  event_id: string;
  client_email: string;
  selected_photos: string[];
  total_amount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  payment_intent_id?: string;
  created_at: string;
}

export const useSupabaseData = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [photographerId, setPhotographerId] = useState<string | null>(null);

  // Buscar ou criar perfil do fotógrafo
  const ensurePhotographerProfile = async () => {
    if (!user) return null;

    try {
      // Primeiro, tentar buscar o perfil existente
      const { data: existingProfile, error: fetchError } = await supabase
        .from('photographers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (existingProfile) {
        setPhotographerId(existingProfile.id);
        return existingProfile.id;
      }

      // Se não existe, criar um novo perfil
      const { data: newProfile, error: insertError } = await supabase
        .from('photographers')
        .insert({
          user_id: user.id,
          business_name: user.name || 'Meu Estúdio',
          phone: '(11) 99999-9999',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating photographer profile:', insertError);
        return null;
      }

      setPhotographerId(newProfile.id);
      return newProfile.id;
    } catch (error) {
      console.error('Error ensuring photographer profile:', error);
      return null;
    }
  };

  // Carregar dados
  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const currentPhotographerId = await ensurePhotographerProfile();
      if (!currentPhotographerId) {
        setLoading(false);
        return;
      }

      // Carregar eventos
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('photographer_id', currentPhotographerId)
        .order('created_at', { ascending: false });

      if (eventsError) {
        console.error('Error loading events:', eventsError);
        toast.error('Erro ao carregar agendamentos');
      } else {
        setEvents(eventsData || []);
      }

      // Carregar álbuns
      const { data: albumsData, error: albumsError } = await supabase
        .from('albums')
        .select(`
          *,
          events!inner(photographer_id)
        `)
        .eq('events.photographer_id', currentPhotographerId)
        .order('created_at', { ascending: false });

      if (albumsError) {
        console.error('Error loading albums:', albumsError);
        toast.error('Erro ao carregar álbuns');
      } else {
        setAlbums(albumsData || []);
      }

      // Carregar fotos
      // Carregar todas as fotos dos álbuns do fotógrafo
      if (albumsData && albumsData.length > 0) {
        const albumIds = albumsData.map(album => album.id);
        const { data: photosData, error: photosError } = await supabase
          .from('photos')
          .select('*')
          .in('album_id', albumIds)
          .order('created_at', { ascending: false });

        if (photosError) {
          console.error('Error loading photos:', photosError);
          toast.error('Erro ao carregar fotos');
        } else {
          setPhotos(photosData || []);
        }
      } else {
        setPhotos([]);
      }

      // Carregar pedidos
      if (eventsData && eventsData.length > 0) {
        const eventIds = eventsData.map(event => event.id);
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .in('event_id', eventIds)
          .order('created_at', { ascending: false });

        if (ordersError) {
          console.error('Error loading orders:', ordersError);
        } else {
          setOrders(ordersData || []);
        }
      } else {
        setOrders([]);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Adicionar evento
  const addEvent = async (eventData: Omit<Event, 'id' | 'created_at' | 'photographer_id'>) => {
    if (!photographerId) {
      toast.error('Perfil do fotógrafo não encontrado');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .insert({
          ...eventData,
          photographer_id: photographerId,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding event:', error);
        toast.error('Erro ao criar agendamento');
        return null;
      }

      setEvents(prev => [data, ...prev]);
      toast.success('Agendamento criado com sucesso!');
      return data;
    } catch (error) {
      console.error('Error adding event:', error);
      toast.error('Erro ao criar agendamento');
      return null;
    }
  };

  // Atualizar evento
  const updateEvent = async (id: string, updates: Partial<Event>) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating event:', error);
        toast.error('Erro ao atualizar agendamento');
        return null;
      }

      setEvents(prev => prev.map(event => 
        event.id === id ? data : event
      ));
      toast.success('Agendamento atualizado!');
      return data;
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Erro ao atualizar agendamento');
      return null;
    }
  };

  // Excluir evento
  const deleteEvent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting event:', error);
        toast.error('Erro ao excluir agendamento');
        return false;
      }

      setEvents(prev => prev.filter(event => event.id !== id));
      toast.success('Agendamento excluído!');
      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Erro ao excluir agendamento');
      return false;
    }
  };

  // Criar álbum
  const createAlbum = async (albumData: { event_id: string; name: string }) => {
    try {
      const { data, error } = await supabase
        .from('albums')
        .insert({
          event_id: albumData.event_id,
          name: albumData.name,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating album:', error);
        toast.error('Erro ao criar álbum');
        return false;
      }

      setAlbums(prev => [data, ...prev]);
      toast.success('Álbum criado com sucesso!');
      return true;
    } catch (error) {
      console.error('Error creating album:', error);
      toast.error('Erro ao criar álbum');
      return false;
    }
  };

  // Upload de fotos (simulado - em produção seria para storage)
  const uploadPhotos = async (albumId: string, files: File[]) => {
    try {
      // Tentar upload real para Supabase Storage
      const photoPromises = files.map(async (file, index) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${albumId}_${Date.now()}_${index}.${fileExt}`;
        
        try {
          // Validar tipo de arquivo
          const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
          if (!allowedTypes.includes(file.type)) {
            throw new Error(`Tipo de arquivo não suportado: ${file.type}`);
          }

          // Validar tamanho (50MB max)
          if (file.size > 50 * 1024 * 1024) {
            throw new Error('Arquivo muito grande. Máximo 50MB.');
          }

          // Upload para o bucket 'photos'
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('photos')
            .upload(`original/${fileName}`, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type
            });

          if (uploadError) {
            console.error('Error uploading file:', file.name, uploadError);
            throw uploadError;
          }

          // Gerar URLs públicas
          const { data: { publicUrl: originalUrl } } = supabase.storage
            .from('photos')
            .getPublicUrl(`original/${fileName}`);

          // Para thumbnail e watermark, por enquanto usar a mesma imagem
          const { data: { publicUrl: thumbnailUrl } } = supabase.storage
            .from('photos')
            .getPublicUrl(`original/${fileName}`);

          const { data: { publicUrl: watermarkedUrl } } = supabase.storage
            .from('photos')
            .getPublicUrl(`original/${fileName}`);

          return {
            album_id: albumId,
            filename: file.name,
            original_path: originalUrl,
            thumbnail_path: thumbnailUrl,
            watermarked_path: watermarkedUrl,
            is_selected: false,
            price: 25.00,
            metadata: {
              size: file.size,
              type: file.type,
              uploadedAt: new Date().toISOString(),
            },
          };
        } catch (error) {
          console.error('Error uploading individual file:', file.name, error);
          
          // Se for erro de bucket, usar modo demo
          if (error.message?.includes('Bucket not found') || error.message?.includes('bucket')) {
            console.warn('Storage bucket not configured, using demo mode for:', file.name);
            return {
              album_id: albumId,
              filename: file.name,
              original_path: `https://picsum.photos/800/600?random=${Date.now()}_${index}`,
              thumbnail_path: `https://picsum.photos/300/200?random=${Date.now()}_${index}`,
              watermarked_path: `https://picsum.photos/800/600?random=${Date.now()}_${index}`,
              is_selected: false,
              price: 25.00,
              metadata: {
                size: file.size,
                type: file.type,
                demo: true,
                error: 'Storage not configured',
              },
            };
          }
          
          // Para outros erros, rejeitar
          throw error;
        }
      });

      try {
        const photosData = await Promise.all(photoPromises);
        
        // Separar fotos com sucesso das com erro
        const successfulPhotos = photosData.filter(photo => photo !== null);
        const demoPhotos = photosData.filter(photo => photo?.metadata?.demo);
        
        if (successfulPhotos.length === 0) {
          throw new Error('Nenhuma foto foi processada com sucesso');
        }

        const { data, error } = await supabase
          .from('photos')
          .insert(successfulPhotos)
          .select();

        if (error) {
          console.error('Error saving photos to database:', error);
          throw error;
        }

        setPhotos(prev => [...prev, ...data]);
        
        // Mensagem de sucesso personalizada
        if (demoPhotos.length > 0) {
          toast.success(`${data.length} fotos salvas! (${demoPhotos.length} em modo demo - configure o Storage)`);
        } else {
          toast.success(`${data.length} fotos enviadas com sucesso!`);
        }
        
        return true;
      } catch (error) {
        console.error('Error processing photos:', error);
        throw error;
      }
      
    } catch (error) {
      console.error('Error in photo upload process:', error);
      
      // Se for erro de configuração, tentar modo demo completo
      if (error.message?.includes('Bucket not found') || 
          error.message?.includes('bucket') ||
          error.message?.includes('storage')) {
        
        toast.error('Storage não configurado. Usando modo de demonstração.');
        return await uploadPhotosDemo(albumId, files);
      }
      
      // Para outros erros, mostrar mensagem específica
      toast.error(error.message || 'Erro no upload das fotos');
      return false;
    }
  };

  // Função de upload de demonstração melhorada
  const uploadPhotosDemo = async (albumId: string, files: File[]) => {
    try {
      const photosData = files.map((file, index) => ({
        album_id: albumId,
        filename: file.name,
        original_path: `https://picsum.photos/800/600?random=${Date.now()}_${index}`,
        thumbnail_path: `https://picsum.photos/300/200?random=${Date.now()}_${index}`,
        watermarked_path: `https://picsum.photos/800/600?random=${Date.now()}_${index}`,
        is_selected: false,
        price: 25.00,
        metadata: {
          size: file.size,
          type: file.type,
          demo: true,
          originalName: file.name,
        },
      }));

      const { data, error } = await supabase
        .from('photos')
        .insert(photosData)
        .select();

      if (error) {
        console.error('Error saving demo photos:', error);
        toast.error('Erro ao salvar fotos de demonstração');
        return false;
      }

      setPhotos(prev => [...prev, ...data]);
      toast.success(`${data.length} fotos de demonstração criadas! Configure o Supabase Storage para fotos reais.`);
      return true;
    } catch (error) {
      console.error('Error in demo upload:', error);
      toast.error('Erro no modo de demonstração');
      return false;
    }
  };

  // Excluir álbum
  const deleteAlbum = async (albumId: string) => {
    try {
      const { error } = await supabase
        .from('albums')
        .delete()
        .eq('id', albumId);

      if (error) {
        console.error('Error deleting album:', error);
        toast.error('Erro ao excluir álbum');
        return false;
      }

      setAlbums(prev => prev.filter(album => album.id !== albumId));
      setPhotos(prev => prev.filter(photo => photo.album_id !== albumId));
      toast.success('Álbum excluído com sucesso!');
      return true;
    } catch (error) {
      console.error('Error deleting album:', error);
      toast.error('Erro ao excluir álbum');
      return false;
    }
  };

  // Atualizar foto
  const updatePhoto = async (photoId: string, updates: Partial<Photo>) => {
    try {
      const { data, error } = await supabase
        .from('photos')
        .update(updates)
        .eq('id', photoId)
        .select()
        .single();

      if (error) {
        console.error('Error updating photo:', error);
        toast.error('Erro ao atualizar foto');
        return false;
      }

      setPhotos(prev => prev.map(photo => 
        photo.id === photoId ? data : photo
      ));
      return true;
    } catch (error) {
      console.error('Error updating photo:', error);
      toast.error('Erro ao atualizar foto');
      return false;
    }
  };

  // Carregar dados quando o usuário mudar
  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setEvents([]);
      setAlbums([]);
      setPhotos([]);
      setOrders([]);
      setPhotographerId(null);
      setLoading(false);
    }
  }, [user]);

  return {
    events,
    albums,
    photos,
    orders,
    loading,
    photographerId,
    addEvent,
    updateEvent,
    deleteEvent,
    refreshData: loadData,
    createAlbum,
    uploadPhotos,
    deleteAlbum,
    updatePhoto,
  };
};