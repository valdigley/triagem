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
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          // Clear invalid tokens and reset auth state
          await supabase.auth.signOut();
          setSupabaseUser(null);
          setUser(null);
        } else if (session?.user) {
          setSupabaseUser(session.user);
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário',
            email: session.user.email || '',
            role: 'photographer',
          });
        }
      } catch (error) {
        console.error('Unexpected session error:', error);
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
          emailRedirectTo: undefined,
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
        if (error.message.includes('Email rate limit exceeded')) {
          return 'Muitas tentativas de cadastro. Aguarde alguns minutos';
        }
        
        return error.message || 'Erro ao criar conta';
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
        
        // Se email confirmation está desabilitado, o usuário já pode fazer login
        if (data.user.email_confirmed_at || !data.user.email_confirmed_at) {
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