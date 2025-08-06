#!/bin/bash

# Script manual para configurar VPS (execute na VPS)
# bash setup-vps-manual.sh

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

log "🚀 Configurando Triagem na VPS..."

# Verificar se é root
if [ "$EUID" -eq 0 ]; then
    error "Não execute este script como root"
    exit 1
fi

# Solicitar informações
echo ""
info "📝 Informações necessárias:"
read -p "URL do seu repositório GitHub: " REPO_URL
read -p "Nome do repositório (ex: triagem-sistema): " REPO_NAME
read -p "Seu domínio ou IP da VPS: " VPS_DOMAIN
read -p "URL do Supabase: " SUPABASE_URL
read -p "Chave anônima do Supabase: " SUPABASE_KEY

# Gerar secret para webhook
WEBHOOK_SECRET=$(openssl rand -hex 32)

# Atualizar sistema
log "📦 Atualizando sistema..."
sudo apt update && sudo apt upgrade -y

# Instalar dependências
log "🔧 Instalando dependências..."
sudo apt install -y curl wget git unzip nginx

# Instalar Node.js
if ! command -v node &> /dev/null; then
    log "📦 Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    log "Node.js já instalado: $(node --version)"
fi

# Instalar PM2
if ! command -v pm2 &> /dev/null; then
    log "📦 Instalando PM2..."
    sudo npm install -g pm2
else
    log "PM2 já instalado: $(pm2 --version)"
fi

# Criar diretório e clonar projeto
log "📁 Configurando projeto..."
sudo mkdir -p /var/www/$REPO_NAME
sudo chown $USER:$USER /var/www/$REPO_NAME

cd /var/www/$REPO_NAME

if [ ! -z "$REPO_URL" ]; then
    log "📥 Clonando repositório..."
    git clone $REPO_URL .
else
    error "URL do repositório é obrigatória"
    exit 1
fi

# Criar .env
log "⚙️ Criando configuração..."
cat > .env << EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_KEY
EOF

# Instalar dependências
log "📦 Instalando dependências do projeto..."
npm install

# Instalar express para webhook
npm install express

# Configurar ecosystem.config.js
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: '$REPO_NAME-webhook',
      script: 'webhook-deploy.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        WEBHOOK_PORT: 3001,
        WEBHOOK_SECRET: '$WEBHOOK_SECRET',
        PROJECT_PATH: '/var/www/$REPO_NAME'
      },
      error_file: '/var/log/pm2/triagem-webhook-error.log',
      out_file: '/var/log/pm2/triagem-webhook-out.log',
      log_file: '/var/log/pm2/triagem-webhook.log',
      time: true
    }
  ]
};
EOF

# Fazer build inicial
log "🔨 Fazendo build inicial..."
npm run build

# Configurar Nginx
log "🌐 Configurando Nginx..."
sudo tee /etc/nginx/sites-available/$REPO_NAME > /dev/null << EOF
server {
    listen 80;
    server_name $VPS_DOMAIN;
    
    root /var/www/$REPO_NAME/dist;
    index index.html;
    
    access_log /var/log/nginx/triagem_access.log;
    error_log /var/log/nginx/triagem_error.log;
    
    # SPA routing
    location / {
        try_files \$uri \$uri/ /index.html;
        
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }
    
    # Cache para assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Webhook endpoint
    location /webhook {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Rotas do app
    location /agendar {
        try_files \$uri \$uri/ /index.html;
    }
    
    location /album/ {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Compressão
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    client_max_body_size 50M;
}
EOF

# Ativar site
sudo ln -sf /etc/nginx/sites-available/$REPO_NAME /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Testar e recarregar Nginx
sudo nginx -t && sudo systemctl reload nginx

# Tornar scripts executáveis
chmod +x deploy-vps.sh
chmod +x setup-auto-deploy.sh

# Iniciar webhook
log "🔗 Iniciando webhook server..."
pm2 start ecosystem.config.js
pm2 save

# Configurar startup automático
pm2 startup | grep -E '^sudo' | bash || warn "Configure PM2 startup manualmente"

# Configurar firewall
log "🛡️ Configurando firewall..."
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 3001/tcp comment "Webhook Triagem"

log "✅ Configuração concluída!"
echo ""
info "🎉 Próximos passos:"
echo ""
echo "1. 📝 Configure o webhook no GitHub:"
echo "   • Repositório: $REPO_URL"
echo "   • Vá em: Settings > Webhooks > Add webhook"
echo "   • URL: http://$VPS_DOMAIN:3001/deploy"
echo "   • Content type: application/json"
echo "   • Secret: $WEBHOOK_SECRET"
echo "   • Events: Just the push event"
echo ""
echo "2. 🔑 Configure os Secrets no GitHub Actions:"
echo "   • Vá em: Settings > Secrets and variables > Actions"
echo "   • Adicione os secrets listados no README-DEPLOY-AUTOMATICO.md"
echo ""
echo "3. 🧪 Teste o sistema:"
echo "   • Site: http://$VPS_DOMAIN"
echo "   • Agendamento: http://$VPS_DOMAIN/agendar"
echo "   • Webhook status: http://$VPS_DOMAIN:3001/health"
echo ""
info "🔧 Comandos úteis:"
echo "• Deploy manual: cd /var/www/triagem && bash deploy-vps.sh"
echo "• Status webhook: pm2 status"
echo "• Logs webhook: pm2 logs triagem-webhook"
echo "• Logs Nginx: sudo tail -f /var/log/nginx/triagem_access.log"
echo ""
warn "🔑 IMPORTANTE: Salve este secret para o GitHub:"
echo "WEBHOOK_SECRET: $WEBHOOK_SECRET"