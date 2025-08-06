import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

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
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
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
        }
      } catch (error) {
        console.error('Auth init error:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT' || !session?.user) {
          setUser(null);
          setSupabaseUser(null);
        } else if (session?.user) {
          setSupabaseUser(session.user);
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário',
            email: session.user.email || '',
            role: 'photographer',
          });
        }
      }
    );

    return () => {
      mounted = false;
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
        return 'Erro ao fazer login: ' + error.message;
      }

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
        return 'Erro ao criar conta: ' + error.message;
      }

      if (data.user) {
        // Create basic user profile
        try {
          await supabase.from('users').insert({
            id: data.user.id,
            email: data.user.email,
            name: name,
            role: 'photographer',
          });

          await supabase.from('photographers').insert({
            user_id: data.user.id,
            business_name: `Estúdio ${name}`,
            phone: whatsapp || '(11) 99999-9999',
          });
        } catch (profileError) {
          console.warn('Profile creation error:', profileError);
        }
      }

      return true;
    } catch (error) {
      console.error('Registration error:', error);
      setIsLoading(false);
      return 'Erro de conexão. Tente novamente.';
    }
  };

  const logout = async () => {
    setUser(null);
    setSupabaseUser(null);
    
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, supabaseUser, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};