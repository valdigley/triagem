#!/bin/bash

# Script simplificado para configurar o projeto na VPS
# Execute com: bash setup-vps.sh

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

log "🚀 Configurando projeto Triagem na VPS..."

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    error "Node.js não está instalado. Instale primeiro:"
    echo "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "sudo apt-get install -y nodejs"
    exit 1
fi

# Verificar se Nginx está instalado
if ! command -v nginx &> /dev/null; then
    error "Nginx não está instalado. Instale primeiro:"
    echo "sudo apt update && sudo apt install -y nginx"
    exit 1
fi

# Criar diretório do projeto
log "📁 Criando diretório do projeto..."
sudo mkdir -p /var/www/triagem
sudo chown $USER:$USER /var/www/triagem

# Verificar se é um repositório Git
if [ -d ".git" ]; then
    log "📥 Copiando arquivos do repositório atual..."
    cp -r . /var/www/triagem/
else
    log "📥 Inicializando projeto no diretório..."
    cd /var/www/triagem
    
    # Se não tem package.json, criar um básico
    if [ ! -f "package.json" ]; then
        warn "Criando package.json básico..."
        cat > package.json << 'EOF'
{
  "name": "triagem",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
EOF
    fi
fi

# Ir para o diretório do projeto
cd /var/www/triagem

# Criar arquivo .env se não existir
if [ ! -f ".env" ]; then
    log "⚙️ Criando arquivo .env..."
    cat > .env << 'EOF'
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
VITE_MERCADOPAGO_PUBLIC_KEY=sua-chave-publica-mp
EOF
    warn "Configure as variáveis em /var/www/triagem/.env"
fi

# Instalar dependências se package.json existir
if [ -f "package.json" ]; then
    log "📦 Instalando dependências..."
    npm install
    
    log "🔨 Fazendo build..."
    npm run build
else
    warn "package.json não encontrado. Você precisa fazer upload dos arquivos do projeto."
fi

# Configurar Nginx
log "🌐 Configurando Nginx..."
sudo tee /etc/nginx/sites-available/triagem > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;
    
    root /var/www/triagem/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Ativar site
sudo ln -sf /etc/nginx/sites-available/triagem /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Testar e recarregar Nginx
sudo nginx -t && sudo systemctl reload nginx

log "✅ Configuração concluída!"
echo ""
echo "📁 Projeto em: /var/www/triagem"
echo "⚙️ Configure: /var/www/triagem/.env"
echo "🌐 Teste: http://$(hostname -I | awk '{print $1}')"