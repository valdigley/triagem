#!/bin/bash

# Script para atualizar o projeto na VPS
# Execute com: bash update-vps.sh

set -e

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Verificar se o diretório existe
if [ ! -d "/var/www/triagem" ]; then
    error "Diretório /var/www/triagem não existe!"
    echo "Execute primeiro: bash setup-vps.sh"
    exit 1
fi

log "🔄 Atualizando projeto..."

# Ir para o diretório
cd /var/www/triagem

# Se é repositório Git, fazer pull
if [ -d ".git" ]; then
    log "📥 Atualizando código..."
    git pull origin main || {
        error "Falha ao atualizar código"
        exit 1
    }
else
    warn "Não é repositório Git. Faça upload manual dos arquivos."
fi

# Instalar dependências
if [ -f "package.json" ]; then
    log "📦 Instalando dependências..."
    npm install
    
    log "🔨 Fazendo build..."
    npm run build
    
    log "🌐 Recarregando Nginx..."
    sudo systemctl reload nginx
    
    log "✅ Atualização concluída!"
else
    error "package.json não encontrado!"
    exit 1
fi