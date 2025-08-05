import React, { useState, useEffect } from 'react';
import { Save, Upload, X, Eye, EyeOff, Camera, Building, Mail, Phone, MapPin, Globe, Instagram, Palette, Image, Monitor, CreditCard, Key, Calendar, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photographerId, setPhotographerId] = useState<string | null>(null);
  
  // Estados para as configurações
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [logo, setLogo] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  
  // Configurações de preços
  const [photoPrice, setPhotoPrice] = useState(25.00);
  const [packagePhotos, setPackagePhotos] = useState(10);
  const [minimumPackagePrice, setMinimumPackagePrice] = useState(300.00);
  const [advancePaymentPercentage, setAdvancePaymentPercentage] = useState(50);
  
  // Configurações de pagamento
  const [mercadoPagoAccessToken, setMercadoPagoAccessToken] = useState('');
  const [mercadoPagoPublicKey, setMercadoPagoPublicKey] = useState('');
  const [showMercadoPagoToken, setShowMercadoPagoToken] = useState(false);
  
  // Google Calendar
  const [googleCalendarAccessToken, setGoogleCalendarAccessToken] = useState('');
  const [googleCalendarId, setGoogleCalendarId] = useState('');
  const [showGoogleToken, setShowGoogleToken] = useState(false);
  
  // Evolution API (WhatsApp)
  const [evolutionApiUrl, setEvolutionApiUrl] = useState('');
  const [evolutionApiKey, setEvolutionApiKey] = useState('');
  const [evolutionInstance, setEvolutionInstance] = useState('');
  const [showEvolutionKey, setShowEvolutionKey] = useState(false);
  
  // Login backgrounds
  const [loginBackgrounds, setLoginBackgrounds] = useState<string[]>([]);
  const [backgroundFiles, setBackgroundFiles] = useState<File[]>([]);
  
  // FTP Config
  const [ftpConfig, setFtpConfig] = useState({
    host: '',
    username: '',
    password: '',
    port: 21,
    monitor_path: '/photos',
    auto_upload: false
  });
  const [showFtpPassword, setShowFtpPassword] = useState(false);
  
  // Email templates
  const [emailTemplates, setEmailTemplates] = useState({
    bookingConfirmation: {
      enabled: true,
      subject: '✅ Agendamento Confirmado - {{studioName}}',
      message: 'Olá {{clientName}}!\n\nSeu agendamento foi confirmado com sucesso! 🎉\n\nDetalhes:\n• Tipo: {{sessionType}}\n• Data: {{eventDate}}\n• Horário: {{eventTime}}\n• Local: {{studioAddress}}\n\nEstamos ansiosos para te ver!\n{{studioName}}'
    },
    dayOfReminder: {
      enabled: true,
      subject: '🎉 Hoje é o dia da sua sessão! - {{studioName}}',
      message: 'Olá {{clientName}}!\n\nHoje é o grande dia da sua sessão de fotos! 📸\n\nLembre-se:\n• Horário: {{eventTime}}\n• Local: {{studioAddress}}\n• Chegue 10 minutos antes\n\nEstamos ansiosos para te ver!\n{{studioName}}'
    }
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      // Buscar ou criar perfil do fotógrafo
      let { data: photographer, error } = await supabase
        .from('photographers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading photographer:', error);
        setLoading(false);
        return;
      }

      if (!photographer) {
        // Criar perfil do fotógrafo se não existir
        console.log('Creating photographer profile...');
        const { data: newPhotographer, error: createError } = await supabase
          .from('photographers')
          .insert({
            user_id: user.id,
            business_name: user.name || 'Meu Estúdio',
            phone: '(11) 99999-9999',
            watermark_config: {
              photoPrice: 25.00,
              packagePhotos: 10,
              minimumPackagePrice: 300.00,
              advancePaymentPercentage: 50,
              sessionTypes: [
                { value: 'gestante', label: 'Sessão Gestante' },
                { value: 'aniversario', label: 'Aniversário' },
                { value: 'comerciais', label: 'Comerciais' },
                { value: 'pre-wedding', label: 'Pré Wedding' },
                { value: 'formatura', label: 'Formatura' },
                { value: 'revelacao-sexo', label: 'Revelação de Sexo' },
              ],
              emailTemplates: emailTemplates,
              loginBackgrounds: []
            }
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating photographer:', createError);
          toast.error('Erro ao criar perfil do fotógrafo');
          setLoading(false);
          return;
        }

        photographer = newPhotographer;
        toast.success('Perfil do fotógrafo criado!');
      }

      setPhotographerId(photographer.id);

      // Carregar configurações
      const config = photographer.watermark_config || {};
      
      setBusinessName(photographer.business_name || '');
      setPhone(photographer.phone || '');
      setEmail(config.email || '');
      setAddress(config.address || '');
      setWebsite(config.website || '');
      setInstagram(config.instagram || '');
      setLogo(config.logo || '');
      
      setPhotoPrice(config.photoPrice || 25.00);
      setPackagePhotos(config.packagePhotos || 10);
      setMinimumPackagePrice(config.minimumPackagePrice || 300.00);
      setAdvancePaymentPercentage(config.advancePaymentPercentage || 50);
      
      setMercadoPagoAccessToken(config.mercadoPagoAccessToken || '');
      setMercadoPagoPublicKey(config.mercadoPagoPublicKey || '');
      
      setGoogleCalendarAccessToken(config.googleCalendarAccessToken || '');
      setGoogleCalendarId(config.googleCalendarId || '');
      
      setEvolutionApiUrl(config.evolutionApiUrl || '');
      setEvolutionApiKey(config.evolutionApiKey || '');
      setEvolutionInstance(config.evolutionInstance || '');
      
      setLoginBackgrounds(config.loginBackgrounds || []);
      if (config.emailTemplates) {
        setEmailTemplates(config.emailTemplates);
      }

    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB.');
      return;
    }

    setLogoFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setLogo(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validar arquivos
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} não é uma imagem válida`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} é muito grande. Máximo 10MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setBackgroundFiles(prev => [...prev, ...validFiles]);

    // Converter para base64 e adicionar ao array
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setLoginBackgrounds(prev => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });

    toast.success(`${validFiles.length} imagem(ns) adicionada(s)`);
  };

  const removeBackground = (index: number) => {
    setLoginBackgrounds(prev => prev.filter((_, i) => i !== index));
    setBackgroundFiles(prev => prev.filter((_, i) => i !== index));
  };

  const saveSettings = async () => {
    if (!user || !photographerId) {
      toast.error('Usuário ou perfil do fotógrafo não encontrado');
      return;
    }

    setSaving(true);
    try {
      const watermarkConfig = {
        email,
        address,
        website,
        instagram,
        logo,
        photoPrice,
        packagePhotos,
        minimumPackagePrice,
        advancePaymentPercentage,
        mercadoPagoAccessToken,
        mercadoPagoPublicKey,
        googleCalendarAccessToken,
        googleCalendarId,
        evolutionApiUrl,
        evolutionApiKey,
        evolutionInstance,
        loginBackgrounds,
        emailTemplates,
        sessionTypes: [
          { value: 'gestante', label: 'Sessão Gestante' },
          { value: 'aniversario', label: 'Aniversário' },
          { value: 'comerciais', label: 'Comerciais' },
          { value: 'pre-wedding', label: 'Pré Wedding' },
          { value: 'formatura', label: 'Formatura' },
          { value: 'revelacao-sexo', label: 'Revelação de Sexo' },
        ],
        paymentMethods: {
          mercadoPago: !!mercadoPagoAccessToken,
          pix: true,
          creditCard: !!mercadoPagoAccessToken,
        }
      };

      const { error } = await supabase
        .from('photographers')
        .update({
          business_name: businessName,
          phone: phone,
          watermark_config: watermarkConfig
        })
        .eq('id', photographerId);

      if (error) {
        console.error('Error saving settings:', error);
        toast.error('Erro ao salvar configurações');
        return;
      }
      toast.success('Configurações salvas com sucesso!');
      
      // Verificar se as imagens foram salvas corretamente
      console.log('✅ VERIFICATION: Backgrounds saved successfully');
      console.log('📊 Total backgrounds:', loginBackgrounds.length);
      console.log('🖼️ First background preview:', loginBackgrounds[0]?.substring(0, 100) + '...');

    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-600">Configure seu estúdio e personalize o sistema</p>
      </div>

      {/* Informações do Estúdio */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Building className="w-5 h-5" />
          Informações do Estúdio
        </h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome do Estúdio *
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Meu Estúdio Fotográfico"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Telefone/WhatsApp *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              E-mail de Contato
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="contato@estudio.com"
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
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Rua das Flores, 123 - São Paulo"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Website
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://meusite.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instagram
            </label>
            <div className="relative">
              <Instagram className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="@meuinstagram"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Logo do Estúdio */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Logo do Estúdio
        </h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload da Logo
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-upload"
              />
              <label htmlFor="logo-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Clique para selecionar logo</p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG até 5MB</p>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preview
            </label>
            <div className="border border-gray-300 rounded-lg p-6 bg-gray-50 flex items-center justify-center" style={{ minHeight: '120px' }}>
              {logo ? (
                <img src={logo} alt="Logo" className="max-w-full max-h-20 object-contain" />
              ) : (
                <div className="text-center text-gray-500">
                  <Camera className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">Nenhuma logo carregada</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Imagens de Fundo da Tela de Login */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Monitor className="w-5 h-5" />
          Imagens de Fundo da Tela de Login
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload de Imagens de Fundo
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleBackgroundUpload}
                className="hidden"
                id="background-upload"
              />
              <label htmlFor="background-upload" className="cursor-pointer">
                <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Clique para selecionar imagens</p>
                <p className="text-xs text-gray-500 mt-1">Múltiplas imagens criam slideshow • PNG, JPG até 10MB cada</p>
              </label>
            </div>
          </div>

          {/* Preview das imagens de fundo */}
          {loginBackgrounds.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preview das Imagens ({loginBackgrounds.length})
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {loginBackgrounds.map((bg, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={bg}
                      alt={`Background ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      onClick={() => removeBackground(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Configurações de Preços */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Configurações de Preços
        </h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preço por Foto Extra (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={photoPrice}
              onChange={(e) => setPhotoPrice(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fotos Incluídas no Pacote
            </label>
            <input
              type="number"
              min="1"
              value={packagePhotos}
              onChange={(e) => setPackagePhotos(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preço Mínimo do Pacote (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={minimumPackagePrice}
              onChange={(e) => setMinimumPackagePrice(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pagamento Antecipado (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={advancePaymentPercentage}
              onChange={(e) => setAdvancePaymentPercentage(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Resumo da Configuração</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p>• Pacote mínimo: {packagePhotos} fotos por R$ {minimumPackagePrice.toFixed(2)}</p>
            <p>• Pagamento antecipado: {advancePaymentPercentage}% = R$ {(minimumPackagePrice * advancePaymentPercentage / 100).toFixed(2)}</p>
            <p>• Fotos extras: R$ {photoPrice.toFixed(2)} cada</p>
          </div>
        </div>
      </div>

      {/* Mercado Pago */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Mercado Pago
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Access Token
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type={showMercadoPagoToken ? 'text' : 'password'}
                value={mercadoPagoAccessToken}
                onChange={(e) => setMercadoPagoAccessToken(e.target.value)}
                className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="APP_USR-..."
              />
              <button
                type="button"
                onClick={() => setShowMercadoPagoToken(!showMercadoPagoToken)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showMercadoPagoToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Public Key
            </label>
            <input
              type="text"
              value={mercadoPagoPublicKey}
              onChange={(e) => setMercadoPagoPublicKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="APP_USR-..."
            />
          </div>
        </div>
      </div>

      {/* Google Calendar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Google Calendar
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Access Token
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type={showGoogleToken ? 'text' : 'password'}
                value={googleCalendarAccessToken}
                onChange={(e) => setGoogleCalendarAccessToken(e.target.value)}
                className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="ya29...."
              />
              <button
                type="button"
                onClick={() => setShowGoogleToken(!showGoogleToken)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showGoogleToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Calendar ID (opcional)
            </label>
            <input
              type="text"
              value={googleCalendarId}
              onChange={(e) => setGoogleCalendarId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="primary ou seu-calendario@gmail.com"
            />
          </div>
        </div>
      </div>

      {/* Evolution API (WhatsApp) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Evolution API (WhatsApp)
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL da API
            </label>
            <input
              type="url"
              value={evolutionApiUrl}
              onChange={(e) => setEvolutionApiUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://api.evolution.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type={showEvolutionKey ? 'text' : 'password'}
                value={evolutionApiKey}
                onChange={(e) => setEvolutionApiKey(e.target.value)}
                className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="sua-api-key"
              />
              <button
                type="button"
                onClick={() => setShowEvolutionKey(!showEvolutionKey)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showEvolutionKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome da Instância
            </label>
            <input
              type="text"
              value={evolutionInstance}
              onChange={(e) => setEvolutionInstance(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="minha-instancia"
            />
          </div>
        </div>
      </div>

      {/* Templates de Email */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Templates de Email
        </h3>
        
        <div className="space-y-6">
          {/* Confirmação de Agendamento */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">Confirmação de Agendamento</h4>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={emailTemplates.bookingConfirmation.enabled}
                  onChange={(e) => setEmailTemplates(prev => ({
                    ...prev,
                    bookingConfirmation: {
                      ...prev.bookingConfirmation,
                      enabled: e.target.checked
                    }
                  }))}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Ativo</span>
              </label>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assunto
                </label>
                <input
                  type="text"
                  value={emailTemplates.bookingConfirmation.subject}
                  onChange={(e) => setEmailTemplates(prev => ({
                    ...prev,
                    bookingConfirmation: {
                      ...prev.bookingConfirmation,
                      subject: e.target.value
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensagem
                </label>
                <textarea
                  value={emailTemplates.bookingConfirmation.message}
                  onChange={(e) => setEmailTemplates(prev => ({
                    ...prev,
                    bookingConfirmation: {
                      ...prev.bookingConfirmation,
                      message: e.target.value
                    }
                  }))}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Lembrete do Dia */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">Lembrete do Dia</h4>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={emailTemplates.dayOfReminder.enabled}
                  onChange={(e) => setEmailTemplates(prev => ({
                    ...prev,
                    dayOfReminder: {
                      ...prev.dayOfReminder,
                      enabled: e.target.checked
                    }
                  }))}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Ativo</span>
              </label>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assunto
                </label>
                <input
                  type="text"
                  value={emailTemplates.dayOfReminder.subject}
                  onChange={(e) => setEmailTemplates(prev => ({
                    ...prev,
                    dayOfReminder: {
                      ...prev.dayOfReminder,
                      subject: e.target.value
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensagem
                </label>
                <textarea
                  value={emailTemplates.dayOfReminder.message}
                  onChange={(e) => setEmailTemplates(prev => ({
                    ...prev,
                    dayOfReminder: {
                      ...prev.dayOfReminder,
                      message: e.target.value
                    }
                  }))}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Variáveis Disponíveis</h4>
            <div className="text-sm text-blue-800 grid md:grid-cols-2 gap-2">
              <div>• {{clientName}} - Nome do cliente</div>
              <div>• {{studioName}} - Nome do estúdio</div>
              <div>• {{sessionType}} - Tipo da sessão</div>
              <div>• {{eventDate}} - Data do evento</div>
              <div>• {{eventTime}} - Horário do evento</div>
              <div>• {{studioAddress}} - Endereço do estúdio</div>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Info */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🔧 Debug Info</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Imagens de Fundo</h4>
            <div className="space-y-1 text-gray-600">
              <div>Total: {loginBackgrounds.length}</div>
              <div>Array existe: {loginBackgrounds ? '✅' : '❌'}</div>
              <div>É array: {Array.isArray(loginBackgrounds) ? '✅' : '❌'}</div>
              {loginBackgrounds.length > 0 && (
                <div>Primeira imagem: {loginBackgrounds[0]?.substring(0, 50)}...</div>
              )}
            </div>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Configurações</h4>
            <div className="space-y-1 text-gray-600">
              <div>Photographer ID: {photographerId || 'Não encontrado'}</div>
              <div>Business Name: {businessName || 'Não definido'}</div>
              <div>Logo: {logo ? '✅ Carregada' : '❌ Não carregada'}</div>
              <div>Mercado Pago: {mercadoPagoAccessToken ? '✅ Configurado' : '❌ Não configurado'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Monitoramento FTP */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Monitoramento FTP
        </h3>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-blue-900 mb-2">📁 Upload Automático de Fotos</h4>
          <p className="text-sm text-blue-800">
            Configure seu servidor FTP para upload automático de fotos. O sistema monitorará a pasta especificada 
            e adicionará automaticamente novas fotos aos álbuns correspondentes.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Servidor FTP
              </label>
              <input
                type="text"
                value={ftpConfig.host}
                onChange={(e) => setFtpConfig(prev => ({ ...prev, host: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="ftp.seuservidor.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Usuário
              </label>
              <input
                type="text"
                value={ftpConfig.username}
                onChange={(e) => setFtpConfig(prev => ({ ...prev, username: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="usuario_ftp"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showFtpPassword ? 'text' : 'password'}
                  value={ftpConfig.password}
                  onChange={(e) => setFtpConfig(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="senha_ftp"
                />
                <button
                  type="button"
                  onClick={() => setShowFtpPassword(!showFtpPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showFtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Porta
              </label>
              <input
                type="number"
                value={ftpConfig.port}
                onChange={(e) => setFtpConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 21 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="21"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pasta de Monitoramento
              </label>
              <input
                type="text"
                value={ftpConfig.monitor_path}
                onChange={(e) => setFtpConfig(prev => ({ ...prev, monitor_path: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="/photos"
              />
              <p className="text-xs text-gray-500 mt-1">
                Pasta que será monitorada para novas fotos
              </p>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={ftpConfig.auto_upload}
                  onChange={(e) => setFtpConfig(prev => ({ ...prev, auto_upload: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Upload automático ativo</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Salvando...' : 'Salvar Todas as Configurações'}
        </button>
      </div>
    </div>
  );
};

export default Settings;