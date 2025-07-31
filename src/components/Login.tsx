import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Mail, Lock, Eye, EyeOff, UserPlus, MessageCircle, Chrome, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [backgroundImages, setBackgroundImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [studioLogo, setStudioLogo] = useState<string>('');
  const [studioName, setStudioName] = useState('Triagem');
  const { login, register, isLoading, resetPassword } = useAuth();

  // Carregar configurações do estúdio
  useEffect(() => {
    loadStudioSettings();
  }, []);

  // Rotacionar imagens de fundo a cada 5 segundos
  useEffect(() => {
    if (backgroundImages.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % backgroundImages.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [backgroundImages.length]);

  const loadStudioSettings = async () => {
    try {
      console.log('🔍 Loading studio settings for login background...');
      
      // Buscar configurações do primeiro fotógrafo com imagens personalizadas
      const { data: photographer, error } = await supabase
        .from('photographers')
        .select('business_name, watermark_config')
        .not('watermark_config', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error loading photographers:', error);
        setBackgroundImages([
          'https://images.pexels.com/photos/1264210/pexels-photo-1264210.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop'
        ]);
        return;
      }

      console.log('📊 Photographers found:', photographer?.length || 0);

      // Buscar o primeiro fotógrafo que tenha configurações personalizadas
      let selectedPhotographer = null;
      
      if (photographer && photographer.length > 0) {
        console.log('🔍 Checking each photographer for custom backgrounds...');
        
        // Verificar cada fotógrafo
        for (const p of photographer) {
          console.log('📋 Checking photographer:', {
            business_name: p.business_name,
            has_watermark_config: !!p.watermark_config,
            has_login_backgrounds: !!p.watermark_config?.loginBackgrounds,
            backgrounds_count: p.watermark_config?.loginBackgrounds?.length || 0
          });
          
          if (p.watermark_config?.loginBackgrounds && 
              Array.isArray(p.watermark_config.loginBackgrounds) && 
              p.watermark_config.loginBackgrounds.length > 0) {
            selectedPhotographer = p;
            console.log('✅ Found photographer with custom backgrounds!');
            break;
          }
        }
        
        console.log('🎯 Selected photographer result:', selectedPhotographer ? 'Found with backgrounds' : 'Not found');
        
        // Se não encontrou com imagens personalizadas, usar o primeiro
        if (!selectedPhotographer) {
          console.log('📋 Using first photographer as fallback');
          selectedPhotographer = photographer[0];
        }
        
        console.log('🎯 Final selected photographer:', {
          business_name: selectedPhotographer?.business_name,
          has_watermark_config: !!selectedPhotographer?.watermark_config,
          has_backgrounds: !!(selectedPhotographer?.watermark_config?.loginBackgrounds?.length > 0)
        });
        
        // Logo personalizada
        if (selectedPhotographer.watermark_config?.logo) {
          console.log('🖼️ Setting studio logo');
          setStudioLogo(selectedPhotographer.watermark_config.logo);
        }

        // Nome do estúdio
        if (selectedPhotographer.business_name) {
          console.log('🏢 Setting studio name:', selectedPhotographer.business_name);
          setStudioName(selectedPhotographer.business_name);
        }

        // Imagens de fundo personalizadas
        const customBackgrounds = selectedPhotographer.watermark_config?.loginBackgrounds;
        console.log('🎨 Processing custom backgrounds...');
        console.log('🎨 Raw backgrounds data:', customBackgrounds);
        
        if (customBackgrounds && 
            Array.isArray(customBackgrounds) && 
            customBackgrounds.length > 0) {
          console.log('✅ Setting custom background images:', customBackgrounds.length);
          console.log('🖼️ First image preview:', customBackgrounds[0]?.substring(0, 50) + '...');
          setBackgroundImages(customBackgrounds);
          
          // Verificar se foi aplicado
          console.log('🔄 Background images applied to state');
        } else {
          console.log('⚠️ No valid custom backgrounds, using defaults');
          // Imagens padrão de alta qualidade para estúdios fotográficos
          setBackgroundImages([
            'https://images.pexels.com/photos/1264210/pexels-photo-1264210.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop'
          ]);
        }
      } else {
        console.log('❌ No photographers found, using defaults');
        // Configurações padrão se não houver fotógrafo
        setBackgroundImages([
          'https://images.pexels.com/photos/1264210/pexels-photo-1264210.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop'
        ]);
      }
      
    } catch (error) {
      console.error('Error loading studio settings:', error);
      // Usar imagens padrão em caso de erro
      setBackgroundImages([
        'https://images.pexels.com/photos/1264210/pexels-photo-1264210.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop'
      ]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setRegisterError('');
    
    if (!email || !password || (isRegisterMode && !name)) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (isRegisterMode) {
      if (!whatsapp.trim()) {
        setRegisterError('WhatsApp é obrigatório');
        toast.error('WhatsApp é obrigatório');
        return;
      }
      if (whatsapp.replace(/\D/g, '').length < 10) {
        setRegisterError('WhatsApp deve ter pelo menos 10 dígitos');
        toast.error('WhatsApp deve ter pelo menos 10 dígitos');
        return;
      }
      
      const phoneRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
      if (!phoneRegex.test(whatsapp) && whatsapp.replace(/\D/g, '').length < 10) {
        setRegisterError('Formato de WhatsApp inválido. Use: (11) 99999-9999');
        toast.error('Formato de WhatsApp inválido. Use: (11) 99999-9999');
        return;
      }
      
      if (password.length < 6) {
        setRegisterError('A senha deve ter pelo menos 6 caracteres');
        toast.error('A senha deve ter pelo menos 6 caracteres');
        return;
      }
      if (name.length < 2) {
        setRegisterError('O nome deve ter pelo menos 2 caracteres');
        toast.error('O nome deve ter pelo menos 2 caracteres');
        return;
      }
    }

    const loadingToast = toast.loading(
      isRegisterMode ? 'Criando sua conta...' : 'Fazendo login...'
    );
    const result = isRegisterMode 
      ? await register(email, password, name, whatsapp)
      : await login(email, password);
      
    toast.dismiss(loadingToast);

    if (result === true) {
      if (isRegisterMode) {
        setRegistrationSuccess(true);
        setRegisteredEmail(email);
        toast.success('🎉 Conta criada com sucesso!');
      } else {
        toast.success('Login realizado com sucesso!');
      }
    } else {
      if (isRegisterMode) {
        setRegisterError(result);
        toast.error(`❌ Erro no cadastro: ${result}`);
      } else {
        setLoginError(result);
        toast.error(`❌ ${result}`);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        if (error.message === 'Email logins are disabled') {
          setLoginError('Cadastro por e-mail está desabilitado. Entre em contato com o administrador ou use o cadastro com Google.');
          return;
        }
        console.error('Google OAuth error:', error);
        toast.error(`Erro no login com Google: ${error.message}`);
        return;
      }

      toast.success('Redirecionando para Google...');
    } catch (error) {
      console.error('Google login error:', error);
      toast.error('Erro ao conectar com Google');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setRegistrationSuccess(false);
    setRegisteredEmail('');
    setEmail('');
    setPassword('');
    setName('');
    setWhatsapp('');
    setRegisterError('');
    setIsRegisterMode(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast.error('Digite seu e-mail para recuperar a senha');
      return;
    }

    const loadingToast = toast.loading('Enviando e-mail de recuperação...');
    const result = await resetPassword(resetEmail);
    toast.dismiss(loadingToast);

    if (result === true) {
      toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      setShowForgotPassword(false);
      setResetEmail('');
    } else {
      toast.error(`Erro: ${result}`);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Images with Slideshow */}
      <div className="absolute inset-0">
        {backgroundImages.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentImageIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={image}
              alt={`Background ${index + 1}`}
              className="w-full h-full object-cover"
              loading={index === 0 ? 'eager' : 'lazy'}
              onError={(e) => {
                console.error('❌ Failed to load background image:', image.substring(0, 100) + '...');
                // Fallback para imagem padrão se falhar
                e.currentTarget.src = 'https://images.pexels.com/photos/1264210/pexels-photo-1264210.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop';
              }}
              onLoad={() => {
                console.log('✅ Background image loaded successfully:', index);
              }}
            />
            {/* Efeito de linhas geométricas */}
            {/* Overlay simples para legibilidade */}
            <div className="absolute inset-0 bg-black/40"></div>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Logo and Branding */}
          <div className="text-center mb-8">
            {studioLogo ? (
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full mb-6 p-4">
                <img 
                  src={studioLogo} 
                  alt="Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full mb-6">
                <Camera className="w-10 h-10 text-white" />
              </div>
            )}
            
            <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
              Triagem
            </h1>
            <p className="text-white/90 text-lg mb-2 drop-shadow">
              Sistema de seleção de fotos para estúdio fotográfico
            </p>
            <p className="text-white/70 text-sm drop-shadow">
              by Valdigley Santos
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
            {/* Tela de Sucesso do Cadastro */}
            {registrationSuccess ? (
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    🎉 Cadastro Realizado com Sucesso!
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Sua conta foi criada e você já pode fazer login no sistema.
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-green-900 mb-4">
                    ✅ Próximos Passos
                  </h3>
                  <div className="text-left space-y-3 text-green-800">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">1</div>
                      <div>
                        <p className="font-medium">Faça seu primeiro login</p>
                        <p className="text-sm text-green-700">Use o e-mail: <strong>{registeredEmail}</strong></p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">2</div>
                      <div>
                        <p className="font-medium">Configure seu estúdio</p>
                        <p className="text-sm text-green-700">Adicione logo, preços e informações de contato</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">3</div>
                      <div>
                        <p className="font-medium">Comece a usar</p>
                        <p className="text-sm text-green-700">Crie agendamentos e compartilhe fotos com clientes</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">🎁 Período de Teste</h4>
                  <p className="text-sm text-blue-800">
                    Você tem <strong>7 dias gratuitos</strong> para testar todas as funcionalidades do sistema.
                    Após o período, assine por apenas <strong>R$ 30,00/mês</strong>.
                  </p>
                </div>

                <button
                  onClick={handleBackToLogin}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium"
                >
                  Fazer Login Agora
                </button>

                <p className="text-xs text-gray-500">
                  Precisa de ajuda? Entre em contato pelo WhatsApp
                </p>
              </div>
            ) : (
            showForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Recuperar Senha</h2>
                  <p className="text-gray-600 mt-2">Digite seu e-mail para receber as instruções</p>
                </div>

                <div>
                  <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700 mb-2">
                    E-mail para recuperação
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      id="resetEmail"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="seu@email.com"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isLoading ? 'Enviando...' : 'Enviar E-mail de Recuperação'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="w-full text-gray-600 hover:text-gray-800 text-sm font-medium"
                  disabled={isLoading}
                >
                  Voltar ao login
                </button>
              </form>
            ) : (
              <div>
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {isRegisterMode ? 'Criar Conta' : 'Entrar'}
                  </h2>
                  <p className="text-gray-600 mt-2">
                    {isRegisterMode ? 'Crie sua conta para começar' : 'Acesse sua conta'}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {isRegisterMode && (
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                        Nome Completo
                      </label>
                      <div className="relative">
                        <UserPlus className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                          id="name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="Seu nome completo"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  )}

                  {/* Erro de cadastro */}
                  {registerError && isRegisterMode && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">
                            Erro no Cadastro
                          </h3>
                          <div className="mt-2 text-sm text-red-700">
                            <p>{registerError}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Erro de login */}
                  {loginError && !isRegisterMode && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">
                            Erro no Login
                          </h3>
                          <div className="mt-2 text-sm text-red-700">
                            <p>{loginError}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      E-mail
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="seu@email.com"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {isRegisterMode && (
                    <div>
                      <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700 mb-2">
                        WhatsApp *
                      </label>
                      <div className="relative">
                        <MessageCircle className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                          id="whatsapp"
                          type="tel"
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="(11) 99999-9999"
                          disabled={isLoading}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Necessário para suporte e comunicação sobre sua conta
                      </p>
                    </div>
                  )}

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                      Senha
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="••••••••"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        disabled={isLoading}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {isLoading 
                      ? (isRegisterMode ? 'Criando conta...' : 'Entrando...') 
                      : (isRegisterMode ? 'Criar Conta' : 'Entrar')
                    }
                  </button>
                </form>

                {!showForgotPassword && (
                  <div className="mt-6 space-y-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegisterMode(!isRegisterMode);
                        setLoginError('');
                        setRegisterError('');
                      }}
                      className="w-full text-blue-600 hover:text-blue-700 text-sm font-medium"
                      disabled={isLoading}
                    >
                      {isRegisterMode 
                        ? 'Já tem uma conta? Fazer login' 
                        : 'Não tem conta? Criar uma nova'
                      }
                    </button>

                    {/* Divider */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">ou</span>
                      </div>
                    </div>

                    {/* Google Login Button */}
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isLoading || isGoogleLoading}
                      className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-gray-700 bg-white"
                    >
                      {isGoogleLoading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
                      ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      )}
                      {isGoogleLoading ? 'Conectando...' : `${isRegisterMode ? 'Cadastrar' : 'Entrar'} com Google`}
                    </button>

                    {!isRegisterMode && (
                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setShowForgotPassword(true);
                            setLoginError('');
                          }}
                          className="text-gray-500 hover:text-gray-700 text-sm"
                          disabled={isLoading}
                        >
                          Esqueceu sua senha?
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Image indicators */}
          {backgroundImages.length > 1 && (
            <div className="flex justify-center mt-6 space-x-2">
              {backgroundImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentImageIndex 
                      ? 'bg-white scale-125' 
                      : 'bg-white/50 hover:bg-white/75'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;