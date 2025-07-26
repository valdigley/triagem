import React, { useState, useEffect } from 'react';
import { Save, Upload, Eye, X, CreditCard, Building, Mail, Phone, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface StudioSettings {
  businessName: string;
  email: string;
  phone: string;
  address: string;
  website?: string;
  instagram?: string;
  logo?: string;
  watermarkFile?: string;
  watermarkPosition: 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  watermarkOpacity: number;
  watermarkSize: number;
  mercadoPagoAccessToken?: string;
  mercadoPagoPublicKey?: string;
  minimumPackagePrice: number;
  extraPhotoPrice: number;
  advancePaymentPercentage: number;
}

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<StudioSettings>({
    businessName: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    instagram: '',
    watermarkPosition: 'bottom-right',
    watermarkOpacity: 0.7,
    watermarkSize: 20,
    minimumPackagePrice: 300.00,
    extraPhotoPrice: 30.00,
    advancePaymentPercentage: 50,
  });
  
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
  const [watermarkPreview, setWatermarkPreview] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'studio' | 'watermark' | 'payment'>('studio');

  // Carregar configurações
  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      // Carregar do banco de dados
      const { data: photographer, error } = await supabase
        .from('photographers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (photographer) {
        setSettings(prev => ({
          ...prev,
          businessName: photographer.business_name || '',
          phone: photographer.phone || '',
          watermarkPosition: photographer.watermark_config?.position || 'bottom-right',
          watermarkOpacity: photographer.watermark_config?.opacity || 0.7,
          watermarkSize: photographer.watermark_config?.size || 20,
          logo: photographer.watermark_config?.logo || '',
          email: photographer.watermark_config?.email || '',
          address: photographer.watermark_config?.address || '',
          website: photographer.watermark_config?.website || '',
          instagram: photographer.watermark_config?.instagram || '',
          mercadoPagoAccessToken: photographer.watermark_config?.mercadoPagoAccessToken || '',
          mercadoPagoPublicKey: photographer.watermark_config?.mercadoPagoPublicKey || '',
          minimumPackagePrice: photographer.watermark_config?.minimumPackagePrice || 300.00,
          extraPhotoPrice: photographer.watermark_config?.extraPhotoPrice || 30.00,
          advancePaymentPercentage: photographer.watermark_config?.advancePaymentPercentage || 50,
        }));
        if (photographer.watermark_config?.watermarkFile) {
          setWatermarkPreview(photographer.watermark_config.watermarkFile);
        }
      }

      // Carregar configurações locais como fallback
      const localSettings = localStorage.getItem('studio_settings');
      if (localSettings) {
        const parsed = JSON.parse(localSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      }

      const localWatermark = localStorage.getItem('watermark_config');
      if (localWatermark) {
        const watermarkConfig = JSON.parse(localWatermark);
        setWatermarkPreview(watermarkConfig.file || '');
      }

    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWatermarkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'image/png') {
      toast.error('Por favor, selecione um arquivo PNG');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 5MB.');
      return;
    }

    setWatermarkFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setWatermarkPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Preparar configurações para salvar
      const configToSave = {
        ...settings,
        watermarkFile: watermarkPreview,
        updatedAt: new Date().toISOString(),
      };

      // Salvar no banco de dados
      const { error } = await supabase
        .from('photographers')
        .update({
          business_name: settings.businessName,
          phone: settings.phone,
          watermark_config: {
            logo: settings.logo,
            email: settings.email,
            address: settings.address,
            website: settings.website,
            instagram: settings.instagram,
            position: settings.watermarkPosition,
            opacity: settings.watermarkOpacity,
            size: settings.watermarkSize,
            watermarkFile: watermarkPreview,
            mercadoPagoAccessToken: settings.mercadoPagoAccessToken,
            mercadoPagoPublicKey: settings.mercadoPagoPublicKey,
            minimumPackagePrice: settings.minimumPackagePrice,
            extraPhotoPrice: settings.extraPhotoPrice,
            advancePaymentPercentage: settings.advancePaymentPercentage,
          },
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error saving to database:', error);
        // Continuar com salvamento local como fallback
      }

      // Salvar localmente como backup
      localStorage.setItem('studio_settings', JSON.stringify(configToSave));
      localStorage.setItem('watermark_config', JSON.stringify({
        file: watermarkPreview,
        position: settings.watermarkPosition,
        opacity: settings.watermarkOpacity,
        size: settings.watermarkSize,
      }));

      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const getWatermarkStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      opacity: settings.watermarkOpacity,
      width: `${settings.watermarkSize}%`,
      height: 'auto',
      pointerEvents: 'none' as const,
    };

    switch (settings.watermarkPosition) {
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

  const positionOptions = [
    { value: 'center', label: 'Centro' },
    { value: 'bottom-right', label: 'Inferior Direito' },
    { value: 'bottom-left', label: 'Inferior Esquerdo' },
    { value: 'top-right', label: 'Superior Direito' },
    { value: 'top-left', label: 'Superior Esquerdo' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações do Sistema</h1>
        <p className="text-gray-600">Configure seu estúdio, marca d'água e formas de pagamento</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'studio', label: 'Dados do Estúdio', icon: Building },
            { key: 'watermark', label: 'Marca D\'água', icon: Eye },
            { key: 'payment', label: 'Pagamentos', icon: CreditCard },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Dados do Estúdio */}
        {activeTab === 'studio' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Informações do Estúdio</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Estúdio *
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={settings.businessName}
                    onChange={(e) => setSettings(prev => ({ ...prev, businessName: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Meu Estúdio Fotográfico"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-mail *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="contato@estudio.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={settings.phone}
                    onChange={(e) => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Endereço
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={settings.address}
                    onChange={(e) => setSettings(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Rua das Flores, 123 - São Paulo"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={settings.website}
                  onChange={(e) => setSettings(prev => ({ ...prev, website: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://meusite.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo do Estúdio
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          setSettings(prev => ({ ...prev, logo: e.target?.result as string }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label htmlFor="logo-upload" className="cursor-pointer flex flex-col items-center">
                    {settings.logo ? (
                      <img 
                        src={settings.logo} 
                        alt="Logo" 
                        className="h-20 mb-2 object-contain"
                      />
                    ) : (
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    )}
                    <p className="text-sm text-gray-600">
                      {settings.logo ? 'Clique para alterar logo' : 'Clique para adicionar logo'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG até 5MB
                    </p>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instagram
                </label>
                <input
                  type="text"
                  value={settings.instagram}
                  onChange={(e) => setSettings(prev => ({ ...prev, instagram: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="@meuinstagram"
                />
              </div>
            </div>
          </div>
        )}

        {/* Marca D'água */}
        {activeTab === 'watermark' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Configuração da Marca D'água</h3>
            
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Arquivo PNG da Marca D'água
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/png"
                      onChange={handleWatermarkUpload}
                      className="hidden"
                      id="watermark-upload"
                    />
                    <label htmlFor="watermark-upload" className="cursor-pointer flex flex-col items-center">
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
                    value={settings.watermarkPosition}
                    onChange={(e) => setSettings(prev => ({ ...prev, watermarkPosition: e.target.value as any }))}
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
                    Opacidade: {Math.round(settings.watermarkOpacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={settings.watermarkOpacity}
                    onChange={(e) => setSettings(prev => ({ ...prev, watermarkOpacity: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tamanho: {settings.watermarkSize}% da imagem
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={settings.watermarkSize}
                    onChange={(e) => setSettings(prev => ({ ...prev, watermarkSize: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preview
                </label>
                <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                  <img
                    src="https://picsum.photos/800/600?random=watermark-preview"
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  
                  {watermarkPreview && (
                    <img
                      src={watermarkPreview}
                      alt="Watermark"
                      style={getWatermarkStyle()}
                    />
                  )}
                  
                  {!watermarkPreview && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <Eye className="w-12 h-12 mx-auto mb-2" />
                        <p>Selecione um arquivo PNG para ver o preview</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pagamentos */}
        {activeTab === 'payment' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Configuração de Pagamentos</h3>
            
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preço da Sessão Mínima (10 fotos) - R$
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.minimumPackagePrice}
                    onChange={(e) => setSettings(prev => ({ ...prev, minimumPackagePrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="300.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valor fixo para as primeiras 10 fotos da sessão
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preço por Foto Extra (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.extraPhotoPrice}
                    onChange={(e) => setSettings(prev => ({ ...prev, extraPhotoPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="30.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valor unitário para fotos acima das 10 incluídas no pacote
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Pagamento Antecipado na Sessão
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="advancePayment"
                        value="50"
                        checked={settings.advancePaymentPercentage === 50}
                        onChange={(e) => setSettings(prev => ({ ...prev, advancePaymentPercentage: 50 }))}
                        className="mr-3"
                      />
                      <span>50% antecipado (R$ {(settings.minimumPackagePrice * 0.5).toFixed(2)})</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="advancePayment"
                        value="100"
                        checked={settings.advancePaymentPercentage === 100}
                        onChange={(e) => setSettings(prev => ({ ...prev, advancePaymentPercentage: 100 }))}
                        className="mr-3"
                      />
                      <span>100% antecipado (R$ {settings.minimumPackagePrice.toFixed(2)})</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Configuração do Mercado Pago
                  </label>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-blue-800 text-sm mb-2">
                      <strong>💡 Sistema de Pagamento Integrado</strong>
                    </p>
                    <p className="text-blue-700 text-xs">
                      O sistema utiliza o Mercado Pago para processar todos os pagamentos (PIX, Cartão, etc.)
                    </p>
                  </div>
                </div>

                <div className="space-y-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h4 className="font-medium text-gray-900">Credenciais do Mercado Pago</h4>
                  <div className="text-sm text-gray-600 mb-4">
                    <div className="bg-blue-50 p-3 rounded border border-blue-200 mb-3">
                      <p className="text-blue-800"><strong>💡 Modo de Teste Ativo</strong></p>
                      <p className="text-blue-700 text-xs mt-1">
                        Use credenciais de <strong>teste</strong> que começam com <code>TEST-</code>
                      </p>
                    </div>
                    <p><strong>Produção:</strong> Credenciais começam com <code>APP_USR-</code></p>
                    <p><strong>Teste:</strong> Credenciais começam com <code>TEST-</code></p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Access Token *
                    </label>
                    <input
                      type="password"
                      value={settings.mercadoPagoAccessToken}
                      onChange={(e) => setSettings(prev => ({ ...prev, mercadoPagoAccessToken: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="TEST-... ou APP_USR-..."
                    />
                    {settings.mercadoPagoAccessToken && (
                      <p className={`text-xs mt-1 ${
                        settings.mercadoPagoAccessToken.startsWith('TEST-') 
                          ? 'text-blue-600' 
                          : settings.mercadoPagoAccessToken.startsWith('APP_USR-')
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {settings.mercadoPagoAccessToken.startsWith('TEST-') && '🧪 Modo TESTE - '}
                        {settings.mercadoPagoAccessToken.startsWith('APP_USR-') && '✅ Modo PRODUÇÃO - '}
                        {!settings.mercadoPagoAccessToken.startsWith('TEST-') && !settings.mercadoPagoAccessToken.startsWith('APP_USR-') && '⚠️ Formato inválido - '}
                        Token configurado ({settings.mercadoPagoAccessToken.length} caracteres)
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Public Key *
                    </label>
                    <input
                      type="text"
                      value={settings.mercadoPagoPublicKey}
                      onChange={(e) => setSettings(prev => ({ ...prev, mercadoPagoPublicKey: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="TEST-... ou APP_USR-..."
                    />
                    {settings.mercadoPagoPublicKey && (
                      <p className={`text-xs mt-1 ${
                        settings.mercadoPagoPublicKey.startsWith('TEST-') 
                          ? 'text-blue-600' 
                          : settings.mercadoPagoPublicKey.startsWith('APP_USR-')
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {settings.mercadoPagoPublicKey.startsWith('TEST-') && '🧪 Modo TESTE - '}
                        {settings.mercadoPagoPublicKey.startsWith('APP_USR-') && '✅ Modo PRODUÇÃO - '}
                        {!settings.mercadoPagoPublicKey.startsWith('TEST-') && !settings.mercadoPagoPublicKey.startsWith('APP_USR-') && '⚠️ Formato inválido - '}
                        Chave configurada ({settings.mercadoPagoPublicKey.length} caracteres)
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">
                    Obtenha suas credenciais em: 
                    <a href="https://www.mercadopago.com.br/developers" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                      Mercado Pago Developers
                    </a>
                  </p>
                  <div className="bg-blue-50 p-3 rounded border border-blue-200">
                    <p className="text-xs text-blue-800">
                      <strong>Dica:</strong> Após configurar, teste com um pagamento pequeno para verificar se está funcionando.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h4 className="font-medium text-gray-900 mb-4">Resumo da Configuração</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pacote mínimo (10 fotos):</span>
                    <span className="font-medium">R$ {settings.minimumPackagePrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Foto extra:</span>
                    <span className="font-medium">R$ {settings.extraPhotoPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pagamento antecipado:</span>
                    <span className="font-medium">{settings.advancePaymentPercentage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mercado Pago:</span>
                    <span className={settings.mercadoPagoAccessToken ? 'text-green-600' : 'text-red-600'}>
                      {settings.mercadoPagoAccessToken ? 'Configurado' : 'Não configurado'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Botão Salvar */}
        <div className="flex justify-end pt-6 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;