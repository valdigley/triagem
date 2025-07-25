import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import EventScheduling from './components/EventScheduling';
import PhotoGallery from './components/PhotoGallery';

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

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'scheduling' | 'gallery'>('dashboard');

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <Layout>
            {/* Navigation */}
            <div className="mb-6">
              <nav className="flex space-x-4">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentView === 'dashboard'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setCurrentView('scheduling')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentView === 'scheduling'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Agendamento
                </button>
                <button
                  onClick={() => setCurrentView('gallery')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentView === 'gallery'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Galeria (Cliente)
                </button>
              </nav>
            </div>

            {/* Current View */}
            {renderCurrentView()}
          </Layout>

          <Toaster position="top-right" />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;