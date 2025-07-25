import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import EventScheduling from './components/EventScheduling';
import PhotoGallery from './components/PhotoGallery';
import EventList from './components/EventList';
import AlbumList from './components/AlbumList';
import Login from './components/Login';

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
  const [currentView, setCurrentView] = useState<'dashboard' | 'scheduling' | 'gallery'>('dashboard');

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
        return <EventList />;
      case 'albums':
        return <AlbumList />;
      case 'scheduling':
        return <EventScheduling />;
      case 'gallery':
        return (
          <PhotoGallery
            albumId="album_1"
            photos={mockPhotos}
            isClientView={true}
            onPhotoSelect={(photoId, selected) => {
              console.log(`Photo ${photoId} ${selected ? 'selected' : 'deselected'}`);
            }}
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
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;