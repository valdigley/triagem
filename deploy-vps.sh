#!/bin/bash

# Script de deploy automático para VPS
# Este script é executado na VPS via webhook

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
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

log "🚀 Iniciando deploy automático..."

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    error "package.json não encontrado. Execute no diretório do projeto."
    exit 1
fi

# Fazer backup do build anterior
if [ -d "dist" ]; then
    log "📦 Fazendo backup do build anterior..."
    mv dist dist.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
fi

# Parar processos PM2 se existirem
log "⏹️ Parando processos antigos..."
pm2 stop triagem-webhook 2>/dev/null || warn "Nenhum processo PM2 encontrado"

# Atualizar código do Git
log "📥 Atualizando código do repositório..."
git fetch origin main
git reset --hard origin/main
log "✅ Código atualizado"

# Verificar se .env existe
if [ ! -f ".env" ]; then
    warn "Arquivo .env não encontrado, criando template..."
    cat > .env << 'EOF'
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
EOF
    warn "⚠️ Configure as variáveis em .env antes do próximo deploy"
fi

# Instalar dependências
log "📦 Instalando dependências..."
npm ci --production=false || {
    error "Falha ao instalar dependências"
    exit 1
}

# Fazer build
log "🔨 Fazendo build do projeto..."
npm run build || {
    error "Falha no build do projeto"
    exit 1
}

# Verificar se o build foi criado
if [ ! -d "dist" ]; then
    error "Diretório dist não foi criado"
    exit 1
fi

# Configurar permissões
log "🔐 Configurando permissões..."
chown -R www-data:www-data dist/ 2>/dev/null || warn "Falha ao configurar permissões"

# Testar configuração do Nginx
log "🧪 Testando configuração do Nginx..."
nginx -t || {
    error "Configuração do Nginx inválida"
    exit 1
}

# Recarregar Nginx
log "🌐 Recarregando Nginx..."
systemctl reload nginx || {
    error "Falha ao recarregar Nginx"
    exit 1
}

# Verificar se o Nginx está rodando
if ! systemctl is-active --quiet nginx; then
    error "Nginx não está rodando"
    exit 1
fi

# Limpar builds antigos (manter apenas os 3 mais recentes)
log "🧹 Limpando builds antigos..."
ls -t dist.backup.* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true

# Reiniciar webhook
log "🔄 Reiniciando webhook..."
pm2 restart triagem-webhook 2>/dev/null || pm2 start ecosystem.config.cjs 2>/dev/null || true
pm2 save 2>/dev/null || true

log "✅ Deploy concluído com sucesso!"
log "🌐 Site disponível em: http://$(hostname -I | awk '{print $1}')"
log "📊 Tamanho do build: $(du -sh dist/ | cut -f1)"
log "📝 Arquivos no build: $(find dist/ -type f | wc -l)"

# Mostrar status final
echo ""
info "📊 Status dos serviços:"
echo "Nginx: $(systemctl is-active nginx)"
echo "PM2: $(pm2 list 2>/dev/null | grep -c online || echo '0') processos online"
echo "Última atualização: $(date)"