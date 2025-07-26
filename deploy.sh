#!/bin/bash

echo "🚀 Iniciando deploy do Triagem..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    error "package.json não encontrado. Execute este script no diretório do projeto."
    exit 1
fi

# Parar processos antigos do PM2
log "Parando processos antigos..."
pm2 stop triagem-build 2>/dev/null || warn "Nenhum processo triagem-build encontrado"

# Fazer backup do build anterior
if [ -d "dist" ]; then
    log "Fazendo backup do build anterior..."
    mv dist dist.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
fi

# Atualizar código (se usando Git)
if [ -d ".git" ]; then
    log "Atualizando código do repositório..."
    git pull origin main || warn "Falha ao atualizar código do Git"
else
    warn "Não é um repositório Git, pulando atualização"
fi

# Instalar/atualizar dependências
log "Instalando dependências..."
npm install || {
    error "Falha ao instalar dependências"
    exit 1
}

# Fazer build
log "Fazendo build do projeto..."
npm run build || {
    error "Falha no build do projeto"
    exit 1
}

# Verificar se o build foi criado
if [ ! -d "dist" ]; then
    error "Diretório dist não foi criado"
    exit 1
fi

# Definir permissões corretas
log "Configurando permissões..."
sudo chown -R www-data:www-data dist/ 2>/dev/null || warn "Falha ao configurar permissões"

# Testar configuração do Nginx
log "Testando configuração do Nginx..."
sudo nginx -t || {
    error "Configuração do Nginx inválida"
    exit 1
}

# Recarregar Nginx
log "Recarregando Nginx..."
sudo systemctl reload nginx || {
    error "Falha ao recarregar Nginx"
    exit 1
}

# Verificar se o Nginx está rodando
if ! sudo systemctl is-active --quiet nginx; then
    error "Nginx não está rodando"
    exit 1
fi

# Limpar builds antigos (manter apenas os 3 mais recentes)
log "Limpando builds antigos..."
ls -t dist.backup.* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true

# Salvar configuração do PM2
pm2 save 2>/dev/null || warn "Falha ao salvar configuração do PM2"

log "✅ Deploy concluído com sucesso!"
log "🌐 Site disponível em: https://$(hostname -f)"
log "📊 Para monitorar: pm2 monit"
log "📝 Para ver logs: pm2 logs"

# Mostrar status final
echo ""
log "Status dos serviços:"
echo "Nginx: $(sudo systemctl is-active nginx)"
echo "Tamanho do build: $(du -sh dist/ | cut -f1)"
echo "Arquivos no build: $(find dist/ -type f | wc -l)"