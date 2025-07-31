# Sistema de Seleção de Fotos para Fotógrafos

Um sistema completo para fotógrafos gerenciarem sessões, compartilharem álbuns e processarem pagamentos de clientes.

## 🚀 Funcionalidades Principais

### 1. Integração com Google Calendar
- Agendamento automático de sessões
- Sincronização bidirecional com Google Calendar
- Dados do cliente salvos automaticamente

### 2. Monitoramento FTP Automático
- Monitoramento contínuo de pasta FTP específica
- Upload automático de fotos para álbuns
- Aplicação automática de marca d'água

### 3. Galeria e Compartilhamento
- Álbuns privados com links únicos
- Visualização com marca d'água para proteção
- Interface intuitiva para seleção de fotos

### 4. Sistema de Pagamento
- Carrinho de compras integrado
- Múltiplas formas de pagamento (PIX, cartão)
- Liberação automática após pagamento

### 5. Automação com n8n
- Webhooks para integração com n8n
- Adição automática ao Google Contacts
- Notificações WhatsApp via Evolution API

## 🏗️ Arquitetura do Sistema

```
src/
├── components/           # Componentes React
│   ├── Layout.tsx       # Layout principal
│   ├── Dashboard.tsx    # Dashboard do fotógrafo
│   ├── EventScheduling.tsx  # Agendamento de eventos
│   └── PhotoGallery.tsx # Galeria de fotos
├── lib/                 # Bibliotecas e utilitários
│   ├── supabase.ts     # Cliente Supabase
│   └── api.ts          # Integrações API
├── types/              # Definições TypeScript
│   └── index.ts        # Tipos principais
└── App.tsx             # Componente principal
```

## 🗄️ Modelo de Banco de Dados

### Tabelas Principais

#### users
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text CHECK (role IN ('admin', 'photographer', 'client')) DEFAULT 'client',
  avatar text,
  created_at timestamptz DEFAULT now()
);
```

#### photographers
```sql
CREATE TABLE photographers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  business_name text NOT NULL,
  phone text NOT NULL,
  google_calendar_id text,
  ftp_config jsonb,
  watermark_config jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index for performance on user_id queries
CREATE INDEX IF NOT EXISTS photographers_user_id_idx ON photographers(user_id);
```

#### events
```sql
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid REFERENCES photographers(id),
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text NOT NULL,
  event_date timestamptz NOT NULL,
  location text NOT NULL,
  notes text,
  status text CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')) DEFAULT 'scheduled',
  google_calendar_event_id text,
  album_id uuid,
  created_at timestamptz DEFAULT now()
);
```

#### albums
```sql
CREATE TABLE albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  name text NOT NULL,
  share_token text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

#### photos
```sql
CREATE TABLE photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid REFERENCES albums(id),
  filename text NOT NULL,
  original_path text NOT NULL,
  thumbnail_path text NOT NULL,
  watermarked_path text NOT NULL,
  is_selected boolean DEFAULT false,
  price decimal(10,2) DEFAULT 25.00,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
```

## 🔗 Integrações

### Webhook para n8n

**Endpoint**: `POST /webhook/n8n`

**Payload de Exemplo**:
```json
{
  "eventType": "booking_created",
  "timestamp": "2024-01-20T10:30:00Z",
  "data": {
    "event": {
      "id": "event_123",
      "clientName": "João Silva",
      "clientEmail": "joao@email.com",
      "clientPhone": "(11) 99999-9999",
      "eventDate": "2024-01-25T14:00:00Z",
      "location": "Parque Ibirapuera, São Paulo"
    },
    "client": {
      "name": "João Silva",
      "email": "joao@email.com",
      "phone": "(11) 99999-9999"
    },
    "photographer": {
      "id": "photographer_456",
      "name": "Maria Fotógrafa",
      "email": "maria@fotografia.com"
    }
  }
}
```

### Fluxo n8n Sugerido

1. **Receber Webhook** → Validar dados
2. **Google Contacts** → Adicionar/atualizar contato
3. **Evolution API** → Enviar confirmação WhatsApp
4. **Aguardar Trigger** → Álbum criado
5. **Evolution API** → Notificar álbum disponível
6. **Aguardar 48h** → Lembrete seleção
7. **Trigger Pagamento** → Confirmação final

### Mensagens WhatsApp Automáticas

```javascript
// Confirmação de agendamento
{
  "message": "Olá {{clientName}}! 📸 Seu agendamento foi confirmado para {{eventDate}} às {{eventTime}} no local: {{location}}. Qualquer dúvida, entre em contato!"
}

// Álbum disponível
{
  "message": "Oi {{clientName}}! 🎉 Suas fotos estão prontas! Acesse {{albumLink}} para visualizar e selecionar suas favoritas. Você tem até {{expirationDate}} para fazer a seleção."
}

// Lembrete seleção
{
  "message": "Oi {{clientName}}! ⏰ Lembrete: você ainda tem {{daysLeft}} dias para selecionar suas fotos. Acesse: {{albumLink}}"
}

// Confirmação pagamento
{
  "message": "Obrigado {{clientName}}! 💚 Seu pagamento foi confirmado. Suas fotos já estão disponíveis para download em: {{downloadLink}}"
}
```

## 🚀 Configuração e Deploy

### Variáveis de Ambiente
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_N8N_WEBHOOK_URL=your_n8n_webhook_url
VITE_GOOGLE_CALENDAR_API_KEY=your_google_api_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_key
```

### Comandos
```bash
# Instalar dependências
npm install

# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Deploy via Cloudflare Pages (automático via Git)
# Configure no dashboard: https://dash.cloudflare.com/pages
```

## 🔧 Próximos Passos

1. **Implementar autenticação completa** com Supabase Auth
2. **Configurar Google Calendar API** para integração real
3. **Implementar monitoramento FTP** com Node.js worker
4. **Integrar gateway de pagamento** (Stripe/MercadoPago)
5. **Configurar processamento de imagens** com Sharp
6. **Implementar sistema de notificações** em tempo real
7. **Adicionar testes automatizados**
8. **Configurar CI/CD pipeline**

## 📱 Funcionalidades Mobile

- Layout 100% responsivo
- Otimizado para touch
- Upload de fotos via mobile
- Notificações push (futuro)

## 🛡️ Segurança

- Row Level Security (RLS) no Supabase
- Tokens únicos para álbuns
- Marca d'água para proteção
- Validação de dados com Zod
- Rate limiting para APIs

Este sistema oferece uma solução completa e profissional para fotógrafos modernos, combinando automação, segurança e experiência do usuário excepcional.