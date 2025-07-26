#!/bin/bash

# Script de instalação automática para VPS
# Execute com: curl -sSL https://raw.githubusercontent.com/seu-repo/triagem/main/install-vps.sh | bash

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log colorido
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

# Verificar se é root
if [ "$EUID" -eq 0 ]; then
    error "Não execute este script como root"
    exit 1
fi

log "🚀 Iniciando instalação do Triagem no VPS..."

# Verificar sistema operacional
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    error "Sistema operacional não suportado"
    exit 1
fi

log "Sistema detectado: $OS $VER"

# Atualizar sistema
log "📦 Atualizando sistema..."
sudo apt update && sudo apt upgrade -y

# Instalar dependências básicas
log "🔧 Instalando dependências básicas..."
sudo apt install -y curl wget git unzip software-properties-common

# Instalar Node.js 18+
log "📦 Instalando Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    log "Node.js já está instalado: $(node --version)"
fi

# Instalar PM2
log "📦 Instalando PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
else
    log "PM2 já está instalado: $(pm2 --version)"
fi

# Instalar Nginx
log "🌐 Instalando Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
else
    log "Nginx já está instalado: $(nginx -v 2>&1)"
fi

# Criar diretório do projeto
log "📁 Criando diretório do projeto..."
sudo mkdir -p /var/www/triagem
sudo chown $USER:$USER /var/www/triagem

# Solicitar informações do usuário
echo ""
info "📝 Configuração do projeto:"
read -p "URL do repositório Git: " REPO_URL
read -p "Seu domínio (ex: triagem.com): " DOMAIN
read -p "URL do Supabase: " SUPABASE_URL
read -p "Chave anônima do Supabase: " SUPABASE_KEY

# Clonar projeto
log "📥 Clonando projeto..."
cd /var/www/triagem
if [ ! -z "$REPO_URL" ]; then
    git clone $REPO_URL .
else
    warn "URL do repositório não fornecida, você precisará fazer upload manual dos arquivos"
fi

# Criar arquivo .env
log "⚙️ Criando arquivo de configuração..."
cat > .env << EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_KEY
VITE_N8N_WEBHOOK_URL=
EOF

# Instalar dependências do projeto
if [ -f "package.json" ]; then
    log "📦 Instalando dependências do projeto..."
    npm install
    
    # Fazer build inicial
    log "🔨 Fazendo build inicial..."
    npm run build
else
    warn "package.json não encontrado, pule esta etapa se fez upload manual"
fi

# Configurar Nginx
log "🌐 Configurando Nginx..."
sudo tee /etc/nginx/sites-available/triagem > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    root /var/www/triagem/dist;
    index index.html;
    
    access_log /var/log/nginx/triagem_access.log;
    error_log /var/log/nginx/triagem_error.log;
    
    location / {
        try_files \$uri \$uri/ /index.html;
        
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location /agendar {
        try_files \$uri \$uri/ /index.html;
    }
    
    location /album/ {
        try_files \$uri \$uri/ /index.html;
    }
    
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    client_max_body_size 50M;
}
EOF

# Ativar site
sudo ln -sf /etc/nginx/sites-available/triagem /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Testar configuração do Nginx
log "🧪 Testando configuração do Nginx..."
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx

# Configurar firewall
log "🛡️ Configurando firewall..."
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

# Instalar Certbot para SSL
log "🔒 Instalando Certbot para SSL..."
sudo apt install -y certbot python3-certbot-nginx

# Configurar SSL
if [ ! -z "$DOMAIN" ]; then
    log "🔐 Configurando SSL para $DOMAIN..."
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || warn "Falha ao configurar SSL automaticamente"
fi

# Configurar PM2 startup
log "🔄 Configurando PM2 para inicialização automática..."
pm2 startup | grep -E '^sudo' | bash || warn "Configure PM2 startup manualmente"

# Tornar script de deploy executável
chmod +x deploy.sh 2>/dev/null || warn "Script deploy.sh não encontrado"

# Criar webhook server se não existir
if [ ! -f "webhook-deploy.js" ]; then
    warn "webhook-deploy.js não encontrado, criando versão básica..."
    npm install express
fi

# Iniciar webhook server
if [ -f "webhook-deploy.js" ]; then
    log "🔗 Iniciando webhook server..."
    pm2 start ecosystem.config.js
    pm2 save
fi

log "✅ Instalação concluída!"
echo ""
info "🎉 Próximos passos:"
echo "1. Acesse: http://$DOMAIN (ou https://$DOMAIN se SSL foi configurado)"
echo "2. Configure as variáveis de ambiente em /var/www/triagem/.env"
echo "3. Para deploy automático: configure webhook em seu repositório Git"
echo "4. Para monitorar: pm2 monit"
echo "5. Para logs: pm2 logs"
echo ""
info "📁 Arquivos importantes:"
echo "- Projeto: /var/www/triagem/"
echo "- Nginx config: /etc/nginx/sites-available/triagem"
echo "- Logs Nginx: /var/log/nginx/triagem_*.log"
echo "- Logs PM2: ~/.pm2/logs/"
echo ""
info "🔧 Comandos úteis:"
echo "- Deploy manual: cd /var/www/triagem && ./deploy.sh"
echo "- Reiniciar Nginx: sudo systemctl restart nginx"
echo "- Status PM2: pm2 status"
echo "- Logs em tempo real: pm2 logs --lines 50"