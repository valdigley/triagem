import React, { createContext, useContext, ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Event, Album, Photo } from '../types';

interface DataContextType {
  events: Event[];
  albums: Album[];
  photos: Photo[];
  addEvent: (event: Omit<Event, 'id' | 'createdAt'>) => void;
  updateEvent: (id: string, updates: Partial<Event>) => void;
  deleteEvent: (id: string) => void;
  addAlbum: (album: Omit<Album, 'id' | 'createdAt'>) => void;
  updateAlbum: (id: string, updates: Partial<Album>) => void;
  addPhotos: (albumId: string, photos: Omit<Photo, 'id' | 'albumId' | 'createdAt'>[]) => void;
  updatePhoto: (id: string, updates: Partial<Photo>) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

// Dados iniciais mock
const initialEvents: Event[] = [
  {
    id: '1',
    photographerId: 'photographer_1',
    clientName: 'Ana Silva',
    clientEmail: 'ana@email.com',
    clientPhone: '(11) 99999-1111',
    eventDate: new Date('2024-01-25T14:00:00'),
    location: 'Parque Ibirapuera, São Paulo',
    status: 'completed',
    notes: 'Ensaio de família',
    albumId: 'album_1',
    createdAt: new Date('2024-01-20T10:00:00'),
  },
  {
    id: '2',
    photographerId: 'photographer_1',
    clientName: 'João Santos',
    clientEmail: 'joao@email.com',
    clientPhone: '(11) 99999-2222',
    eventDate: new Date('2024-01-28T16:00:00'),
    location: 'Praia de Copacabana, Rio de Janeiro',
    status: 'scheduled',
    notes: 'Ensaio pré-wedding',
    createdAt: new Date('2024-01-22T09:00:00'),
  },
];

const initialAlbums: Album[] = [
  {
    id: 'album_1',
    eventId: '1',
    name: 'Ensaio Ana Silva',
    shareToken: 'abc123def456',
    isActive: true,
    createdAt: new Date('2024-01-25T16:00:00'),
  },
];

const initialPhotos: Photo[] = Array.from({ length: 24 }, (_, i) => ({
  id: `photo_${i + 1}`,
  albumId: 'album_1',
  filename: `DSC_${String(i + 1).padStart(4, '0')}.jpg`,
  originalPath: `/photos/original/photo_${i + 1}.jpg`,
  thumbnailPath: `/photos/thumbnails/photo_${i + 1}.jpg`,
  watermarkedPath: `/photos/watermarked/photo_${i + 1}.jpg`,
  isSelected: Math.random() > 0.7,
  price: 25.00,
  createdAt: new Date('2024-01-25T16:30:00'),
}));

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [events, setEvents] = useLocalStorage<Event[]>('photoselect_events', initialEvents);
  const [albums, setAlbums] = useLocalStorage<Album[]>('photoselect_albums', initialAlbums);
  const [photos, setPhotos] = useLocalStorage<Photo[]>('photoselect_photos', initialPhotos);

  const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addEvent = (eventData: Omit<Event, 'id' | 'createdAt'>) => {
    const newEvent: Event = {
      ...eventData,
      id: generateId(),
      createdAt: new Date(),
    };
    setEvents(prev => [...prev, newEvent]);
  };

  const updateEvent = (id: string, updates: Partial<Event>) => {
    setEvents(prev => prev.map(event => 
      event.id === id ? { ...event, ...updates } : event
    ));
  };

  const deleteEvent = (id: string) => {
    setEvents(prev => prev.filter(event => event.id !== id));
    // Também remove álbuns relacionados
    setAlbums(prev => prev.filter(album => album.eventId !== id));
  };

  const addAlbum = (albumData: Omit<Album, 'id' | 'createdAt'>) => {
    const newAlbum: Album = {
      ...albumData,
      id: generateId(),
      createdAt: new Date(),
    };
    setAlbums(prev => [...prev, newAlbum]);
  };

  const updateAlbum = (id: string, updates: Partial<Album>) => {
    setAlbums(prev => prev.map(album => 
      album.id === id ? { ...album, ...updates } : album
    ));
  };

  const addPhotos = (albumId: string, photosData: Omit<Photo, 'id' | 'albumId' | 'createdAt'>[]) => {
    const newPhotos: Photo[] = photosData.map(photoData => ({
      ...photoData,
      id: generateId(),
      albumId,
      createdAt: new Date(),
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const updatePhoto = (id: string, updates: Partial<Photo>) => {
    setPhotos(prev => prev.map(photo => 
      photo.id === id ? { ...photo, ...updates } : photo
    ));
  };

  return (
    <DataContext.Provider value={{
      events,
      albums,
      photos,
      addEvent,
      updateEvent,
      deleteEvent,
      addAlbum,
      updateAlbum,
      addPhotos,
      updatePhoto,
    }}>
      {children}
    </DataContext.Provider>
  );
};