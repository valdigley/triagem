import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Save, 
  Upload, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  Settings as SettingsIcon,
  DollarSign,
  Camera,
  Mail,
  MessageCircle,
  Palette,
  Building,
  Phone,
  MapPin,
  Globe,
  Instagram,
  Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import WatermarkSettings from './WatermarkSettings';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'pricing' | 'watermark' | 'emails' | 'sessions'>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showWatermarkModal, setShowWatermarkModal] = useState(false);

  // Estados para configurações gerais
  const [generalSettings, setGeneralSettings] = useState({
    businessName: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    instagram: '',
    logo: '',
  });

  // Estados para configurações de preços
  const [pricingSettings, setPricingSettings] = useState({
    photoPrice: 25.00,
    packagePhotos: 10,
    minimumPackagePrice: 300.00,
    advancePaymentPercentage: 50,
    mercadoPagoAccessToken: '',
    mercadoPagoPublicKey: '',
  });

  // Estados para configurações de marca d'água
  const [watermarkSettings, setWatermarkSettings] = useState({
    watermarkFile: '',
    position: 'bottom-right' as 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left',
    opacity: 0.7,
    size: 20,
  });

  // Estados para templates de email
  const [emailTemplates, setEmailTemplates] = useState({
    bookingConfirmation: {
      enabled: true,
      subject: '📸 Agendamento Confirmado - {{studioName}}',
      message: 'Olá {{clientName}}!\n\nSeu agendamento foi confirmado com sucesso! 🎉\n\nDetalhes:\n• Tipo: {{sessionType}}\n• Data: {{eventDate}} às {{eventTime}}\n• Local: {{studioAddress}}\n\nEm breve você receberá suas fotos para seleção.\n\nObrigado!\n{{studioName}}'
    },
    dayOfReminder: {
      enabled: true,
      subject: '🎉 Hoje é o dia da sua sessão! - {{studioName}}',
      message: 'Olá {{clientName}}!\n\nHoje é o grande dia da sua sessão de fotos! 📸\n\nLembre-se:\n• Horário: {{eventTime}}\n• Local: {{studioAddress}}\n• Chegue 10 minutos antes\n\nEstamos ansiosos para te ver!\n{{studioName}}'
    }
  });

  // Estados para tipos de sessão
  const [sessionTypes, setSessionTypes] = useState([
    { value: 'gestante', label: 'Sessão Gestante' },
    { value: 'aniversario', label: 'Aniversário' },
    { value: 'comerciais', label: 'Comerciais' },
    { value: 'pre-wedding', label: 'Pré Wedding' },
    { value: 'formatura', label: 'Formatura' },
    { value: 'revelacao-sexo', label: 'Revelação de Sexo' },
  ]);

  const [newSessionType, setNewSessionType] = useState({ value: '', label: '' });

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      const { data: photographer, error } = await supabase
        .from('photographers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading photographer:', error);
        return;
      }

      if (photographer) {
        // Carregar configurações gerais
        setGeneralSettings({
          businessName: photographer.business_name || '',
          email: photographer.watermark_config?.email || '',
          phone: photographer.phone || '',
          address: photographer.watermark_config?.address || '',
          website: photographer.watermark_config?.website || '',
          instagram: photographer.watermark_config?.instagram || '',
          logo: photographer.watermark_config?.logo || '',
        });

        // Carregar configurações de preços
        const config = photographer.watermark_config || {};
        setPricingSettings({
          photoPrice: config.photoPrice || 25.00,
          packagePhotos: config.packagePhotos || 10,
          minimumPackagePrice: config.minimumPackagePrice || 300.00,
          advancePaymentPercentage: config.advancePaymentPercentage || 50,
          mercadoPagoAccessToken: config.mercadoPagoAccessToken || '',
          mercadoPagoPublicKey: config.mercadoPagoPublicKey || '',
        });

        // Carregar configurações de marca d'água
        setWatermarkSettings({
          watermarkFile: config.watermarkFile || '',
          position: config.position || 'bottom-right',
          opacity: config.opacity || 0.7,
          size: config.size || 20,
        });

        // Carregar templates de email
        if (config.emailTemplates) {
          setEmailTemplates(config.emailTemplates);
        }

        // Carregar tipos de sessão
        if (config.sessionTypes) {
          setSessionTypes(config.sessionTypes);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Combinar todas as configurações
      const allSettings = {
        ...generalSettings,
        ...pricingSettings,
        ...watermarkSettings,
        emailTemplates,
        sessionTypes,
      };

      // Primeiro, verificar se o fotógrafo existe
      const { data: existingPhotographer } = await supabase
        .from('photographers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existingPhotographer) {
        // Atualizar fotógrafo existente
        const { error } = await supabase
          .from('photographers')
          .update({
            business_name: generalSettings.businessName,
            phone: generalSettings.phone,
            watermark_config: allSettings,
          })
          .eq('user_id', user.id);

        if (error) {
          console.error('Error updating photographer:', error);
          toast.error('Erro ao salvar configurações');
          return;
        }
      } else {
        // Criar novo fotógrafo
        const { error } = await supabase
          .from('photographers')
          .insert({
            user_id: user.id,
            business_name: generalSettings.businessName || 'Meu Estúdio',
            phone: generalSettings.phone || '(11) 99999-9999',
            watermark_config: allSettings,
          });

        if (error) {
          console.error('Error creating photographer:', error);
          toast.error('Erro ao criar perfil');
          return;
        }
      }

      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setGeneralSettings(prev => ({
        ...prev,
        logo: e.target?.result as string
      }));
    };
    reader.readAsDataURL(file);
  };

  const addSessionType = () => {
    if (!newSessionType.value || !newSessionType.label) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (sessionTypes.some(type => type.value === newSessionType.value)) {
      toast.error('Este tipo já existe');
      return;
    }

    setSessionTypes(prev => [...prev, newSessionType]);
    setNewSessionType({ value: '', label: '' });
    toast.success('Tipo de sessão adicionado!');
  };

  const removeSessionType = (value: string) => {
    setSessionTypes(prev => prev.filter(type => type.value !== value));
    toast.success('Tipo de sessão removido!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Carregando configurações...</span>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'Geral', icon: Building },
    { id: 'pricing', label: 'Preços', icon: DollarSign },
    { id: 'watermark', label: 'Marca D\'água', icon: ImageIcon },
    { id: 'emails', label: 'E-mails', icon: Mail },
    { id: 'sessions', label: 'Tipos de Sessão', icon: Camera },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-600">Gerencie as configurações do seu estúdio</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Tudo'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Informações Gerais</h3>
            
            {/* Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo do Estúdio
              </label>
              <div className="flex items-center gap-4">
                {generalSettings.logo && (
                  <img 
                    src={generalSettings.logo} 
                    alt="Logo" 
                    className="w-16 h-16 object-contain border border-gray-200 rounded-lg"
                  />
                )}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label
                    htmlFor="logo-upload"
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Escolher Logo
                  </label>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG até 5MB</p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Estúdio
                </label>
                <input
                  type="text"
                  value={generalSettings.businessName}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, businessName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Meu Estúdio Fotográfico"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-mail
                </label>
                <input
                  type="email"
                  value={generalSettings.email}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contato@estudio.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={generalSettings.phone}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Endereço
                </label>
                <input
                  type="text"
                  value={generalSettings.address}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Rua das Flores, 123 - São Paulo, SP"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={generalSettings.website}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, website: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://meusite.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instagram
                </label>
                <input
                  type="text"
                  value={generalSettings.instagram}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, instagram: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="@meuinstagram"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pricing' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Configurações de Preços</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preço por Foto Extra (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricingSettings.photoPrice}
                    onChange={(e) => setPricingSettings(prev => ({ ...prev, photoPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Valor cobrado por cada foto além do pacote</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fotos Incluídas no Pacote
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={pricingSettings.packagePhotos}
                    onChange={(e) => setPricingSettings(prev => ({ ...prev, packagePhotos: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Quantas fotos estão incluídas no pacote mínimo</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valor do Pacote Mínimo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricingSettings.minimumPackagePrice}
                    onChange={(e) => setPricingSettings(prev => ({ ...prev, minimumPackagePrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Valor total do pacote com as fotos incluídas</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pagamento Antecipado (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={pricingSettings.advancePaymentPercentage}
                    onChange={(e) => setPricingSettings(prev => ({ ...prev, advancePaymentPercentage: parseInt(e.target.value) || 50 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Porcentagem paga no agendamento</p>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3">Resumo dos Preços</h4>
                <div className="space-y-2 text-sm text-blue-800">
                  <div className="flex justify-between">
                    <span>Pacote ({pricingSettings.packagePhotos} fotos):</span>
                    <span>R$ {pricingSettings.minimumPackagePrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pagamento antecipado:</span>
                    <span>R$ {(pricingSettings.minimumPackagePrice * pricingSettings.advancePaymentPercentage / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Foto extra:</span>
                    <span>R$ {pricingSettings.photoPrice.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-blue-200 pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Exemplo (15 fotos):</span>
                      <span>R$ {(pricingSettings.minimumPackagePrice + (5 * pricingSettings.photoPrice)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-semibold text-gray-900 mb-4">Mercado Pago</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Access Token
                  </label>
                  <input
                    type="password"
                    value={pricingSettings.mercadoPagoAccessToken}
                    onChange={(e) => setPricingSettings(prev => ({ ...prev, mercadoPagoAccessToken: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="APP_USR-..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Public Key
                  </label>
                  <input
                    type="text"
                    value={pricingSettings.mercadoPagoPublicKey}
                    onChange={(e) => setPricingSettings(prev => ({ ...prev, mercadoPagoPublicKey: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="APP_USR-..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'watermark' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Marca D'água</h3>
              <button
                onClick={() => setShowWatermarkModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Palette className="w-4 h-4" />
                Configurar Marca D'água
              </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-600">
                Configure sua marca d'água personalizada para proteger suas fotos durante a visualização pelos clientes.
                A marca d'água será aplicada automaticamente em todas as fotos exibidas na galeria de seleção.
              </p>
            </div>

            {watermarkSettings.watermarkFile && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Preview da Marca D'água</h4>
                <div className="relative inline-block">
                  <img
                    src="https://picsum.photos/400/300?random=watermark-preview"
                    alt="Preview"
                    className="rounded-lg"
                  />
                  <img
                    src={watermarkSettings.watermarkFile}
                    alt="Watermark"
                    className="absolute"
                    style={{
                      opacity: watermarkSettings.opacity,
                      width: `${watermarkSettings.size}%`,
                      height: 'auto',
                      ...(watermarkSettings.position === 'center' && {
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)'
                      }),
                      ...(watermarkSettings.position === 'bottom-right' && {
                        bottom: '10px',
                        right: '10px'
                      }),
                      ...(watermarkSettings.position === 'bottom-left' && {
                        bottom: '10px',
                        left: '10px'
                      }),
                      ...(watermarkSettings.position === 'top-right' && {
                        top: '10px',
                        right: '10px'
                      }),
                      ...(watermarkSettings.position === 'top-left' && {
                        top: '10px',
                        left: '10px'
                      }),
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'emails' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Templates de E-mail</h3>
            
            {Object.entries(emailTemplates).map(([key, template]) => (
              <div key={key} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">
                    {key === 'bookingConfirmation' ? 'Confirmação de Agendamento' : 'Lembrete do Dia'}
                  </h4>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={template.enabled}
                      onChange={(e) => setEmailTemplates(prev => ({
                        ...prev,
                        [key]: { ...template, enabled: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-600">Ativo</span>
                  </label>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assunto
                    </label>
                    <input
                      type="text"
                      value={template.subject}
                      onChange={(e) => setEmailTemplates(prev => ({
                        ...prev,
                        [key]: { ...template, subject: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={!template.enabled}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mensagem
                    </label>
                    <textarea
                      value={template.message}
                      onChange={(e) => setEmailTemplates(prev => ({
                        ...prev,
                        [key]: { ...template, message: e.target.value }
                      }))}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={!template.enabled}
                    />
                  </div>
                </div>

                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">Variáveis disponíveis:</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {['{{clientName}}', '{{sessionType}}', '{{studioName}}', '{{eventDate}}', '{{eventTime}}', '{{studioAddress}}', '{{studioPhone}}'].map(variable => (
                      <code key={variable} className="bg-white px-2 py-1 rounded border">
                        {variable}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Tipos de Sessão</h3>
            
            {/* Adicionar novo tipo */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">Adicionar Novo Tipo</h4>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valor (ID)
                  </label>
                  <input
                    type="text"
                    value={newSessionType.value}
                    onChange={(e) => setNewSessionType(prev => ({ ...prev, value: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="ex: casamento"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome de Exibição
                  </label>
                  <input
                    type="text"
                    value={newSessionType.label}
                    onChange={(e) => setNewSessionType(prev => ({ ...prev, label: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="ex: Casamento"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={addSessionType}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de tipos existentes */}
            <div className="space-y-2">
              {sessionTypes.map((type) => (
                <div key={type.value} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div>
                    <span className="font-medium text-gray-900">{type.label}</span>
                    <span className="text-sm text-gray-500 ml-2">({type.value})</span>
                  </div>
                  <button
                    onClick={() => removeSessionType(type.value)}
                    className="flex items-center gap-2 px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Watermark Modal */}
      {showWatermarkModal && (
        <WatermarkSettings onClose={() => setShowWatermarkModal(false)} />
      )}
    </div>
  );
};

export default Settings;