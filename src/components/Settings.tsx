import React, { useState, useEffect } from 'react';
import { Save, Upload, Eye, X, CreditCard, Building, Mail, Phone, MapPin, Plus, Trash2, Edit } from 'lucide-react';
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
  sessionTypes: Array<{ value: string; label: string }>;
  emailTemplates: {
    bookingConfirmation: {
      enabled: boolean;
      subject: string;
      message: string;
    };
    dayBeforeReminder: {
      enabled: boolean;
      subject: string;
      message: string;
    };
    dayOfReminder: {
      enabled: boolean;
      subject: string;
      message: string;
    };
  };
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
    sessionTypes: [
      { value: 'gestante', label: 'Sessão Gestante' },
      { value: 'aniversario', label: 'Aniversário' },
      { value: 'comerciais', label: 'Comerciais' },
      { value: 'pre-wedding', label: 'Pré Wedding' },
      { value: 'formatura', label: 'Formatura' },
      { value: 'revelacao-sexo', label: 'Revelação de Sexo' },
    ],
    emailTemplates: {
      bookingConfirmation: {
        enabled: true,
        subject: '📸 Agendamento Confirmado - {{sessionType}} - {{studioName}}',
        message: `Olá {{clientName}}!

Obrigado por escolher nosso estúdio! Seu agendamento foi confirmado com sucesso.

📅 DETALHES DA SESSÃO:
• Tipo: {{sessionType}}
• Data: {{eventDate}}
• Horário: {{eventTime}}
• Local: {{studioAddress}}

📍 LOCALIZAÇÃO DO ESTÚDIO:
{{studioName}}
{{studioAddress}}
📞 {{studioPhone}}
🌐 {{studioWebsite}}

📋 IMPORTANTE - LEIA COM ATENÇÃO:
• Referências: Traga fotos de referência ou ideias que gostaria de reproduzir
• Portfólio: As fotos poderão ser usadas em nosso portfólio e redes sociais. Caso não concorde, informe ao fotógrafo no dia da sessão
• Pontualidade: Chegue 10 minutos antes do horário agendado
• Seleção: Após a sessão, você receberá um link para selecionar suas fotos favoritas

Estamos ansiosos para criar memórias incríveis com você!

Dúvidas? Entre em contato: {{studioPhone}} | {{studioEmail}}`
      },
      dayBeforeReminder: {
        enabled: true,
        subject: '⏰ Lembrete: Sua sessão é amanhã! - {{studioName}}',
        message: `Olá {{clientName}}!

Sua sessão de fotos está chegando! Amanhã será o grande dia.

📅 DETALHES DA SESSÃO:
• Tipo: {{sessionType}}
• Data: {{eventDate}}
• Horário: {{eventTime}}
• Local: {{studioAddress}}

✅ CHECKLIST PARA AMANHÃ:
• Chegue 10 minutos antes do horário
• Traga suas fotos de referência
• Vista roupas confortáveis e adequadas ao tipo de sessão
• Tenha uma boa noite de sono
• Venha com energia positiva! 😊

Estamos ansiosos para te ver amanhã!

Dúvidas? Entre em contato: {{studioPhone}}`
      },
      dayOfReminder: {
        enabled: true,
        subject: '🎉 Hoje é o dia da sua sessão! - {{studioName}}',
        message: `Bom dia, {{clientName}}!

Hoje é o dia da sua sessão de fotos! Esperamos você no estúdio.

📅 SUA SESSÃO HOJE:
• Tipo: {{sessionType}}
• Horário: {{eventTime}}
• Local: {{studioAddress}}
• Contato: {{studioPhone}}

⚡ ÚLTIMAS DICAS:
• Chegue 10 minutos antes
• Traga suas referências
• Relaxe e divirta-se!

Nos vemos em breve! 📸✨`
      }
    }
  });
  
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
  const [watermarkPreview, setWatermarkPreview] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'studio' | 'watermark' | 'payment' | 'sessions' | 'emails'>('studio');
  
  // Estados para gerenciar tipos de sessão
  const [newSessionType, setNewSessionType] = useState({ value: '', label: '' });
  const [editingSessionType, setEditingSessionType] = useState<{ index: number; value: string; label: string } | null>(null);

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
          sessionTypes: photographer.watermark_config?.sessionTypes || [
            { value: 'gestante', label: 'Sessão Gestante' },
            { value: 'aniversario', label: 'Aniversário' },
            { value: 'comerciais', label: 'Comerciais' },
            { value: 'pre-wedding', label: 'Pré Wedding' },
            { value: 'formatura', label: 'Formatura' },
            { value: 'revelacao-sexo', label: 'Revelação de Sexo' },
          ],
          emailTemplates: photographer.watermark_config?.emailTemplates || {
            bookingConfirmation: {
              enabled: true,
              subject: '📸 Agendamento Confirmado - {{sessionType}} - {{studioName}}',
              message: `Olá {{clientName}}!\n\nObrigado por escolher nosso estúdio! Seu agendamento foi confirmado com sucesso.\n\n📅 DETALHES DA SESSÃO:\n• Tipo: {{sessionType}}\n• Data: {{eventDate}}\n• Horário: {{eventTime}}\n• Local: {{studioAddress}}\n\n📍 LOCALIZAÇÃO DO ESTÚDIO:\n{{studioName}}\n{{studioAddress}}\n📞 {{studioPhone}}\n🌐 {{studioWebsite}}\n\n📋 IMPORTANTE - LEIA COM ATENÇÃO:\n• Referências: Traga fotos de referência ou ideias que gostaria de reproduzir\n• Portfólio: As fotos poderão ser usadas em nosso portfólio e redes sociais. Caso não concorde, informe ao fotógrafo no dia da sessão\n• Pontualidade: Chegue 10 minutos antes do horário agendado\n• Seleção: Após a sessão, você receberá um link para selecionar suas fotos favoritas\n\nEstamos ansiosos para criar memórias incríveis com você!\n\nDúvidas? Entre em contato: {{studioPhone}} | {{studioEmail}}`
            },
            dayBeforeReminder: {
              enabled: true,
              subject: '⏰ Lembrete: Sua sessão é amanhã! - {{studioName}}',
              message: `Olá {{clientName}}!\n\nSua sessão de fotos está chegando! Amanhã será o grande dia.\n\n📅 DETALHES DA SESSÃO:\n• Tipo: {{sessionType}}\n• Data: {{eventDate}}\n• Horário: {{eventTime}}\n• Local: {{studioAddress}}\n\n✅ CHECKLIST PARA AMANHÃ:\n• Chegue 10 minutos antes do horário\n• Traga suas fotos de referência\n• Vista roupas confortáveis e adequadas ao tipo de sessão\n• Tenha uma boa noite de sono\n• Venha com energia positiva! 😊\n\nEstamos ansiosos para te ver amanhã!\n\nDúvidas? Entre em contato: {{studioPhone}}`
            },
            dayOfReminder: {
              enabled: true,
              subject: '🎉 Hoje é o dia da sua sessão! - {{studioName}}',
              message: `Bom dia, {{clientName}}!\n\nHoje é o dia da sua sessão de fotos! Esperamos você no estúdio.\n\n📅 SUA SESSÃO HOJE:\n• Tipo: {{sessionType}}\n• Horário: {{eventTime}}\n• Local: {{studioAddress}}\n• Contato: {{studioPhone}}\n\n⚡ ÚLTIMAS DICAS:\n• Chegue 10 minutos antes\n• Traga suas referências\n• Relaxe e divirta-se!\n\nNos vemos em breve! 📸✨`
            }
          }
        }));
        if (photographer.watermark_config?.watermarkFile) {
          setWatermarkPreview(photographer.watermark_config.watermarkFile);
        }
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

  // Funções para gerenciar tipos de sessão
  const addSessionType = () => {
    if (!newSessionType.value.trim() || !newSessionType.label.trim()) {
      toast.error('Preencha o código e o nome da sessão');
      return;
    }

    // Verificar se já existe
    if (settings.sessionTypes.some(type => type.value === newSessionType.value)) {
      toast.error('Já existe uma sessão com este código');
      return;
    }

    setSettings(prev => ({
      ...prev,
      sessionTypes: [...prev.sessionTypes, { ...newSessionType }]
    }));

    setNewSessionType({ value: '', label: '' });
    toast.success('Tipo de sessão adicionado!');
  };

  const removeSessionType = (index: number) => {
    if (settings.sessionTypes.length <= 1) {
      toast.error('Deve haver pelo menos um tipo de sessão');
      return;
    }

    setSettings(prev => ({
      ...prev,
      sessionTypes: prev.sessionTypes.filter((_, i) => i !== index)
    }));
    toast.success('Tipo de sessão removido!');
  };

  const startEditSessionType = (index: number) => {
    setEditingSessionType({
      index,
      value: settings.sessionTypes[index].value,
      label: settings.sessionTypes[index].label,
    });
  };

  const saveEditSessionType = () => {
    if (!editingSessionType) return;

    if (!editingSessionType.value.trim() || !editingSessionType.label.trim()) {
      toast.error('Preencha o código e o nome da sessão');
      return;
    }

    // Verificar se já existe (exceto o atual)
    if (settings.sessionTypes.some((type, i) => 
      type.value === editingSessionType.value && i !== editingSessionType.index
    )) {
      toast.error('Já existe uma sessão com este código');
      return;
    }

    setSettings(prev => ({
      ...prev,
      sessionTypes: prev.sessionTypes.map((type, i) => 
        i === editingSessionType.index 
          ? { value: editingSessionType.value, label: editingSessionType.label }
          : type
      )
    }));

    setEditingSessionType(null);
    toast.success('Tipo de sessão atualizado!');
  };

  const cancelEditSessionType = () => {
    setEditingSessionType(null);
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
            sessionTypes: settings.sessionTypes,
            emailTemplates: settings.emailTemplates,
          },
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error saving to database:', error);
        toast.error('Erro ao salvar configurações no banco de dados');
        return;
      }

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
        <p className="text-gray-600">Configure seu estúdio, marca d'água, tipos de sessão e formas de pagamento</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'studio', label: 'Dados do Estúdio', icon: Building },
            { key: 'sessions', label: 'Tipos de Sessão', icon: CreditCard },
            { key: 'watermark', label: 'Marca D\'água', icon: Eye },
            { key: 'payment', label: 'Pagamentos', icon: CreditCard },
            { key: 'emails', label: 'Templates de Email', icon: Mail },
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

            <div className="grid grid-cols-1 gap-6">
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
            </div>
          </div>
        )}

        {/* Tipos de Sessão */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Gerenciar Tipos de Sessão</h3>
            
            {/* Adicionar novo tipo */}
            <div className="bg-blue-50 rounded-lg p-6">
              <h4 className="font-medium text-blue-900 mb-4">Adicionar Novo Tipo de Sessão</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Código (interno)
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
                    Nome (exibido)
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
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de tipos existentes */}
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Tipos de Sessão Cadastrados</h4>
              <div className="space-y-3">
                {settings.sessionTypes.map((type, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    {editingSessionType?.index === index ? (
                      <div className="flex items-center gap-4 flex-1">
                        <input
                          type="text"
                          value={editingSessionType.value}
                          onChange={(e) => setEditingSessionType(prev => prev ? { ...prev, value: e.target.value } : null)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Código"
                        />
                        <input
                          type="text"
                          value={editingSessionType.label}
                          onChange={(e) => setEditingSessionType(prev => prev ? { ...prev, label: e.target.value } : null)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Nome"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={saveEditSessionType}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEditSessionType}
                            className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{type.label}</div>
                          <div className="text-sm text-gray-500">Código: {type.value}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditSessionType(index)}
                            className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeSessionType(index)}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
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
                    <span className="text-gray-600">Tipos de sessão:</span>
                    <span className="font-medium">{settings.sessionTypes.length} cadastrados</span>
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

        {/* Templates de Email */}
        {activeTab === 'emails' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Templates de Email Automáticos</h3>
            <p className="text-gray-600">Configure os emails que serão enviados automaticamente aos clientes</p>
            
            {/* Email de Confirmação */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-gray-900">📧 Email de Confirmação</h4>
                  <p className="text-sm text-gray-600">Enviado imediatamente após o agendamento ser confirmado</p>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.emailTemplates.bookingConfirmation.enabled}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      emailTemplates: {
                        ...prev.emailTemplates,
                        bookingConfirmation: {
                          ...prev.emailTemplates.bookingConfirmation,
                          enabled: e.target.checked
                        }
                      }
                    }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Ativo</span>
                </label>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assunto do Email
                  </label>
                  <input
                    type="text"
                    value={settings.emailTemplates.bookingConfirmation.subject}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      emailTemplates: {
                        ...prev.emailTemplates,
                        bookingConfirmation: {
                          ...prev.emailTemplates.bookingConfirmation,
                          subject: e.target.value
                        }
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Assunto do email..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mensagem do Email
                  </label>
                  <textarea
                    value={settings.emailTemplates.bookingConfirmation.message}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      emailTemplates: {
                        ...prev.emailTemplates,
                        bookingConfirmation: {
                          ...prev.emailTemplates.bookingConfirmation,
                          message: e.target.value
                        }
                      }
                    }))}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Mensagem do email..."
                  />
                </div>
              </div>
            </div>

            {/* Email de Lembrete 1 Dia Antes */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-gray-900">⏰ Lembrete 1 Dia Antes</h4>
                  <p className="text-sm text-gray-600">Enviado automaticamente 1 dia antes da sessão</p>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.emailTemplates.dayBeforeReminder.enabled}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      emailTemplates: {
                        ...prev.emailTemplates,
                        dayBeforeReminder: {
                          ...prev.emailTemplates.dayBeforeReminder,
                          enabled: e.target.checked
                        }
                      }
                    }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Ativo</span>
                </label>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assunto do Email
                  </label>
                  <input
                    type="text"
                    value={settings.emailTemplates.dayBeforeReminder.subject}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      emailTemplates: {
                        ...prev.emailTemplates,
                        dayBeforeReminder: {
                          ...prev.emailTemplates.dayBeforeReminder,
                          subject: e.target.value
                        }
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Assunto do email..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mensagem do Email
                  </label>
                  <textarea
                    value={settings.emailTemplates.dayBeforeReminder.message}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      emailTemplates: {
                        ...prev.emailTemplates,
                        dayBeforeReminder: {
                          ...prev.emailTemplates.dayBeforeReminder,
                          message: e.target.value
                        }
                      }
                    }))}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Mensagem do email..."
                  />
                </div>
              </div>
            </div>

            {/* Email do Dia da Sessão */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-gray-900">🎉 Lembrete do Dia</h4>
                  <p className="text-sm text-gray-600">Enviado pela manhã no dia da sessão (8h-10h)</p>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.emailTemplates.dayOfReminder.enabled}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      emailTemplates: {
                        ...prev.emailTemplates,
                        dayOfReminder: {
                          ...prev.emailTemplates.dayOfReminder,
                          enabled: e.target.checked
                        }
                      }
                    }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Ativo</span>
                </label>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assunto do Email
                  </label>
                  <input
                    type="text"
                    value={settings.emailTemplates.dayOfReminder.subject}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      emailTemplates: {
                        ...prev.emailTemplates,
                        dayOfReminder: {
                          ...prev.emailTemplates.dayOfReminder,
                          subject: e.target.value
                        }
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Assunto do email..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mensagem do Email
                  </label>
                  <textarea
                    value={settings.emailTemplates.dayOfReminder.message}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      emailTemplates: {
                        ...prev.emailTemplates,
                        dayOfReminder: {
                          ...prev.emailTemplates.dayOfReminder,
                          message: e.target.value
                        }
                      }
                    }))}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Mensagem do email..."
                  />
                </div>
              </div>
            </div>

            {/* Variáveis Disponíveis */}
            <div className="bg-blue-50 rounded-lg p-6">
              <h4 className="font-semibold text-blue-900 mb-3">📝 Variáveis Disponíveis</h4>
              <p className="text-sm text-blue-800 mb-3">
                Use essas variáveis nos seus templates. Elas serão substituídas automaticamente:
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p><code className="bg-blue-100 px-2 py-1 rounded">{`{{clientName}}`}</code> - Nome do cliente</p>
                  <p><code className="bg-blue-100 px-2 py-1 rounded">{`{{sessionType}}`}</code> - Tipo da sessão</p>
                  <p><code className="bg-blue-100 px-2 py-1 rounded">{`{{eventDate}}`}</code> - Data da sessão</p>
                  <p><code className="bg-blue-100 px-2 py-1 rounded">{`{{eventTime}}`}</code> - Horário da sessão</p>
                  <p><code className="bg-blue-100 px-2 py-1 rounded">{`{{studioName}}`}</code> - Nome do estúdio</p>
                  <p><code className="bg-blue-100 px-2 py-1 rounded">{`{{studioAddress}}`}</code> - Endereço do estúdio</p>
                </div>
                <div>
                  <p><code className="bg-blue-100 px-2 py-1 rounded">{`{{studioPhone}}`}</code> - Telefone do estúdio</p>
                  <p><code className="bg-blue-100 px-2 py-1 rounded">{`{{studioEmail}}`}</code> - Email do estúdio</p>
                  <p><code className="bg-blue-100 px-2 py-1 rounded">{`{{studioWebsite}}`}</code> - Website do estúdio</p>
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