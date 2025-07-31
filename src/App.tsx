import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import Login from './components/Login';
import { DataProvider } from './contexts/DataContext';
import SubscriptionGuard from './components/SubscriptionGuard';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PublicScheduling from './components/PublicScheduling';
import ClientPhotoSelection from './components/ClientPhotoSelection';
import PhotoGallery from './components/PhotoGallery';
import EventList from './components/EventList';
import AlbumList from './components/AlbumList';
import Settings from './components/Settings';
import PaymentsList from './components/PaymentsList';
import ClientsList from './components/ClientsList';
import SubscriptionManagement from './components/SubscriptionManagement';
import ApiDocumentation from './components/ApiDocumentation';

// Create a client
const queryClient = new QueryClient();

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
          onViewAlbum={(albumId) => {
            console.log('EventList onViewAlbum called with albumId:', albumId);
            setSelectedAlbumId(albumId);
            setCurrentView('gallery');
          }}
        />;
      case 'albums':
        return <AlbumList onViewAlbum={(albumId) => {
          console.log('AlbumList onViewAlbum called with albumId:', albumId);
          setCurrentView('gallery');
          setSelectedAlbumId(albumId);
        }} />;
      case 'clients':
        return <ClientsList />;
      case 'payments':
        return <PaymentsList />;
      case 'subscriptions':
        return <SubscriptionManagement />;
      case 'api':
        return <ApiDocumentation />;
      case 'settings':
        return <Settings />;
      case 'gallery':
        if (!selectedAlbumId) {
          return (
            <div className="p-6 text-center">
              <p className="text-gray-600 mb-4">Nenhum álbum selecionado.</p>
              <button
                onClick={() => setCurrentView('albums')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Voltar para Álbuns
              </button>
            </div>
          );
        }
        return (
          <PhotoGallery
            albumId={selectedAlbumId}
            isClientView={false}
            onBackToAlbums={() => setCurrentView('albums')}
          />
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <SubscriptionGuard>
      <div className="min-h-screen bg-gray-50">
        <Layout currentView={currentView} onViewChange={setCurrentView}>
          {renderCurrentView()}
        </Layout>
        <Toaster position="top-right" />
      </div>
    </SubscriptionGuard>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SubscriptionProvider>
          <DataProvider>
            <BrowserRouter>
              <Routes>
                {/* Rota pública para agendamento */}
                <Route 
                  path="/agendar" 
                  element={
                    <div style={{ isolation: 'isolate' }}>
                      <PublicScheduling />
                    </div>
                  } 
                />
                {/* Rota pública para seleção de fotos */}
                <Route 
                  path="/album/:shareToken" 
                  element={
                    <div style={{ isolation: 'isolate' }}>
                      <ClientPhotoSelection />
                    </div>
                  } 
                />
                {/* Rotas do sistema interno */}
                <Route path="/*" element={<AppContent />} />
              </Routes>
            </BrowserRouter>
          </DataProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;