#!/bin/bash

# Script para configurar Triagem na VPS (compatível com root)
# Execute como root: bash setup-vps-root.sh

set -e

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

log "🚀 Configurando Triagem na VPS (como root)..."

# Solicitar informações
echo ""
info "📝 Configuração:"
read -p "Seu domínio ou IP da VPS: " VPS_DOMAIN
read -p "URL do Supabase: " SUPABASE_URL
read -p "Chave anônima do Supabase: " SUPABASE_KEY

# Gerar secret para webhook
WEBHOOK_SECRET=$(openssl rand -hex 32)

# Atualizar sistema
log "📦 Atualizando sistema..."
apt update && apt upgrade -y

# Instalar dependências
log "🔧 Instalando dependências..."
apt install -y curl wget git unzip nginx

# Instalar Node.js
if ! command -v node &> /dev/null; then
    log "📦 Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
else
    log "Node.js já instalado: $(node --version)"
fi

# Instalar PM2
if ! command -v pm2 &> /dev/null; then
    log "📦 Instalando PM2..."
    npm install -g pm2
else
    log "PM2 já instalado: $(pm2 --version)"
fi

# Usar diretório atual se já estiver no projeto
if [ -f "package.json" ]; then
    PROJECT_DIR=$(pwd)
    log "📁 Usando diretório atual: $PROJECT_DIR"
else
    # Criar novo diretório
    PROJECT_DIR="/var/www/triagem"
    log "📁 Criando diretório: $PROJECT_DIR"
    mkdir -p $PROJECT_DIR
    cd $PROJECT_DIR
    
    # Clonar repositório
    log "📥 Clonando repositório..."
    git clone https://github.com/valdigley/triagem.git .
fi

cd $PROJECT_DIR

# Criar .env
log "⚙️ Criando configuração..."
cat > .env << EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_KEY
EOF

# Instalar dependências
log "📦 Instalando dependências..."
npm install

# Instalar express para webhook
npm install express

# Criar webhook-deploy.js
cat > webhook-deploy.js << 'EOF'
const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.WEBHOOK_PORT || 3001;
const SECRET = process.env.WEBHOOK_SECRET;
const PROJECT_PATH = process.env.PROJECT_PATH;

app.use(express.json({ limit: '10mb' }));

// Verificar assinatura do GitHub
const verifySignature = (req, res, next) => {
  const signature = req.get('X-Hub-Signature-256');
  
  if (!signature || !SECRET) {
    console.log('⚠️ Webhook sem assinatura');
    return res.status(401).json({ error: 'Assinatura não fornecida' });
  }

  const body = JSON.stringify(req.body);
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', SECRET)
    .update(body, 'utf8')
    .digest('hex')}`;

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    console.log('❌ Assinatura inválida');
    return res.status(401).json({ error: 'Assinatura inválida' });
  }

  next();
};

// Endpoint de saúde
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    project_path: PROJECT_PATH,
    uptime: process.uptime(),
    secret_configured: !!SECRET
  });
});

// Endpoint principal do webhook
app.post('/deploy', verifySignature, (req, res) => {
  const { ref, repository, head_commit } = req.body;
  
  console.log('🔔 Webhook recebido:');
  console.log(`   📂 Repositório: ${repository?.full_name}`);
  console.log(`   🌿 Branch: ${ref}`);
  console.log(`   📝 Commit: ${head_commit?.id?.substring(0, 7)} - ${head_commit?.message}`);

  // Verificar se é push para branch principal
  if (ref !== 'refs/heads/main' && ref !== 'refs/heads/master') {
    console.log(`⏭️ Ignorando push para branch: ${ref}`);
    return res.json({ message: 'Branch ignorada', ref });
  }

  console.log('🚀 Iniciando deploy automático...');
  
  const deployCommand = `cd ${PROJECT_PATH} && bash deploy-vps.sh`;
  
  exec(deployCommand, { timeout: 300000 }, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Erro no deploy:', error.message);
      return res.status(500).json({ 
        error: 'Deploy falhou', 
        details: error.message 
      });
    }

    console.log('✅ Deploy concluído!');
    res.json({ 
      success: true, 
      message: 'Deploy realizado com sucesso',
      commit: head_commit?.id,
      timestamp: new Date().toISOString()
    });
  });
});

app.listen(PORT, () => {
  console.log(`🔗 Webhook server rodando na porta ${PORT}`);
  console.log(`📁 Projeto: ${PROJECT_PATH}`);
  console.log(`🔑 Secret: ${SECRET ? 'Configurado' : 'NÃO CONFIGURADO'}`);
});
EOF

# Criar ecosystem.config.js
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'triagem-webhook',
      script: 'webhook-deploy.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        WEBHOOK_PORT: 3001,
        WEBHOOK_SECRET: '$WEBHOOK_SECRET',
        PROJECT_PATH: '$PROJECT_DIR'
      }
    }
  ]
};
EOF

# Criar deploy-vps.sh
cat > deploy-vps.sh << 'EOF'
#!/bin/bash

echo "🚀 Iniciando deploy..." | tee -a deploy.log

# Fazer backup
if [ -d "dist" ]; then
    mv dist dist.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
fi

# Atualizar código
echo "📥 Atualizando código..." | tee -a deploy.log
git pull origin main

# Instalar dependências
echo "📦 Instalando dependências..." | tee -a deploy.log
npm ci

# Build
echo "🔨 Fazendo build..." | tee -a deploy.log
npm run build

# Recarregar Nginx
echo "🌐 Recarregando Nginx..." | tee -a deploy.log
systemctl reload nginx

echo "✅ Deploy concluído em $(date)" | tee -a deploy.log
EOF

chmod +x deploy-vps.sh

# Fazer build inicial
log "🔨 Fazendo build inicial..."
npm run build

# Configurar Nginx
log "🌐 Configurando Nginx..."
tee /etc/nginx/sites-available/triagem > /dev/null << EOF
server {
    listen 80;
    server_name $VPS_DOMAIN;
    
    root $PROJECT_DIR/dist;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Webhook endpoint
    location /webhook {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
    
    location /agendar {
        try_files \$uri \$uri/ /index.html;
    }
    
    location /album/ {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# Ativar site
ln -sf /etc/nginx/sites-available/triagem /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Iniciar webhook
log "🔗 Iniciando webhook..."
pm2 start ecosystem.config.js
pm2 save

# Configurar firewall
ufw --force enable
ufw allow ssh
ufw allow 'Nginx Full'
ufw allow 3001/tcp

log "✅ Configuração concluída!"
echo ""
info "🎉 Próximos passos:"
echo ""
echo "1. 🧪 Teste o site:"
echo "   • http://$VPS_DOMAIN"
echo "   • http://$VPS_DOMAIN:3001/health"
echo ""
echo "2. 📝 Configure webhook no GitHub:"
echo "   • Vá em: https://github.com/valdigley/triagem/settings/hooks"
echo "   • Add webhook:"
echo "   • URL: http://$VPS_DOMAIN:3001/deploy"
echo "   • Content type: application/json"
echo "   • Secret: $WEBHOOK_SECRET"
echo "   • Events: Just the push event"
echo ""
warn "🔑 SALVE ESTE SECRET:"
echo "WEBHOOK_SECRET: $WEBHOOK_SECRET"