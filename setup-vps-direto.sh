#!/bin/bash

# Script para configurar Triagem diretamente na VPS
# Execute: bash setup-vps-direto.sh

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

log "🚀 Configurando Triagem diretamente na VPS..."

# Verificar se é root
if [ "$EUID" -eq 0 ]; then
    error "Não execute este script como root"
    exit 1
fi

# Solicitar informações
echo ""
info "📝 Configuração:"
read -p "Seu domínio ou IP da VPS: " VPS_DOMAIN
read -p "URL do Supabase: " SUPABASE_URL
read -p "Chave anônima do Supabase: " SUPABASE_KEY

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

# Criar diretório do projeto
log "📁 Criando diretório do projeto..."
sudo mkdir -p /var/www/triagem
sudo chown $USER:$USER /var/www/triagem

cd /var/www/triagem

# Criar estrutura básica do projeto
log "📂 Criando estrutura do projeto..."

# Criar package.json
cat > package.json << 'EOF'
{
  "name": "triagem-vps",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.2.0",
    "@mercadopago/sdk-js": "^0.0.3",
    "@supabase/supabase-js": "^2.52.1",
    "@tanstack/react-query": "^5.83.0",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.344.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.61.1",
    "react-hot-toast": "^2.5.2",
    "react-router-dom": "^7.7.1",
    "recharts": "^3.1.0",
    "zod": "^4.0.10"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.2"
  }
}
EOF

# Criar .env
log "⚙️ Criando configuração..."
cat > .env << EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_KEY
EOF

# Criar vite.config.ts
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
EOF

# Criar tailwind.config.js
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
EOF

# Criar postcss.config.js
cat > postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
EOF

# Criar tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
EOF

# Criar index.html
cat > index.html << 'EOF'
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Triagem - Sistema de Seleção de Fotos</title>
    <script src="https://sdk.mercadopago.com/js/v2" async></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

# Criar estrutura src/
mkdir -p src

# Criar src/main.tsx
cat > src/main.tsx << 'EOF'
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
EOF

# Criar src/index.css
cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}

* {
  box-sizing: border-box;
}
EOF

# Criar App.tsx básico
cat > src/App.tsx << 'EOF'
import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          🎯 Triagem Sistema
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Sistema de Seleção de Fotos para Fotógrafos
        </p>
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            ✅ VPS Configurada!
          </h2>
          <p className="text-gray-600">
            Sua VPS está funcionando corretamente. 
            Agora você pode fazer deploy do código completo do Bolt.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
EOF

# Instalar dependências
log "📦 Instalando dependências..."
npm install

# Fazer build inicial
log "🔨 Fazendo build inicial..."
npm run build

# Configurar Nginx
log "🌐 Configurando Nginx..."
sudo tee /etc/nginx/sites-available/triagem << EOF
server {
    listen 80;
    server_name $VPS_DOMAIN;
    
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

# Testar e recarregar Nginx
sudo nginx -t && sudo systemctl reload nginx

# Configurar firewall
log "🛡️ Configurando firewall..."
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

log "✅ Configuração básica concluída!"
echo ""
info "🎉 Próximos passos:"
echo ""
echo "1. 🌐 Teste o site básico:"
echo "   • Acesse: http://$VPS_DOMAIN"
echo "   • Deve mostrar página de confirmação"
echo ""
echo "2. 📂 Agora faça upload do código completo:"
echo "   • Baixe o projeto do Bolt (botão Download)"
echo "   • Extraia e substitua os arquivos em /var/www/triagem/"
echo "   • Execute: cd /var/www/triagem && npm install && npm run build"
echo "   • Recarregue: sudo systemctl reload nginx"
echo ""
echo "3. 🔄 Para atualizações futuras:"
echo "   • Use Git ou substitua arquivos manualmente"
echo "   • Sempre execute: npm run build após mudanças"
echo ""
info "📁 Arquivos importantes:"
echo "• Projeto: /var/www/triagem/"
echo "• Configuração: /var/www/triagem/.env"
echo "• Nginx: /etc/nginx/sites-available/triagem"
echo "• Logs: /var/log/nginx/triagem_*.log"