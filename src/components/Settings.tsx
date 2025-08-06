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
      
      setEvolutionApiUrl(config.evolutionApiUrl || '');
      setEvolutionApiKey(config.evolutionApiKey || '');
      setEvolutionInstance(config.evolutionInstance || '');
      
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
        evolutionApiUrl,
        evolutionApiKey,
        evolutionInstance,
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
              <div>• {'{{clientName}}'} - Nome do cliente</div>
              <div>• {'{{studioName}}'} - Nome do estúdio</div>
              <div>• {'{{sessionType}}'} - Tipo da sessão</div>
              <div>• {'{{eventDate}}'} - Data do evento</div>
              <div>• {'{{eventTime}}'} - Horário do evento</div>
              <div>• {'{{studioAddress}}'} - Endereço do estúdio</div>
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