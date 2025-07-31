import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Mail, Lock, Eye, EyeOff, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isCreatingDefaultUser, setIsCreatingDefaultUser] = useState(false);
  const { login, register, isLoading } = useAuth();

  // Criar usuário padrão para desenvolvimento
  const createDefaultUser = async () => {
    setIsCreatingDefaultUser(true);
    try {
      const result = await register('admin@triagem.com', '123456', 'Administrador');
      if (result === true) {
        toast.success('Usuário padrão criado! Fazendo login...');
        // Fazer login automaticamente
        setTimeout(async () => {
          const loginResult = await login('admin@triagem.com', '123456');
          if (loginResult === true) {
            toast.success('Login realizado com sucesso!');
          } else {
            toast.error('Erro no login automático. Tente fazer login manualmente.');
          }
        }, 1000);
      } else {
        toast.error(result);
      }
    } catch (error) {
      toast.error('Erro ao criar usuário padrão');
    } finally {
      setIsCreatingDefaultUser(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || (isRegisterMode && !name)) {
      toast.error('Preencha todos os campos');
      return;
    }

    const result = isRegisterMode 
      ? await register(email, password, name)
      : await login(email, password);
      
    if (result === true) {
      if (isRegisterMode) {
        toast.success('Conta criada com sucesso! Verifique seu e-mail.');
      } else {
        toast.success('Login realizado com sucesso!');
      }
    } else {
      toast.error(result);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Camera className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">PhotoSelect</h1>
          <h1 className="text-2xl font-bold text-gray-900">Triagem</h1>
          <p className="text-gray-600 mt-2">
            {isRegisterMode ? 'Criar nova conta' : 'by Valdigley Santos'}
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

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsRegisterMode(!isRegisterMode)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            disabled={isLoading}
          >
            {isRegisterMode 
              ? 'Já tem uma conta? Fazer login' 
              : 'Não tem conta? Criar uma nova'
            }
          </button>
        </div>

        {/* Botão para criar usuário padrão */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={createDefaultUser}
            disabled={isLoading || isCreatingDefaultUser}
            className="text-gray-500 hover:text-gray-700 text-xs font-medium disabled:opacity-50"
          >
            {isCreatingDefaultUser ? 'Criando usuário padrão...' : 'Criar usuário padrão (admin@triagem.com)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;