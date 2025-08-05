import React from 'react';
import { AlertTriangle } from 'lucide-react';

const FTPMonitor: React.FC = () => {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-start">
        <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 mr-2" />
        <div>
          <h4 className="text-sm font-medium text-yellow-800">Funcionalidade FTP Removida</h4>
          <p className="text-xs text-yellow-700 mt-1">
            O sistema agora foca apenas no upload manual de fotos para melhor estabilidade.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FTPMonitor;