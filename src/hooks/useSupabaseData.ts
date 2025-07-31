import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Client } from '../types';
import { createGoogleCalendarService, getGoogleCalendarConfig } from '../lib/googleCalendar';
import toast from 'react-hot-toast';

const sessionTypeLabels: Record<string, string> = {
  'gestante': 'Sessão Gestante',
  'aniversario': 'Aniversário',
  'comerciais': 'Comerciais',
  'pre-wedding': 'Pré Wedding',
  'formatura': 'Formatura',
  'revelacao-sexo': 'Revelação de Sexo',
};

export interface Event {
  id: string;
  photographer_id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  session_type?: string;
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
  google_drive_link?: string;
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
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [photographerId, setPhotographerId] = useState<string | null>(null);

  // Buscar ou criar perfil do fotógrafo
  const ensurePhotographerProfile = async () => {
    if (!user) return null;

    try {
      // Primeiro, verificar se há múltiplos perfis e limpar duplicatas
      const { data: existingProfile, error: fetchError } = await supabase
        .from('photographers')
        .select('id, user_id')
        .eq('user_id', user.id)
        .maybeSingle();

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
        console.log('Loading photos for albums:', albumIds);
        
        const { data: photosData, error: photosError } = await supabase
          .from('photos')
          .select('*')
          .in('album_id', albumIds)
          .order('created_at', { ascending: false });

        if (photosError) {
          console.error('Error loading photos:', photosError);
          toast.error('Erro ao carregar fotos');
        } else {
          console.log(`Loaded ${photosData?.length || 0} total photos`);
          setPhotos(photosData || []);
        }
      } else {
        setPhotos([]);
      }

      // Carregar pedidos
      if (eventsData && eventsData.length > 0) {
        const eventIds = eventsData.map(event => event.id);
        try {
          const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .in('event_id', eventIds)
            .order('created_at', { ascending: false });

          if (ordersError) {
            console.error('Error loading orders:', ordersError);
            setOrders([]);
          } else {
            setOrders(ordersData || []);
          }
        } catch (error) {
          console.error('Network error loading orders:', error);
          setOrders([]);
        }
      } else {
        setOrders([]);
      }

      // Carregar clientes
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientsError) {
        console.error('Error loading clients:', clientsError);
      } else {
        setClients(clientsData || []);
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
    const isManualSelection = true; // Sempre manual quando criado via interface de seleções
    
    if (!photographerId) {
      toast.error('Perfil do fotógrafo não encontrado');
      return null;
    }

    try {
      // Primeiro, verificar se o cliente já existe ou criar um novo
      await upsertClient({
        name: eventData.client_name,
        email: eventData.client_email,
        phone: eventData.client_phone,
      });

      // Tentar criar evento no Google Calendar primeiro
      let googleEventId: string | null = null;
      
      // Não sincronizar com Google Calendar para seleções manuais
      if (!isManualSelection) {
        // Verificar se Google Calendar está configurado antes de tentar
        const googleCalendarConfig = await getGoogleCalendarConfig(user?.id || '');
        
        if (user && googleCalendarConfig?.accessToken && googleCalendarConfig.accessToken.trim() && googleCalendarConfig.accessToken.length > 20) {
          try {
            console.log('🗓️ GOOGLE CALENDAR: Tentando criar evento...');
            
            // Tentar integração real com Google Calendar
            const googleCalendarService = await createGoogleCalendarService(user.id);
            
            if (googleCalendarService) {
              googleEventId = await googleCalendarService.createEvent(eventData);
              if (googleEventId) {
                console.log('✅ Google Calendar event criado com sucesso');
              } else {
                console.warn('⚠️ Google Calendar não sincronizado - verifique configurações');
              }
            } else {
              console.warn('⚠️ Google Calendar não configurado');
            }
            
          } catch (error) {
            console.warn('⚠️ Google Calendar indisponível, continuando sem sincronização');
            googleEventId = null;
          }
        } else {
          console.log('ℹ️ Google Calendar não configurado');
        }
      } else {
        console.log('📝 Seleção manual - não sincronizando com Google Calendar');
      }

      const { data, error } = await supabase
        .from('events')
        .insert({
          ...eventData,
          photographer_id: photographerId,
          google_calendar_event_id: googleEventId,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding event:', error);
        toast.error('Erro ao criar agendamento');
        throw error;
      }

      setEvents(prev => [data, ...prev]);
      
      // Criar álbum automaticamente para o evento
      try {
        const sessionTypeLabel = eventData.session_type ? 
          sessionTypeLabels[eventData.session_type] || eventData.session_type : 
          'Sessão';
        const albumName = `${sessionTypeLabel} - ${eventData.client_name}`;

        console.log('Creating album for manual event:', albumName);
        
        const { data: newAlbum, error: albumError } = await supabase
          .from('albums')
          .insert({
            event_id: data.id,
            name: albumName,
          })
          .select()
          .single();

        if (albumError) {
          console.error('Error creating album for manual event:', albumError);
          toast.error('Evento criado, mas falha ao criar álbum');
        } else {
          console.log('Album created successfully:', newAlbum.id);
          setAlbums(prev => [newAlbum, ...prev]);
          
          // Atualizar o evento com o album_id
          await supabase
            .from('events')
            .update({ album_id: newAlbum.id })
            .eq('id', data.id);
        }
      } catch (error) {
        console.error('Error creating album for manual event:', error);
        // Não falhar o processo se o álbum não for criado
      }
      
      toast.success('Seleção criada com sucesso!');
      
      return data;
    } catch (error) {
      console.error('Error adding event:', error);
      
      toast.error('Erro ao criar seleção');
      return null;
    }
  };

  // Atualizar evento
  const updateEvent = async (id: string, updates: Partial<Event>) => {
    try {
      // Buscar evento atual para obter google_calendar_event_id
      const currentEvent = events.find(e => e.id === id);
      
      // Tentar atualizar no Google Calendar se configurado
      if (user && currentEvent?.google_calendar_event_id) {
        try {
          console.log('Tentando atualizar evento no Google Calendar...');
          console.log('Google Calendar Event ID:', currentEvent.google_calendar_event_id);
          
          const googleCalendarService = await createGoogleCalendarService(user.id);
          
          if (googleCalendarService) {
            const eventDataForUpdate = { ...currentEvent, ...updates };
            await googleCalendarService.updateEvent(currentEvent.google_calendar_event_id, eventDataForUpdate);
            console.log('Google Calendar event atualizado com sucesso');
          } else {
            console.log('Google Calendar não configurado - pulando atualização');
          }
        } catch (error) {
          console.error('Failed to update Google Calendar event:', error);
          // Não falhar o processo se o Google Calendar der erro
        }
      }

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
      
      if (currentEvent?.google_calendar_event_id) {
        if (await createGoogleCalendarService(user.id)) {
          toast.success('Agendamento atualizado e sincronizado com Google Calendar!');
        } else {
          toast.success('Agendamento atualizado!');
        }
      } else {
        toast.success('Agendamento atualizado!');
      }
      
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
      // Buscar evento para obter google_calendar_event_id
      const eventToDelete = events.find(e => e.id === id);
      
      // Tentar excluir do Google Calendar se configurado
      if (user && eventToDelete?.google_calendar_event_id) {
        try {
          console.log('Tentando excluir evento do Google Calendar...');
          console.log('Google Calendar Event ID:', eventToDelete.google_calendar_event_id);
          
          const googleCalendarService = await createGoogleCalendarService(user.id);
          
          if (googleCalendarService) {
            await googleCalendarService.deleteEvent(eventToDelete.google_calendar_event_id);
            console.log('Google Calendar event excluído com sucesso');
          } else {
            console.log('Google Calendar não configurado - pulando exclusão');
          }
        } catch (error) {
          console.error('Failed to delete Google Calendar event:', error);
          // Não falhar o processo se o Google Calendar der erro
        }
      }

      // Primeiro, buscar álbuns relacionados ao evento para limpar fotos
      const { data: relatedAlbums } = await supabase
        .from('albums')
        .select('id')
        .eq('event_id', id);

      // Excluir fotos dos álbuns relacionados
      if (relatedAlbums && relatedAlbums.length > 0) {
        for (const album of relatedAlbums) {
          await deleteAlbumPhotos(album.id);
        }
      }

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
      
      if (eventToDelete?.google_calendar_event_id && await createGoogleCalendarService(user.id)) {
        toast.success('Agendamento excluído do sistema e Google Calendar!');
      } else {
        toast.success('Agendamento excluído!');
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Erro ao excluir agendamento e fotos');
      return false;
    }
  };

  // Função para excluir fotos do Storage
  const deleteAlbumPhotos = async (albumId: string) => {
    try {
      // Buscar todas as fotos do álbum
      const { data: albumPhotos } = await supabase
        .from('photos')
        .select('original_path, thumbnail_path, watermarked_path, filename')
        .eq('album_id', albumId);

      if (albumPhotos && albumPhotos.length > 0) {
        console.log(`Excluindo ${albumPhotos.length} fotos do Storage para álbum ${albumId}`);
        
        // Extrair nomes dos arquivos das URLs
        const filesToDelete: string[] = [];
        
        albumPhotos.forEach(photo => {
          // Extrair nome do arquivo da URL (assumindo formato: /storage/v1/object/public/photos/filename)
          if (photo.original_path && photo.original_path.includes('/photos/')) {
            const originalFile = photo.original_path.split('/photos/')[1];
            if (originalFile) filesToDelete.push(originalFile);
          }
          
          if (photo.thumbnail_path && photo.thumbnail_path.includes('/photos/')) {
            const thumbnailFile = photo.thumbnail_path.split('/photos/')[1];
            if (thumbnailFile && !filesToDelete.includes(thumbnailFile)) {
              filesToDelete.push(thumbnailFile);
            }
          }
          
          if (photo.watermarked_path && photo.watermarked_path.includes('/photos/')) {
            const watermarkedFile = photo.watermarked_path.split('/photos/')[1];
            if (watermarkedFile && !filesToDelete.includes(watermarkedFile)) {
              filesToDelete.push(watermarkedFile);
            }
          }
        });

        // Excluir arquivos do Storage
        if (filesToDelete.length > 0) {
          console.log('Arquivos a serem excluídos:', filesToDelete);
          
          const { error: storageError } = await supabase.storage
            .from('photos')
            .remove(filesToDelete);

          if (storageError) {
            console.error('Erro ao excluir arquivos do Storage:', storageError);
            // Não falhar a operação se o Storage der erro
          } else {
            console.log(`${filesToDelete.length} arquivos excluídos do Storage com sucesso`);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao excluir fotos do Storage:', error);
      // Não falhar a operação principal se a limpeza do Storage falhar
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
    // Buscar preço atual das configurações
    let currentPrice = 25.00; // Preço padrão
    
    try {
      if (user) {
        const { data: photographer } = await supabase
          .from('photographers')
          .select('watermark_config')
          .eq('user_id', user.id)
          .maybeSingle();

        if (photographer?.watermark_config?.photoPrice) {
          currentPrice = photographer.watermark_config.photoPrice;
        }
      }
    } catch (error) {
      console.error('Error loading photo price:', error);
    }

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
            price: currentPrice,
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
              price: currentPrice,
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
    // Buscar preço atual das configurações
    let currentPrice = 25.00; // Preço padrão
    
    try {
      if (user) {
        const { data: photographer } = await supabase
          .from('photographers')
          .select('watermark_config')
          .eq('user_id', user.id)
          .maybeSingle();

        if (photographer?.watermark_config?.photoPrice) {
          currentPrice = photographer.watermark_config.photoPrice;
        }
      }
    } catch (error) {
      console.error('Error loading photo price:', error);
    }

    try {
      const photosData = files.map((file, index) => ({
        album_id: albumId,
        filename: file.name,
        original_path: `https://picsum.photos/800/600?random=${Date.now()}_${index}`,
        thumbnail_path: `https://picsum.photos/300/200?random=${Date.now()}_${index}`,
        watermarked_path: `https://picsum.photos/800/600?random=${Date.now()}_${index}`,
        is_selected: false,
        price: currentPrice,
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
      // Primeiro, excluir fotos do Storage
      await deleteAlbumPhotos(albumId);

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
      toast.success('Álbum e fotos excluídos com sucesso!');
      return true;
    } catch (error) {
      console.error('Error deleting album:', error);
      toast.error('Erro ao excluir álbum e fotos');
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
      
      // Atualizar log de atividade do álbum quando foto for selecionada/desselecionada
      if (updates.is_selected !== undefined) {
        try {
          const photo = photos.find(p => p.id === photoId);
          if (photo) {
            const album = albums.find(a => a.id === photo.album_id);
            if (album) {
              const currentLog = album.activity_log || [];
              const newActivity = {
                timestamp: new Date().toISOString(),
                type: updates.is_selected ? 'photo_selected' : 'photo_deselected',
                description: updates.is_selected 
                  ? `Foto "${photo.filename}" selecionada pelo cliente`
                  : `Foto "${photo.filename}" removida da seleção`
              };
              
              await supabase
                .from('albums')
                .update({ 
                  activity_log: [...currentLog, newActivity]
                })
                .eq('id', photo.album_id);
            }
          }
        } catch (error) {
          console.error('Error updating activity log:', error);
          // Não falhar a operação principal se o log falhar
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error updating photo:', error);
      toast.error('Erro ao atualizar foto');
      return false;
    }
  };

  // Função para criar ou atualizar cliente
  const upsertClient = async (clientData: { name: string; email: string; phone: string; notes?: string }) => {
    try {
      // Verificar se cliente já existe
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('email', clientData.email)
        .maybeSingle();

      if (existingClient) {
        // Atualizar cliente existente
        const { error } = await supabase
          .from('clients')
          .update({
            name: clientData.name,
            phone: clientData.phone,
            notes: clientData.notes,
          })
          .eq('id', existingClient.id);

        if (error) {
          console.error('Error updating client:', error);
        }
      } else {
        // Criar novo cliente
        const { error } = await supabase
          .from('clients')
          .insert({
            name: clientData.name,
            email: clientData.email,
            phone: clientData.phone,
            notes: clientData.notes,
          });

        if (error) {
          console.error('Error creating client:', error);
        } else {
          // Recarregar lista de clientes
          const { data: clientsData } = await supabase
            .from('clients')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (clientsData) {
            setClients(clientsData);
          }
        }
      }
    } catch (error) {
      console.error('Error upserting client:', error);
    }
  };

  // Adicionar cliente manualmente
  const addClient = async (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert(clientData)
        .select()
        .single();

      if (error) {
        console.error('Error adding client:', error);
        toast.error('Erro ao adicionar cliente');
        return null;
      }

      setClients(prev => [data, ...prev]);
      toast.success('Cliente adicionado com sucesso!');
      return data;
    } catch (error) {
      console.error('Error adding client:', error);
      toast.error('Erro ao adicionar cliente');
      return null;
    }
  };

  // Atualizar cliente
  const updateClient = async (id: string, updates: Partial<Client>) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating client:', error);
        toast.error('Erro ao atualizar cliente');
        return null;
      }

      setClients(prev => prev.map(client => 
        client.id === id ? data : client
      ));
      toast.success('Cliente atualizado!');
      return data;
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Erro ao atualizar cliente');
      return null;
    }
  };

  // Excluir cliente
  const deleteClient = async (id: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting client:', error);
        toast.error('Erro ao excluir cliente');
        return false;
      }

      setClients(prev => prev.filter(client => client.id !== id));
      toast.success('Cliente excluído!');
      return true;
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error('Erro ao excluir cliente');
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
      setClients([]);
      setPhotographerId(null);
      setLoading(false);
    }
  }, [user]);

  return {
    events,
    albums,
    photos,
    orders,
    clients,
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
    addClient,
    updateClient,
    deleteClient,
  };
};