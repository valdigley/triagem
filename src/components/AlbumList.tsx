import React, { useState } from 'react';
import { Image, Share2, Eye, Download, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface Album {
  id: string;
  name: string;
  clientName: string;
  eventDate: Date;
  photoCount: number;
  selectedCount: number;
  shareToken: string;
  isActive: boolean;
  status: 'pending' | 'selecting' | 'completed';
}

const AlbumList: React.FC = () => {
  const [albums] = useState<Album[]>([
    {
      id: '1',
      name: 'Ensaio Ana Silva',
      clientName: 'Ana Silva',
      eventDate: new Date('2024-01-20T14:00:00'),
      photoCount: 45,
      selectedCount: 12,
      shareToken: 'abc123def456',
      isActive: true,
      status: 'completed',
    },
    {
      id: '2',
      name: 'Pré-wedding João & Maria',
      clientName: 'João Santos',
      eventDate: new Date('2024-01-18T16:00:00'),
      photoCount: 38,
      selectedCount: 0,
      shareToken: 'xyz789uvw012',
      isActive: true,
      status: 'selecting',
    },
    {
      id: '3',
      name: 'Book Profissional Maria',
      clientName: 'Maria Costa',
      eventDate: new Date('2024-01-15T10:00:00'),
      photoCount: 22,
      selectedCount: 0,
      shareToken: 'mno345pqr678',
      isActive: true,
      status: 'pending',
    },
  ]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Aguardando' },
      selecting: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Selecionando' },
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Concluído' },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const copyShareLink = (shareToken: string) => {
    const shareUrl = `${window.location.origin}/album/${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copiado para a área de transferência!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Álbuns</h1>
        <p className="text-gray-600">Gerencie os álbuns de fotos dos seus clientes</p>
      </div>

      <div className="grid gap-6">
        {albums.map((album) => (
          <div key={album.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Image className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{album.name}</h3>
                  <p className="text-gray-600 flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {album.clientName}
                  </p>
                </div>
              </div>
              {getStatusBadge(album.status)}
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>{format(album.eventDate, "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
              <div className="text-gray-600">
                <span className="font-medium">{album.photoCount}</span> fotos
              </div>
              <div className="text-gray-600">
                <span className="font-medium">{album.selectedCount}</span> selecionadas
              </div>
            </div>

            {album.selectedCount > 0 && (
              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(album.selectedCount / album.photoCount) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {Math.round((album.selectedCount / album.photoCount) * 100)}% das fotos selecionadas
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => copyShareLink(album.shareToken)}
                className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Compartilhar
              </button>
              <button className="flex items-center gap-2 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                <Eye className="w-4 h-4" />
                Visualizar
              </button>
              {album.selectedCount > 0 && (
                <button className="flex items-center gap-2 px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                  <Download className="w-4 h-4" />
                  Download
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlbumList;