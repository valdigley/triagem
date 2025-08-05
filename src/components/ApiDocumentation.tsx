import React, { useState, useEffect } from 'react';
import { Code, Copy, Key, Server, Database, Upload, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const ApiDocumentation: React.FC = () => {
  const { user } = useAuth();
  const [apiAccessId, setApiAccessId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadApiConfig();
    }
  }, [user]);

  const loadApiConfig = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('api_access')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading API config:', error);
        return;
      }

      if (data) {
        setApiAccessId(data.id);
        setApiKey(data.api_key);
        setWebhookUrl(data.webhook_url || '');
      }
    } catch (error) {
      console.error('Error loading API config:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNewApiKey = async () => {
    if (!user) return;

    try {
      const newApiKey = `tk_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
      
      const upsertData: any = {
        user_id: user.id,
        api_key: newApiKey,
        webhook_url: webhookUrl,
      };

      if (apiAccessId) {
        upsertData.id = apiAccessId;
      }

      const { data, error } = await supabase
        .from('api_access')
        .upsert(upsertData)
        .select()
        .single();

      if (error) {
        console.error('Error generating API key:', error);
        toast.error('Erro ao gerar nova chave');
        return;
      }

      if (data && !apiAccessId) {
        setApiAccessId(data.id);
      }

      setApiKey(newApiKey);
      toast.success('Nova chave API gerada!');
    } catch (error) {
      console.error('Error generating API key:', error);
      toast.error('Erro ao gerar nova chave');
    }
  };

  const saveConfig = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const upsertData: any = {
        user_id: user.id,
        api_key: apiKey,
        webhook_url: webhookUrl,
      };

      if (apiAccessId) {
        upsertData.id = apiAccessId;
      }

      const { data, error } = await supabase
        .from('api_access')
        .upsert(upsertData)
        .select()
        .single();

      if (error) {
        console.error('Error saving config:', error);
        toast.error('Erro ao salvar configurações');
        return;
      }

      if (data && !apiAccessId) {
        setApiAccessId(data.id);
      }

      toast.success('Configurações salvas!');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API e Integrações</h1>
        <p className="text-gray-600">Configure integrações externas e acesso FTP</p>
      </div>

      {/* API Configuration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Configuração da API</h3>
          <button
            onClick={generateNewApiKey}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Gerar Nova Chave
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chave da API
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={apiKey}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
              />
              <button
                onClick={() => copyToClipboard(apiKey, 'Chave da API')}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Use esta chave para autenticar suas requisições à API
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL do Webhook (n8n)
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://seu-n8n.com/webhook/triagem"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL para receber notificações de eventos (agendamentos, pagamentos, etc.)
            </p>
          </div>
        </div>
      </div>

      {/* API Documentation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Documentação da API</h3>
        
        <div className="space-y-6">
          {/* Base URL */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Base URL</h4>
            <div className="bg-gray-50 p-3 rounded-lg font-mono text-sm">
              {window.location.origin}/api/v1
            </div>
          </div>

          {/* Authentication */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Autenticação</h4>
            <p className="text-sm text-gray-600 mb-3">
              Inclua sua chave API no header de todas as requisições:
            </p>
            <div className="bg-gray-50 p-3 rounded-lg">
              <code className="text-sm">
                Authorization: Bearer {apiKey || 'SUA_CHAVE_API'}
              </code>
              <button
                onClick={() => copyToClipboard(`Authorization: Bearer ${apiKey}`, 'Header de autenticação')}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                <Copy className="w-4 h-4 inline" />
              </button>
            </div>
          </div>

          {/* Endpoints */}
          <div>
            <h4 className="font-medium text-gray-900 mb-4">Endpoints Disponíveis</h4>
            
            <div className="space-y-4">
              {/* Eventos */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-2">📅 Eventos</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono">GET</span>
                    <code>/events</code>
                    <span className="text-gray-600">- Listar eventos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono">POST</span>
                    <code>/events</code>
                    <span className="text-gray-600">- Criar evento</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-mono">PUT</span>
                    <code>/events/:id</code>
                    <span className="text-gray-600">- Atualizar evento</span>
                  </div>
                </div>
              </div>

              {/* Álbuns */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-2">📸 Álbuns</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono">GET</span>
                    <code>/albums</code>
                    <span className="text-gray-600">- Listar álbuns</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono">POST</span>
                    <code>/albums/:id/photos</code>
                    <span className="text-gray-600">- Upload de fotos</span>
                  </div>
                </div>
              </div>

              {/* Webhooks */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-2">🔗 Webhooks</h5>
                <p className="text-sm text-gray-600 mb-3">
                  O sistema enviará notificações para sua URL configurada nos seguintes eventos:
                </p>
                <div className="space-y-1 text-sm">
                  <div>• <code>event.created</code> - Novo agendamento</div>
                  <div>• <code>payment.completed</code> - Pagamento confirmado</div>
                  <div>• <code>photos.uploaded</code> - Fotos adicionadas</div>
                  <div>• <code>selection.completed</code> - Seleção finalizada</div>
                </div>
              </div>
            </div>
          </div>

          {/* Exemplo de uso */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Exemplo de Uso (n8n)</h4>
            <div className="bg-gray-50 p-4 rounded-lg">
              <pre className="text-sm text-gray-800 overflow-x-auto">
{`// Criar novo agendamento via n8n
const response = await fetch('${window.location.origin}/api/v1/events', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${apiKey || 'SUA_CHAVE_API'}'
  },
  body: JSON.stringify({
    client_name: 'João Silva',
    client_email: 'joao@email.com',
    client_phone: '(11) 99999-9999',
    session_type: 'gestante',
    event_date: '2024-02-15T14:00:00Z',
    location: 'Estúdio Fotográfico',
    notes: 'Sessão gestante'
  })
});

const event = await response.json();
console.log('Evento criado:', event.id);`}
              </pre>
              <button
                onClick={() => copyToClipboard(`// Criar novo agendamento via n8n
const response = await fetch('${window.location.origin}/api/v1/events', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${apiKey || 'SUA_CHAVE_API'}'
  },
  body: JSON.stringify({
    client_name: 'João Silva',
    client_email: 'joao@email.com',
    client_phone: '(11) 99999-9999',
    session_type: 'gestante',
    event_date: '2024-02-15T14:00:00Z',
    location: 'Estúdio Fotográfico',
    notes: 'Sessão gestante'
  })
});

const event = await response.json();
console.log('Evento criado:', event.id);`, 'Código de exemplo')}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                <Copy className="w-4 h-4 inline mr-1" />
                Copiar código
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={saveConfig}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Database className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Todas as Configurações'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiDocumentation;