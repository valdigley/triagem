import React, { useState } from 'react';
import { Upload, Eye, Save, X, Image as ImageIcon } from 'lucide-react';
import { useSupabaseData } from '../hooks/useSupabaseData';
import toast from 'react-hot-toast';

interface WatermarkSettingsProps {
  onClose: () => void;
}

const WatermarkSettings: React.FC<WatermarkSettingsProps> = ({ onClose }) => {
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
  const [watermarkPreview, setWatermarkPreview] = useState<string>('');
  const [position, setPosition] = useState<'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'>('bottom-right');
  const [opacity, setOpacity] = useState(0.7);
  const [size, setSize] = useState(20); // Porcentagem do tamanho da imagem
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar se é PNG
    if (file.type !== 'image/png') {
      toast.error('Por favor, selecione um arquivo PNG');
      return;
    }

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 5MB.');
      return;
    }

    setWatermarkFile(file);

    // Criar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setWatermarkPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!watermarkFile) {
      toast.error('Selecione um arquivo de marca d\'água');
      return;
    }

    setIsUploading(true);
    try {
      // Salvar as configurações no banco de dados via Supabase
      const { supabase } = await import('../lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const { error } = await supabase
        .from('photographers')
        .update({
          watermark_config: {
            watermarkFile: watermarkPreview,
            position,
            opacity,
            size,
            fileName: watermarkFile.name,
            updatedAt: new Date().toISOString(),
          },
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error saving watermark to database:', error);
        toast.error('Erro ao salvar marca d\'água');
        return;
      }

      toast.success('Marca d\'água configurada com sucesso!');
      onClose();
    } catch (error) {
      console.error('Error saving watermark:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsUploading(false);
    }
  };

  // Carregar configuração existente
  React.useEffect(() => {
    const loadWatermarkConfig = async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) return;

        const { data: photographer } = await supabase
          .from('photographers')
          .select('watermark_config')
          .eq('user_id', user.id)
          .limit(1);

        if (photographer && photographer.length > 0 && photographer[0].watermark_config) {
          const config = photographer[0].watermark_config;
          if (config.watermarkFile) setWatermarkPreview(config.watermarkFile);
          if (config.position) setPosition(config.position);
          if (config.opacity) setOpacity(config.opacity);
          if (config.size) setSize(config.size);
        }
      } catch (error) {
        console.error('Error loading watermark config:', error);
      }
    };

    loadWatermarkConfig();
  }, []);

  const positionOptions = [
    { value: 'center', label: 'Centro' },
    { value: 'bottom-right', label: 'Inferior Direito' },
    { value: 'bottom-left', label: 'Inferior Esquerdo' },
    { value: 'top-right', label: 'Superior Direito' },
    { value: 'top-left', label: 'Superior Esquerdo' },
  ];

  const getPositionStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      opacity: opacity,
      width: `${size}%`,
      height: 'auto',
    };

    switch (position) {
      case 'center':
        return { ...baseStyle, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      case 'bottom-right':
        return { ...baseStyle, bottom: '10px', right: '10px' };
      case 'bottom-left':
        return { ...baseStyle, bottom: '10px', left: '10px' };
      case 'top-right':
        return { ...baseStyle, top: '10px', right: '10px' };
      case 'top-left':
        return { ...baseStyle, top: '10px', left: '10px' };
      default:
        return baseStyle;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Configurar Marca D'água</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 grid lg:grid-cols-2 gap-8">
          {/* Configurações */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Arquivo PNG da Marca D'água
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/png"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="watermark-upload"
                />
                <label
                  htmlFor="watermark-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">
                    Clique para selecionar arquivo PNG
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Máximo 5MB, apenas PNG com transparência
                  </p>
                </label>
              </div>
              {watermarkFile && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ {watermarkFile.name} selecionado
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Posição
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {positionOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opacidade: {Math.round(opacity * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tamanho: {size}% da imagem
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={size}
                onChange={(e) => setSize(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preview
            </label>
            <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
              {/* Imagem de exemplo */}
              <img
                src="https://picsum.photos/800/600?random=watermark-preview"
                alt="Preview"
                className="w-full h-full object-cover"
              />
              
              {/* Marca d'água */}
              {watermarkPreview && (
                <img
                  src={watermarkPreview}
                  alt="Watermark"
                  style={getPositionStyle()}
                />
              )}
              
              {!watermarkPreview && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                    <p>Selecione um arquivo PNG para ver o preview</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!watermarkFile || isUploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WatermarkSettings;