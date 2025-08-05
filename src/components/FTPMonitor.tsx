import React, { useState, useEffect } from 'react';
import { Upload, RefreshCw, Folder, Image, CheckCircle, AlertTriangle, Play, Pause, Clock, Wifi } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface FTPMonitorProps {
  onPhotosAdded?: () => void;
}

const FTPMonitor: React.FC<FTPMonitorProps> = ({ onPhotosAdded }) => {
  const { user } = useAuth();
  const [isAutoMonitoring, setIsAutoMonitoring] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [scanResults, setScanResults] = useState<any>(null);
  const [ftpConfig, setFtpConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scanInterval, setScanInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadFTPConfig();
    
    // Cleanup interval on unmount
    return () => {
      if (scanInterval) {
        clearInterval(scanInterval);
      }
    };
  }, [user]);

  const loadFTPConfig = async () => {
    if (!user) return;

    try {
      const { data: apiAccess } = await supabase
        .from('api_access')
        .select('ftp_config')
        .eq('user_id', user.id)
        .maybeSingle();

      if (apiAccess?.ftp_config) {
        setFtpConfig(apiAccess.ftp_config);
        
        // Verificar se o monitoramento automático estava ativo
        const autoMonitoringActive = apiAccess.ftp_config.auto_monitoring || false;
        setIsAutoMonitoring(autoMonitoringActive);
        
        if (autoMonitoringActive) {
          startAutoMonitoring();
        }
      }
    } catch (error) {
      console.error('Error loading FTP config:', error);
    } finally {
      setLoading(false);
    }
  };

  const startAutoMonitoring = () => {
    if (scanInterval) {
      clearInterval(scanInterval);
    }

    // Executar scan a cada 5 minutos
    const interval = setInterval(() => {
      runFTPScan(false);
    }, 5 * 60 * 1000); // 5 minutos

    setScanInterval(interval);
    console.log('🔄 Monitoramento automático FTP iniciado (5 min)');
  };

  const stopAutoMonitoring = () => {
    if (scanInterval) {
      clearInterval(scanInterval);
      setScanInterval(null);
    }
    console.log('⏹️ Monitoramento automático FTP parado');
  };

  const toggleAutoMonitoring = async () => {
    const newState = !isAutoMonitoring;
    setIsAutoMonitoring(newState);

    try {
      // Salvar estado no banco
      const { error } = await supabase
        .from('api_access')
        .update({
          ftp_config: {
            ...ftpConfig,
            auto_monitoring: newState
          }
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error saving auto monitoring state:', error);
        toast.error('Erro ao salvar configuração');
        setIsAutoMonitoring(!newState); // Reverter
        return;
      }

      if (newState) {
        startAutoMonitoring();
        toast.success('Monitoramento automático ativado! (scan a cada 5 min)');
        // Executar scan imediatamente
        runFTPScan(false);
      } else {
        stopAutoMonitoring();
        toast.success('Monitoramento automático desativado');
      }

    } catch (error) {
      console.error('Error toggling auto monitoring:', error);
      toast.error('Erro ao alterar monitoramento');
      setIsAutoMonitoring(!newState); // Reverter
    }
  };

  const runFTPScan = async (force = false) => {
    if (!user || !ftpConfig) {
      return;
    }

    try {
      // Buscar photographer_id
      const { data: photographer } = await supabase
        .from('photographers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!photographer) {
        return;
      }

      console.log('🔍 Executando scan FTP GLOBAL automático...');
      console.log('📁 FTP Host:', ftpConfig.host);
      console.log('📂 Monitor Path:', ftpConfig.monitor_path);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ftp-monitor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          photographer_id: photographer.id,
          force_scan: force,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ FTP global monitor error:', errorData);
        return; // Não mostrar erro em scan automático
      }

      const result = await response.json();
      setScanResults(result);
      setLastScan(new Date());

      if (result.photosProcessed > 0) {
        console.log(`✅ ${result.photosProcessed} fotos REAIS processadas automaticamente`);
        toast.success(`📸 ${result.photosProcessed} fotos REAIS adicionadas do FTP!`);
        if (onPhotosAdded) {
          onPhotosAdded();
        }
      } else {
        console.log('📭 Scan automático: nenhuma foto nova encontrada');
      }

    } catch (error) {
      console.error('❌ Error in global auto FTP scan:', error);
      // Não mostrar toast de erro para scans automáticos
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (!ftpConfig) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 mr-2" />
          <div>
            <h4 className="text-sm font-medium text-yellow-800">FTP não configurado</h4>
            <p className="text-xs text-yellow-700 mt-1">
              Configure em <strong>API & FTP</strong> para habilitar upload automático.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Folder className="w-4 h-4" />
            Monitoramento FTP Global
          </h3>
          <p className="text-xs text-gray-600">
            Pasta: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{ftpConfig.monitor_path}</code>
          </p>
        </div>
        <button
          onClick={toggleAutoMonitoring}
          className={`flex items-center gap-2 px-3 py-1 text-sm rounded-lg transition-colors ${
            isAutoMonitoring
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {isAutoMonitoring ? (
            <>
              <Wifi className="w-4 h-4" />
              Ativo (5min)
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Iniciar Auto
            </>
          )}
        </button>
      </div>

      {/* Status compacto */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-gray-50 p-2 rounded text-center">
          <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${
            isAutoMonitoring ? 'bg-green-500' : 'bg-gray-400'
          }`}></div>
          <span className="text-gray-600">
            {isAutoMonitoring ? 'Ativo' : 'Parado'}
          </span>
        </div>

        <div className="bg-gray-50 p-2 rounded text-center">
          <Clock className="w-3 h-3 mx-auto mb-1 text-gray-400" />
          <span className="text-gray-600">
            {lastScan ? lastScan.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
          </span>
        </div>

        <div className="bg-gray-50 p-2 rounded text-center">
          <Image className="w-3 h-3 mx-auto mb-1 text-gray-400" />
          <span className="text-gray-600">
            {scanResults?.photosProcessed || 0}
          </span>
        </div>
      </div>

      {/* Instruções compactas */}
      <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-3">
        <h4 className="text-xs font-medium text-blue-900 mb-1">💡 Como Usar</h4>
        <div className="text-xs text-blue-800 space-y-0.5">
          <p>1. 🔄 Ative o monitoramento global acima</p>
          <p>2. 📁 Ative recepção FTP em álbuns específicos</p>
          <p>3. 📸 Coloque fotos na pasta: <code>{ftpConfig.monitor_path}</code></p>
          <p>4. ⏱️ Sistema verifica automaticamente a cada 5 minutos</p>
        </div>
      </div>
    </div>
  );
};

export default FTPMonitor;