import { useState, useEffect } from 'react';
import { supabase, withRetry, checkSupabaseConnection } from '../lib/supabase';
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
  photographer_id: string;
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
  metadata?: any;
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
  const [photographerChecked, setPhotographerChecked] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  // Buscar ou criar perfil do fotógrafo
  const ensurePhotographerProfile = async () => {
    if (!user) return null;

    // Se já temos o photographerId, retornar imediatamente
    if (photographerId) {
      return photographerId;
    }

    // Se já verificamos e não encontramos, não tentar novamente
    if (photographerChecked) {
      return null;
    }

    setPhotographerChecked(true);

    try {
      console.log('Checking for existing photographer profile...');
      
      // Check connection first
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        setConnectionError(true);
        toast.error('Erro de conexão com o banco de dados. Verifique sua internet.');
        return null;
      }
      
      setConnectionError(false);
      
      // Use retry wrapper for database operations
      const { data: existingProfiles, error: fetchError } = await withRetry(async () => {
        return await supabase
          .from('photographers')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);
      });

      if (!fetchError && existingProfiles && existingProfiles.length > 0) {
        const existingProfile = existingProfiles[0];
        console.log('Found existing photographer profile:', existingProfile.id);
        setPhotographerId(existingProfile.id);
        return existingProfile.id;
      }

      if (fetchError) {
        console.error('Error fetching photographer profile:', fetchError);
        
        // Handle connection errors specifically
        if (fetchError.message?.includes('upstream connect error') || 
            fetchError.message?.includes('503')) {
          setConnectionError(true);
          toast.error('Erro de conexão. Tentando reconectar...');
          return null;
        }
        
        // Se for erro de RLS, tentar criar mesmo assim
        if (fetchError.code !== 'PGRST301') {
          return null;
        }
      }

      console.log('No existing profile found, creating new one for:', user.email);
      
      // Use retry wrapper for insert operation
      const { data: newProfile, error: insertError } = await withRetry(async () => {
        return await supabase
          .from('photographers')
          .insert({
            user_id: user.id,
            business_name: user.name || 'Meu Estúdio',
            phone: user.user_metadata?.whatsapp || '(11) 99999-9999',
            watermark_config: {
              photoPrice: 25.00,
              packagePhotos: 10,
              minimumPackagePrice: 300.00,
              advancePaymentPercentage: 50,
              sessionTypes: [
                { value: 'gestante', label: 'Sessão Gestante' },
                { value: 'aniversario', label: 'Aniversário' },
                { value: 'comerciais', label: 'Comerciais' },
                { value: 'pre-wedding', label: 'Pré Wedding' },
                { value: 'formatura', label: 'Formatura' },
                { value: 'revelacao-sexo', label: 'Revelação de Sexo' },
              ],
              emailTemplates: {
                bookingConfirmation: {
                  enabled: true,
                  subject: '📸 Agendamento Confirmado - {{studioName}}',
                  message: 'Olá {{clientName}}!\n\nSeu agendamento foi confirmado com sucesso! 🎉\n\nDetalhes:\n• Tipo: {{sessionType}}\n• Data: {{eventDate}} às {{eventTime}}\n• Local: {{studioAddress}}\n\nEm breve você receberá suas fotos para seleção.\n\nObrigado!\n{{studioName}}'
                },
                dayOfReminder: {
                  enabled: true,
                  subject: '🎉 Hoje é o dia da sua sessão! - {{studioName}}',
                  message: 'Olá {{clientName}}!\n\nHoje é o grande dia da sua sessão de fotos! 📸\n\nLembre-se:\n• Horário: {{eventTime}}\n• Local: {{studioAddress}}\n• Chegue 10 minutos antes\n\nEstamos ansiosos para te ver!\n{{studioName}}'
                }
              }
            }
          })
          .select()
          .maybeSingle();
      });

      if (insertError) {
        // Se for erro de duplicata, buscar o existente
        if (insertError.code === '23505') {
          console.log('Duplicate detected, fetching existing profile...');
          const { data: existingAfterError, error: fetchAfterError } = await withRetry(async () => {
            return await supabase
              .from('photographers')
              .select('id')
              .eq('user_id', user.id)
              .limit(1);
          });
          
          if (!fetchAfterError && existingAfterError && existingAfterError.length > 0) {
            const profile = existingAfterError[0];
            console.log('Found existing profile after duplicate error:', profile.id);
            setPhotographerId(profile.id);
            return profile.id;
          }
        } else {
          console.error('Error creating photographer profile:', insertError);
        }
        return null;
      }

      if (newProfile) {
        console.log('Photographer profile created successfully:', newProfile.id);
        setPhotographerId(newProfile.id);
        return newProfile.id;
      }

      return null;
    } catch (error) {
      console.error('Error ensuring photographer profile:', error);
      return null;
    }
  };

  // Carregar dados
  const loadData = async () => {
    if (!user) return;
    
    // Check connection before loading data
    const isConnected = await checkSupabaseConnection();
    if (!isConnected) {
      setConnectionError(true);
      setLoading(false);
      toast.error('Sem conexão com o banco de dados. Verifique sua internet e tente novamente.');
      return;
    }
    
    setConnectionError(false);

    setLoading(true);
    try {
      const currentPhotographerId = await ensurePhotographerProfile();
      if (!currentPhotographerId) {
        setLoading(false);
        return;
      }

      // Carregar eventos
      const { data: eventsData, error: eventsError } = await withRetry(async () => {
        return await supabase
          .from('events')
          .select('*')
          .eq('photographer_id', currentPhotographerId)
          .order('created_at', { ascending: false });
      });

      if (eventsError) {
        console.error('Error loading events:', eventsError);
        toast.error('Erro ao carregar agendamentos');
      } else {
        setEvents(eventsData || []);
      }

      // Carregar álbuns
      const { data: albumsData, error: albumsError } = await withRetry(async () => {
        return await supabase
          .from('albums')
          .select('*')
          .eq('photographer_id', currentPhotographerId)
          .order('created_at', { ascending: false });
      });

      if (albumsError) {
        console.error('Error loading albums:', albumsError);
        toast.error('Erro ao carregar álbuns');
      } else {
        setAlbums(albumsData || []);
      }

      // Carregar fotos
      if (albumsData && albumsData.length > 0) {
        const albumIds = albumsData.map(album => album.id);
        console.log('Loading photos for albums:', albumIds);
        
        const { data: photosData, error: photosError } = await withRetry(async () => {
          return await supabase
            .from('photos')
            .select('*')
            .in('album_id', albumIds)
            .order('created_at', { ascending: false });
        });

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
          const { data: ordersData, error: ordersError } = await withRetry(async () => {
            return await supabase
              .from('orders')
              .select('*')
              .in('event_id', eventIds)
              .order('created_at', { ascending: false });
          });

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
      const { data: clientsData, error: clientsError } = await withRetry(async () => {
        return await supabase
          .from('clients')
          .select('*')
          .eq('photographer_id', currentPhotographerId)
          .order('created_at', { ascending: false });
      });

      if (clientsError) {
        console.error('Error loading clients:', clientsError);
      } else {
        setClients(clientsData || []);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      
      // Handle connection errors specifically
      if (error.message?.includes('upstream connect error') || 
          error.message?.includes('503')) {
        setConnectionError(true);
        toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
      } else {
        toast.error('Erro ao carregar dados');
      }
    } finally {
      setLoading(false);
    }
  };

  // Upload de fotos REAL para Supabase Storage
  const uploadPhotos = async (albumId: string, files: File[]) => {
    console.log(`📸 Starting upload of ${files.length} files to album ${albumId}`);
    
    // Verificar se o álbum existe e pertence ao fotógrafo
    const { data: albumCheck, error: albumError } = await supabase
      .from('albums')
      .select('id, photographer_id, event_id')
      .eq('id', albumId)
      .single();

    if (albumError || !albumCheck) {
      console.error('Album not found:', albumError);
      toast.error('Álbum não encontrado');
      return false;
    }

    console.log('Album ownership check:', {
      albumId,
      album_photographer_id: albumCheck.photographer_id,
      current_photographer_id: photographerId,
      has_event: !!albumCheck.event_id
    });

    // Verificar se o fotógrafo tem permissão para este álbum
    if (albumCheck.photographer_id !== photographerId) {
      toast.error('Você não tem permissão para este álbum');
      return false;
    }
    
    // Buscar preço atual das configurações
    let currentPrice = 25.00;
    
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
      console.log(`🔄 Processing ${files.length} files for upload...`);
      
      const photoPromises = files.map(async (file, index) => {
        const timestamp = Date.now() + index; // Evitar conflitos de nome
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storageFileName = `${albumId}/${timestamp}_${safeFileName}`;
        
        try {
          console.log(`📤 Uploading file ${index + 1}/${files.length}: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
          
          // Upload file to Supabase Storage
          console.log(`📁 Uploading to path: ${storageFileName}`);
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('photos')
            .upload(storageFileName, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type
            });

          if (uploadError) {
            console.error(`❌ Storage upload failed for ${file.name}:`, uploadError);
            throw new Error(`Upload failed: ${uploadError.message}`);
          } else {
            console.log(`✅ Upload successful for ${file.name}`);
            
            // Generate public URLs
            const { data: { publicUrl: originalUrl } } = supabase.storage
              .from('photos')
              .getPublicUrl(storageFileName);
            
            const { data: { publicUrl: thumbnailUrl } } = supabase.storage
              .from('photos')
              .getPublicUrl(storageFileName);
            
            const { data: { publicUrl: watermarkedUrl } } = supabase.storage
              .from('photos')
              .getPublicUrl(storageFileName);
            
            console.log(`🔗 Generated URLs for ${file.name}`);

            return {
              album_id: albumId,
              filename: file.name,
              original_path: originalUrl,
              thumbnail_path: thumbnailUrl,
              watermarked_path: watermarkedUrl,
              is_selected: false,
              price: currentPrice,
              metadata: {
                file_size: file.size,
                file_type: file.type,
                original_filename: file.name,
                uploaded_at: new Date().toISOString(),
                storage_path: storageFileName,
                upload_method: 'storage_upload',
                file_size_mb: (file.size / 1024 / 1024).toFixed(2)
              },
            };
          }
        } catch (error) {
          console.error(`❌ Failed to process file ${file.name}:`, error);
          throw error;
        }
      });

      try {
        console.log('🔄 Processing all uploads...');
        const photosData = await Promise.all(photoPromises);
        
        console.log(`📊 Photos uploaded: ${photosData.length} photos processed`);
        
        if (photosData.length === 0) {
          throw new Error('Nenhuma foto foi processada com sucesso');
        }

        console.log(`💾 Saving ${photosData.length} photos to database...`);
        
        const { data, error } = await supabase
          .from('photos')
          .insert(photosData)
          .select();

        if (error) {
          console.error('Error saving photos to database:', error);
          throw new Error(`Database error: ${error.message}`);
        }

        console.log(`✅ SUCCESS: ${data.length} photos saved to database!`);
        console.log('📸 Photos are now available for selection!');
        
        setPhotos(prev => [...prev, ...data]);
        toast.success(`${data.length} fotos carregadas com sucesso!`);
        
        return true;
      } catch (error) {
        console.error('Error processing photos:', error);
        throw error;
      }
      
    } catch (error) {
      console.error('Error in photo upload process:', error);
      toast.error(`Erro ao fazer upload das fotos: ${error.message}`);
      return false;
    }
  };

  // Adicionar evento
  const addEvent = async (eventData: Omit<Event, 'id' | 'created_at' | 'photographer_id'>) => {
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

        console.log('Creating album for event:', albumName);
        
        const { data: newAlbum, error: albumError } = await supabase
          .from('albums')
          .insert({
            event_id: data.id,
            photographer_id: photographerId,
            name: albumName,
          })
          .select()
          .single();

        if (albumError) {
          console.error('Error creating album for event:', albumError);
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
        console.error('Error creating album for event:', error);
        // Não falhar o processo se o álbum não for criado
      }
      
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
        .select('original_path, thumbnail_path, watermarked_path, filename, metadata')
        .eq('album_id', albumId);

      if (albumPhotos && albumPhotos.length > 0) {
        console.log(`Excluindo ${albumPhotos.length} fotos do Storage para álbum ${albumId}`);
        
        // Extrair nomes dos arquivos das URLs ou metadata
        const filesToDelete: string[] = [];
        
        albumPhotos.forEach(photo => {
          // Tentar extrair do metadata primeiro (mais confiável)
          if (photo.metadata?.storage_path) {
            filesToDelete.push(photo.metadata.storage_path);
          } else {
            // Fallback: extrair da URL
            if (photo.original_path && photo.original_path.includes('/photos/')) {
              const originalFile = photo.original_path.split('/photos/')[1];
              if (originalFile) filesToDelete.push(originalFile);
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
  const createAlbum = async (name: string, eventId?: string) => {
    try {
      if (!name.trim()) {
        toast.error('Nome do álbum é obrigatório');
        return false;
      }

      if (!photographerId) {
        toast.error('Perfil do fotógrafo não encontrado');
        return false;
      }

      // Se eventId foi fornecido, verificar se existe e pertence ao fotógrafo
      if (eventId) {
        const { data: eventExists, error: eventError } = await supabase
          .from('events')
          .select('id, photographer_id')
          .eq('id', eventId)
          .eq('photographer_id', photographerId)
          .single();

        if (eventError || !eventExists) {
          console.error('Event validation failed:', eventError);
          toast.error('Evento não encontrado ou não pertence a você');
          return false;
        }
      }

      // Generate unique share token
      const shareToken = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      console.log('Creating album with data:', {
        event_id: eventId || null,
        photographer_id: photographerId,
        name: name.trim(),
        share_token: shareToken,
        is_active: true,
      });
      
      const { data, error } = await supabase
        .from('albums')
        .insert({
          event_id: eventId || null,
          photographer_id: photographerId,
          name: name.trim(),
          share_token: shareToken,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating album:', error);
        toast.error(`Erro ao criar álbum: ${error.message}`);
        return false;
      }

      console.log('Album created successfully:', data);
      setAlbums(prev => [data, ...prev]);
      toast.success(eventId ? 'Álbum criado e vinculado ao evento!' : 'Álbum independente criado com sucesso!');
      return true;
    } catch (error) {
      console.error('Error creating album:', error);
      toast.error(`Erro inesperado: ${error.message}`);
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
      
      return true;
    } catch (error) {
      console.error('Error updating photo:', error);
      toast.error('Erro ao atualizar foto');
      return false;
    }
  };

  // Função para criar ou atualizar cliente
  const upsertClient = async (clientData: { name: string; email: string; phone: string; notes?: string }) => {
    if (!photographerId) {
      console.error('Photographer ID not available for client upsert');
      return;
    }

    try {
      console.log('Upserting client:', clientData.email);
      
      // Primeiro verificar se cliente já existe
      const { data: existingClients, error: fetchError } = await supabase
        .from('clients')
        .select('id, email')
        .eq('email', clientData.email)
        .eq('photographer_id', photographerId)
        .limit(1);

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking existing client:', fetchError);
        return;
      }

      if (existingClients && existingClients.length > 0) {
        // Cliente existe, atualizar dados
        const existingClient = existingClients[0];
        console.log('Updating existing client:', existingClient.id);
        
        const { error: updateError } = await supabase
          .from('clients')
          .update({
            name: clientData.name,
            phone: clientData.phone,
            notes: clientData.notes,
          })
          .eq('id', existingClient.id);

        if (updateError) {
          console.error('Error updating client:', updateError);
        } else {
          console.log('Client updated successfully');
        }
      } else {
        // Cliente não existe, criar novo
        console.log('Creating new client:', clientData.email);
        
        const { error: insertError } = await supabase
          .from('clients')
          .insert({
            photographer_id: photographerId,
            name: clientData.name,
            email: clientData.email,
            phone: clientData.phone,
            notes: clientData.notes,
          });

        if (insertError) {
          // Se for erro de duplicata, ignorar (pode ter sido criado por outro processo)
          if (insertError.code === '23505') {
            console.log('Client already exists (created by another process)');
          } else {
            console.error('Error creating client:', insertError);
          }
        } else {
          console.log('Client created successfully');
        }
      }
    } catch (error) {
      console.error('Error processing client:', error);
    }
  };

  // Adicionar cliente manualmente
  const addClient = async (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
    if (!photographerId) {
      toast.error('Perfil do fotógrafo não encontrado');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          ...clientData,
          photographer_id: photographerId,
        })
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
      // Buscar eventos do cliente para excluir dados relacionados
      const { data: clientEvents } = await supabase
        .from('events')
        .select('id')
        .eq('client_email', (await supabase.from('clients').select('email').eq('id', id).single()).data?.email || '');

      // Excluir álbuns e fotos relacionados aos eventos do cliente
      if (clientEvents && clientEvents.length > 0) {
        for (const event of clientEvents) {
          // Buscar álbuns do evento
          const { data: eventAlbums } = await supabase
            .from('albums')
            .select('id')
            .eq('event_id', event.id);

          // Excluir fotos dos álbuns
          if (eventAlbums && eventAlbums.length > 0) {
            for (const album of eventAlbums) {
              await deleteAlbumPhotos(album.id);
            }
          }
        }
      }

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
      toast.success('Cliente e todos os dados relacionados excluídos!');
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
      setPhotographerChecked(false);
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
    connectionError,
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