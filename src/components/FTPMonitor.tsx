import React, { useState, useEffect } from 'react';
import { Upload, RefreshCw, Folder, Image, CheckCircle, AlertTriangle, Play, Pause } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface FTPMonitorProps {
  onPhotosAdded?: () => void;
}

const FTPMonitor: React.FC<FTPMonitorProps> = ({ onPhotosAdded }) => {
  const { user } = useAuth();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [scanResults, setScanResults] = useState<any>(null);
  const [ftpConfig, setFtpConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFTPConfig();
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
      }
    } catch (error) {
      console.error('Error loading FTP config:', error);
    } finally {
      setLoading(false);
    }
  };

  const runFTPScan = async (force = false) => {
    if (!user || !ftpConfig) {
      toast.error('Configure o FTP em Configurações → API & FTP primeiro');
      return;
    }

    setIsMonitoring(true);
    try {
      // Buscar photographer_id
      const { data: photographer } = await supabase
        .from('photographers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!photographer) {
        toast.error('Perfil do fotógrafo não encontrado. Faça login novamente.');
        return;
      }

      console.log('🔍 Iniciando scan FTP real para fotógrafo:', photographer.id);
      console.log('📁 Pasta monitorada:', ftpConfig.monitor_path);
      console.log('🖥️ Servidor FTP:', ftpConfig.host);

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
        console.error('❌ FTP monitor error:', errorData);
        
        // Mostrar erro específico baseado no tipo
        if (errorData.error?.includes('não encontrada')) {
          toast.error('Configure o FTP em Configurações → API & FTP');
        } else if (errorData.error?.includes('não configurado')) {
          toast.error('FTP não está configurado. Vá em Configurações → API & FTP');
        } else {
          toast.error(errorData.error || 'Erro no monitoramento FTP');
        }
        return;
      }

      const result = await response.json();
      console.log('✅ FTP scan result:', result);

      setScanResults(result);
      setLastScan(new Date());

      if (result.totalProcessed > 0) {
        toast.success(`🎉 ${result.photosProcessed} fotos REAIS adicionadas do FTP!`);
        console.log('📸 Fotos processadas:', result.processedFiles);
        if (onPhotosAdded) {
          onPhotosAdded();
        }
      } else {
        if (result.message?.includes('Nenhum arquivo novo')) {
          toast.success('✅ FTP verificado - nenhuma foto nova encontrada');
        } else {
          toast.success(result.message || 'Scan concluído');
        }
      }

    } catch (error) {
      console.error('❌ Error running FTP scan:', error);
      toast.error(`Erro no monitoramento FTP: ${error.message}`);
    } finally {
      setIsMonitoring(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (!ftpConfig) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">FTP não configurado</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Configure o FTP em <strong>API & FTP</strong> para habilitar o upload automático de fotos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Folder className="w-5 h-5" />
            Monitoramento FTP
          </h3>
          <p className="text-sm text-gray-600">
            Pasta monitorada: <code className="bg-gray-100 px-2 py-1 rounded">{ftpConfig.monitor_path}</code>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              runFTPScan(false);
            }}
            disabled={isMonitoring}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isMonitoring ? 'animate-spin' : ''}`} />
            {isMonitoring ? 'Verificando...' : 'Verificar Agora'}
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              runFTPScan(true);
            }}
            disabled={isMonitoring}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Forçar Scan
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${ftpConfig.auto_upload ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium">
              {ftpConfig.auto_upload ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">Status do monitoramento</p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm font-medium">
            {lastScan ? lastScan.toLocaleTimeString('pt-BR') : 'Nunca'}
          </div>
          <p className="text-xs text-gray-600 mt-1">Último scan</p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm font-medium">
            {scanResults?.totalProcessed || 0}
          </div>
          <p className="text-xs text-gray-600 mt-1">Fotos processadas</p>
        </div>
      </div>

      {/* Configuração FTP */}
      <div className="bg-blue-50 rounded-lg p-4 mb-4">
        <h4 className="font-medium text-blue-900 mb-2">📁 Configuração Atual</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-blue-700">Servidor:</span>
            <span className="ml-2 font-mono">{ftpConfig.host}:{ftpConfig.port}</span>
          </div>
          <div>
            <span className="text-blue-700">Usuário:</span>
            <span className="ml-2 font-mono">{ftpConfig.username}</span>
          </div>
          <div className="md:col-span-2">
            <span className="text-blue-700">Pasta:</span>
            <span className="ml-2 font-mono">{ftpConfig.monitor_path}</span>
          </div>
        </div>
      </div>

      {/* Resultados do último scan */}
      {scanResults && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">📊 Último Resultado</h4>
          
          {scanResults.results && scanResults.results.length > 0 && (
            <div className="space-y-2">
              {scanResults.results.map((result: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white rounded border">
                  <div className="flex items-center gap-2">
                    {result.error ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    <span className="text-sm">
                      {result.albumName || 'Álbum não identificado'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {result.error || `${result.photosProcessed} fotos`}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 text-xs text-gray-500">
            Último scan: {new Date(scanResults.timestamp).toLocaleString('pt-BR')}
          </div>
        </div>
      )}

      {/* Instruções */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">📋 Como Usar</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p>1. 📁 Coloque fotos REAIS na pasta FTP: <code>{ftpConfig.monitor_path}</code></p>
          <p>2. 🔍 Clique em "Verificar Agora" para buscar fotos no servidor</p>
          <p>3. ⬇️ Fotos serão baixadas do FTP e enviadas para o Supabase Storage</p>
          <p>4. 📸 Fotos aparecerão no álbum mais recente automaticamente</p>
          <p>5. 🎯 <strong>Servidor:</strong> {ftpConfig.host}:{ftpConfig.port}</p>
          <p>6. ⚠️ <strong>Importante:</strong> Verifique se as credenciais FTP estão corretas</p>
        </div>
      </div>
    </div>
  );
};

export default FTPMonitor;