import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'photographer' | 'client';
}

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  login: (email: string, password: string) => Promise<string | true>;
  register: (email: string, password: string, name: string, whatsapp: string) => Promise<string | true>;
  logout: () => void;
  isLoading: boolean;
  resetPassword: (email: string) => Promise<string | true>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar sessão atual
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error.message);
          // Clear invalid tokens and reset auth state
          await supabase.auth.signOut();
          setSupabaseUser(null);
          setUser(null);
        } else if (session?.user) {
          console.log('Session user found:', session.user.email);
          
          // Para usuários do Google OAuth, criar perfil automaticamente se necessário
          if (session.user.app_metadata?.provider === 'google') {
            await handleGoogleUserSetup(session.user);
          }
          
          setSupabaseUser(session.user);
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário',
            email: session.user.email || '',
            role: 'photographer',
          });
        }
      } catch (error) {
        console.error('Unexpected session error:', error instanceof Error ? error.message : 'Unknown error');
        // Clear invalid tokens and reset auth state
        await supabase.auth.signOut();
        setSupabaseUser(null);
        setUser(null);
      }
      setIsLoading(false);
    };

    getSession();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        
        if (session?.user) {
          // Para usuários do Google OAuth, criar perfil automaticamente
          if (session.user.app_metadata?.provider === 'google') {
            await handleGoogleUserSetup(session.user);
          }
          
          setSupabaseUser(session.user);
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário',
            email: session.user.email || '',
            role: 'photographer',
          });
        } else {
          setSupabaseUser(null);
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Função para configurar usuário do Google OAuth
  const handleGoogleUserSetup = async (user: any) => {
    try {
      console.log('Setting up Google OAuth user:', user.email);
      
      // Verificar se já existe registro na tabela users
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!existingUser) {
        console.log('Creating user record for Google OAuth user');
        
        // Criar registro na tabela users
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
            role: 'photographer',
            avatar: user.user_metadata?.avatar_url,
          });

        if (userError) {
          console.error('Error creating user record:', userError);
        } else {
          console.log('User record created successfully');
        }
      }

      // Verificar se já existe perfil de fotógrafo
      const { data: existingPhotographer } = await supabase
        .from('photographers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingPhotographer) {
        console.log('Creating photographer profile for Google OAuth user');
        
        // Criar perfil de fotógrafo
        const { error: photographerError } = await supabase
          .from('photographers')
          .insert({
            user_id: user.id,
            business_name: `Estúdio ${user.user_metadata?.name || user.email?.split('@')[0] || 'Fotográfico'}`,
            phone: '(11) 99999-9999', // Placeholder - usuário pode atualizar depois
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
              emailTemplates: {
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
              }
            }
          });

        if (photographerError) {
          console.error('Error creating photographer profile:', photographerError);
        } else {
          console.log('Photographer profile created successfully');
        }
      }

      // Verificar se já existe subscription
      const { data: existingSubscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingSubscription) {
        console.log('Creating subscription for Google OAuth user');
        
        // Criar subscription de teste
        const { data, error: subscriptionError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: user.id,
            plan_type: 'trial',
            status: 'active',
            trial_start_date: new Date().toISOString(),
            trial_end_date: new Date().toISOString(), // Expira imediatamente
            expires_at: new Date().toISOString(), // Expira imediatamente
          })
          .select()
          .single();

        if (subscriptionError) {
          console.error('Error creating subscription:', subscriptionError);
        } else {
          console.log('Subscription created successfully');

          // Forçar atualização para 0 dias de teste (sobrescrever trigger)
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              trial_end_date: new Date().toISOString(),
              expires_at: new Date().toISOString(),
            })
            .eq('id', data.id);

          if (updateError) {
            console.error('Error forcing zero trial days:', updateError);
          } else {
            console.log('Forced zero trial days successfully');
          }
        }
      }

    } catch (error) {
      console.error('Error setting up Google OAuth user:', error);
    }
  };

  const login = async (email: string, password: string): Promise<string | true> => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setIsLoading(false);
        
        // Retornar mensagens específicas baseadas no tipo de erro
        if (error.code === 'invalid_credentials') {
          return 'E-mail não cadastrado ou senha incorreta. Verifique seus dados ou crie uma nova conta.';
        }
        if (error.message.includes('Email not confirmed')) {
          return 'E-mail não confirmado. Verifique sua caixa de entrada';
        }
        if (error.message.includes('Too many requests')) {
          return 'Muitas tentativas. Tente novamente em alguns minutos';
        }
        
        return error.message || 'Erro ao fazer login';
      }

      // O usuário será definido automaticamente pelo listener onAuthStateChange
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
      return 'Erro de conexão. Verifique sua internet e tente novamente.';
    }
  };

  const register = async (email: string, password: string, name: string, whatsapp: string): Promise<string | true> => {
    setIsLoading(true);
    
    try {
      console.log('Attempting to register new studio:', { email, name, whatsapp });
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            full_name: name,
            whatsapp,
          },
        },
      });

      if (error) {
        console.error('Registration error:', error.message);
        setIsLoading(false);
        
        // Retornar mensagens específicas baseadas no tipo de erro
        if (error.message.includes('User already registered')) {
          return 'Este e-mail já está cadastrado';
        }
        if (error.message.includes('Password should be at least')) {
          return 'A senha deve ter pelo menos 6 caracteres';
        }
        if (error.message.includes('Invalid email')) {
          return 'E-mail inválido';
        }
        if (error.message.includes('Signup is disabled')) {
          return 'Cadastro desabilitado. Entre em contato com o administrador';
        }
        if (error.message.includes('Email rate limit exceeded')) {
          return 'Muitas tentativas de cadastro. Aguarde alguns minutos';
        }
        if (error.message.includes('Database error')) {
          return 'Erro no banco de dados. Tente novamente em alguns minutos';
        }
        if (error.message.includes('Network error') || error.message.includes('fetch')) {
          return 'Erro de conexão. Verifique sua internet e tente novamente';
        }
        if (error.message.includes('Email not confirmed')) {
          return 'Verifique seu e-mail para confirmar a conta antes de fazer login';
        }
        if (error.message.includes('Unable to validate email address')) {
          return 'E-mail inválido. Verifique se digitou corretamente';
        }
        if (error.message.includes('Password is too weak')) {
          return 'Senha muito fraca. Use pelo menos 6 caracteres com letras e números';
        }
        
        return `Erro no cadastro: ${error.message}`;
      }

      console.log('Registration successful:', {
        userId: data.user?.id,
        email: data.user?.email,
        emailConfirmed: data.user?.email_confirmed_at,
        needsConfirmation: !data.user?.email_confirmed_at
      });
      
      // Verificar se o usuário foi criado com sucesso
      if (data.user) {
        console.log('✅ Usuário criado com sucesso!');
        
        // Verificar se precisa confirmar email
        if (!data.user.email_confirmed_at && data.session === null) {
          console.log('⚠️ Usuário precisa confirmar e-mail');
          setIsLoading(false);
          return 'Conta criada! Verifique seu e-mail para confirmar antes de fazer login.';
        } else {
          console.log('✅ Usuário pode fazer login imediatamente');
        }
      } else {
        console.error('❌ Usuário não foi criado');
        setIsLoading(false);
        return 'Erro: usuário não foi criado no sistema';
      }
      
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Registration exception:', error instanceof Error ? error.message : 'Unknown error');
      setIsLoading(false);
      return `Erro inesperado ao criar conta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
    }
  };

  const resetPassword = async (email: string): Promise<string | true> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error('Password reset error:', error.message);
        
        if (error.message.includes('Email rate limit exceeded')) {
          return 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente';
        }
        if (error.message.includes('Invalid email')) {
          return 'E-mail inválido';
        }
        
        return error.message || 'Erro ao enviar e-mail de recuperação';
      }

      return true;
    } catch (error) {
      console.error('Password reset exception:', error instanceof Error ? error.message : 'Unknown error');
      return 'Erro inesperado ao enviar e-mail de recuperação';
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSupabaseUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, supabaseUser, login, register, logout, isLoading, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};