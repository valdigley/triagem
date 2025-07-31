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
  register: (email: string, password: string, name: string) => Promise<string | true>;
  logout: () => void;
  isLoading: boolean;
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
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setSupabaseUser(session.user);
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário',
          email: session.user.email || '',
          role: 'photographer',
        });
      }
      setIsLoading(false);
    };

    getSession();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
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
        if (error.message.includes('Invalid login credentials')) {
          return 'E-mail ou senha incorretos';
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
      setIsLoading(false);
      return 'Erro inesperado ao fazer login';
    }
  };

  const register = async (email: string, password: string, name: string): Promise<string | true> => {
    setIsLoading(true);
    
    try {
      console.log('Attempting to register new studio:', { email, name });
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            full_name: name,
          },
          emailRedirectTo: undefined, // Disable email confirmation for development
        },
      });

      if (error) {
        console.error('Registration error:', error);
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
        
        return error.message || 'Erro ao criar conta';
      }

      console.log('Registration successful:', data);
      
      // Criar assinatura trial automaticamente para novos usuários
      if (data.user) {
        try {
          console.log('Creating trial subscription for new user...');
          
          const { error: subscriptionError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: data.user.id,
              plan_type: 'trial',
              status: 'active',
              trial_start_date: new Date().toISOString(),
              trial_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias
            });

          if (subscriptionError) {
            console.error('Error creating trial subscription:', subscriptionError);
            // Não falhar o registro se a assinatura der erro
          } else {
            console.log('Trial subscription created successfully');
          }
        } catch (subscriptionError) {
          console.error('Exception creating trial subscription:', subscriptionError);
          // Não falhar o registro se a assinatura der erro
        }
      }
      
      // Se o usuário foi criado mas não confirmado, ainda assim considerar sucesso
      if (data.user && !data.user.email_confirmed_at) {
        console.log('User created but email not confirmed - this is expected in development');
      }
      
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Registration exception:', error);
      setIsLoading(false);
      return 'Erro inesperado ao criar conta';
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSupabaseUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, supabaseUser, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};