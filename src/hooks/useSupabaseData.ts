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

export const useSupabaseData = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
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
        .eq('events.photographer_id', currentPhotographerId);

      if (albumsError) {
        console.error('Error loading albums:', albumsError);
      } else {
        setAlbums(albumsData || []);
      }

      // Carregar fotos
      if (albumsData && albumsData.length > 0) {
        const albumIds = albumsData.map(album => album.id);
        const { data: photosData, error: photosError } = await supabase
          .from('photos')
          .select('*')
          .in('album_id', albumIds);

        if (photosError) {
          console.error('Error loading photos:', photosError);
        } else {
          setPhotos(photosData || []);
        }
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

  // Carregar dados quando o usuário mudar
  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setEvents([]);
      setAlbums([]);
      setPhotos([]);
      setPhotographerId(null);
      setLoading(false);
    }
  }, [user]);

  return {
    events,
    albums,
    photos,
    loading,
    photographerId,
    addEvent,
    updateEvent,
    deleteEvent,
    refreshData: loadData,
  };
};