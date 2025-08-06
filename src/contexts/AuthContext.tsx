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
    // Get initial session
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.warn('Session error:', error.message);
          await supabase.auth.signOut();
        } else if (session?.user) {
          await setupUserProfile(session.user);
        }
      } catch (error) {
        console.warn('Session exception:', error);
        await supabase.auth.signOut();
      }
      setIsLoading(false);
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event);
        
        if (event === 'SIGNED_OUT' || !session) {
          setSupabaseUser(null);
          setUser(null);
          setIsLoading(false);
          return;
        }
        
        if (session?.user) {
          await setupUserProfile(session.user);
        }
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const setupUserProfile = async (authUser: SupabaseUser) => {
    try {
      setSupabaseUser(authUser);
      setUser({
        id: authUser.id,
        name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuário',
        email: authUser.email || '',
        role: 'photographer',
      });

      // Create user record if it doesn't exist
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuário',
          role: 'photographer',
        })
        .select()
        .single();

      if (userError && userError.code !== '23505') {
        console.error('Error creating user record:', userError);
      }

      // Create photographer profile if it doesn't exist
      const { error: photographerError } = await supabase
        .from('photographers')
        .insert({
          user_id: authUser.id,
          business_name: `Estúdio ${authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Fotográfico'}`,
          phone: '(11) 99999-9999',
          settings: {
            photoPrice: 25.00,
            packagePhotos: 10,
            sessionTypes: [
              { value: 'gestante', label: 'Sessão Gestante' },
              { value: 'aniversario', label: 'Aniversário' },
              { value: 'comerciais', label: 'Comerciais' },
              { value: 'pre-wedding', label: 'Pré Wedding' },
              { value: 'formatura', label: 'Formatura' },
              { value: 'revelacao-sexo', label: 'Revelação de Sexo' },
            ]
          }
        })
        .select()
        .single();

      if (photographerError && photographerError.code !== '23505') {
        console.error('Error creating photographer profile:', photographerError);
      }

    } catch (error) {
      console.error('Error setting up user profile:', error);
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
        return error.message || 'Erro ao fazer login';
      }

      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
      return 'Erro de conexão. Tente novamente.';
    }
  };

  const register = async (email: string, password: string, name: string, whatsapp: string): Promise<string | true> => {
    setIsLoading(true);
    
    try {
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
        setIsLoading(false);
        return error.message || 'Erro ao criar conta';
      }

      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      setIsLoading(false);
      return 'Erro de conexão. Tente novamente.';
    }
  };

  const logout = async () => {
    setIsLoading(true);
    setUser(null);
    setSupabaseUser(null);
    
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Logout error:', error);
    }
    
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, supabaseUser, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};