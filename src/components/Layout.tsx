import React from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Camera, 
  Calendar, 
  Image, 
  Users, 
  Settings, 
  LogOut,
  Bell,
  Menu,
  X,
  CreditCard,
  Crown,
  Code,
  Clock
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { supabase } from '../lib/supabase';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentView, onViewChange }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { isMasterUser, daysRemaining, isTrialExpired } = useSubscription();
  const [studioLogo, setStudioLogo] = useState<string>('');

  // Carregar logo do estúdio
  React.useEffect(() => {
    const loadStudioLogo = async () => {
      if (!user) return;
      
      try {
        const { data: photographer } = await supabase
          .from('photographers')
          .select('watermark_config')
          .eq('user_id', user.id)
          .limit(1);

        if (photographer && photographer.length > 0 && photographer[0].watermark_config?.logo) {
          setStudioLogo(photographer[0].watermark_config.logo);
        }
      } catch (error) {
        console.error('Error loading studio logo:', error);
      }
    };

    loadStudioLogo();
  }, [user]);
  const navigationItems = [
    { name: 'Dashboard', key: 'dashboard', icon: Camera },
    { name: 'Agendamentos', key: 'events', icon: Calendar },
    { name: 'Clientes', key: 'clients', icon: Users },
    { name: 'Seleções', key: 'albums', icon: Image },
    { name: 'Pagamentos', key: 'payments', icon: CreditCard },
    ...(isMasterUser ? [
      { name: 'Assinaturas', key: 'subscriptions', icon: Crown },
      { name: 'API & FTP', key: 'api', icon: Code },
    ] : []),
    { name: 'Configurações', key: 'settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-gray-50 main-layout">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 sidebar ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {studioLogo ? (
              <img 
                src={studioLogo} 
                alt="Logo" 
                className="w-8 h-8 object-contain rounded"
              />
            ) : (
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </div>
            )}
            <h1 className="text-xl font-bold text-gray-900">Triagem</h1>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <nav className="mt-8">
          {navigationItems.map((item) => {
            const isActive = currentView === item.key;
            return (
              <button
                key={item.name}
                onClick={() => onViewChange(item.key)}
                className={`w-full flex items-center px-6 py-3 text-left transition-colors ${
                  isActive
                    ? 'bg-blue-50 border-r-2 border-blue-500 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-6 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sair
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:ml-64 main-content">
        {/* Top navigation */}
        <header className="h-16 bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-full px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
            >
              <Menu className="w-6 h-6 text-gray-500" />
            </button>

            <div className="flex items-center space-x-4 ml-auto">
              {/* Trial indicator */}
              {!isMasterUser && !isTrialExpired && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  <Clock className="w-4 h-4" />
                  <span>{daysRemaining} dias restantes</span>
                </div>
              )}
              
              {/* Master badge */}
              {isMasterUser && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                  <Crown className="w-4 h-4" />
                  <span>Master</span>
                </div>
              )}
              
              <button className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500 hidden sm:block">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;