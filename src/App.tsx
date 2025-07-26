import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import { DataProvider } from './contexts/DataContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import EventScheduling from './components/EventScheduling';
import PhotoGallery from './components/PhotoGallery';
import EventList from './components/EventList';
import AlbumList from './components/AlbumList';
import Settings from './components/Settings';
import PaymentsList from './components/PaymentsList';

// Create a client
const queryClient = new QueryClient();

// Mock data for photo gallery
const mockPhotos = Array.from({ length: 24 }, (_, i) => ({
  id: `photo_${i + 1}`,
  filename: `DSC_${String(i + 1).padStart(4, '0')}.jpg`,
  thumbnailPath: `/thumbnails/photo_${i + 1}.jpg`,
  watermarkedPath: `/watermarked/photo_${i + 1}.jpg`,
  isSelected: Math.random() > 0.7,
  price: 25.00,
}));

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'events':
        return <EventList 
          onViewAlbum={(eventId) => setCurrentView('gallery')}
        />;
      case 'albums':
        return <AlbumList onViewAlbum={(albumId) => {
          setCurrentView('gallery');
          setSelectedAlbumId(albumId);
        }} />;
      case 'payments':
        return <PaymentsList />;
      case 'settings':
        return <Settings />;
      case 'gallery':
        return (
          <PhotoGallery
            albumId={selectedAlbumId || "album_1"}
            isClientView={false}
            onBackToAlbums={() => setCurrentView('albums')}
          />
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Layout currentView={currentView} onViewChange={setCurrentView}>
        {renderCurrentView()}
      </Layout>
      <Toaster position="top-right" />
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;