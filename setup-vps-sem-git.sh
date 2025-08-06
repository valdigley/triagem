#!/bin/bash

# Script para configurar VPS SEM depender do GitHub
# Execute na VPS: bash setup-vps-sem-git.sh

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

log "🚀 Configurando Triagem na VPS (sem Git)..."

# Verificar se é root
if [ "$EUID" -ne 0 ]; then
    error "Execute este script como root: sudo bash setup-vps-sem-git.sh"
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

# Criar diretório do projeto
log "📁 Criando diretório do projeto..."
mkdir -p /var/www/triagem
chown www-data:www-data /var/www/triagem

cd /var/www/triagem

# Criar estrutura básica
log "📂 Criando estrutura básica..."

# package.json
cat > package.json << 'EOF'
{
  "name": "triagem-sistema",
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

# vite.config.ts
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

# tailwind.config.js
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

# postcss.config.js
cat > postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
EOF

# tsconfig.json
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

# index.html
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

# Criar .env
log "⚙️ Criando configuração..."
cat > .env << EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_KEY
EOF

# Criar estrutura src/
mkdir -p src

# src/main.tsx
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

# src/index.css
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

# src/App.tsx
cat > src/App.tsx << 'EOF'
import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">
            🎯 Triagem Sistema
          </h1>
          <p className="text-xl text-white text-opacity-90 mb-8 drop-shadow">
            Sistema de Seleção de Fotos para Fotógrafos
          </p>
          
          <div className="bg-white bg-opacity-10 backdrop-blur-sm p-8 rounded-2xl shadow-2xl max-w-md mx-auto">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-semibold text-white mb-4">
              ✅ VPS Configurada!
            </h2>
            <p className="text-white text-opacity-90 mb-6">
              Sua VPS está funcionando perfeitamente. 
              Agora você pode fazer upload do código completo do Bolt.
            </p>
            
            <div className="bg-white bg-opacity-20 p-4 rounded-lg">
              <p className="text-white text-sm">
                <strong>Próximo passo:</strong><br/>
                Substitua este código básico pelo código completo do Bolt
              </p>
            </div>
          </div>
          
          <p className="text-white text-opacity-70 text-sm mt-8 drop-shadow">
            by Valdigley Santos
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
tee /etc/nginx/sites-available/triagem << EOF
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
ln -sf /etc/nginx/sites-available/triagem /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Configurar firewall
log "🛡️ Configurando firewall..."
ufw --force enable
ufw allow ssh
ufw allow 'Nginx Full'

log "✅ Configuração básica concluída!"
echo ""
info "🎉 Próximos passos:"
echo ""
echo "1. 🧪 Teste o site básico:"
echo "   • http://$VPS_DOMAIN"
echo ""
echo "2. 📂 Agora substitua pelo código do Bolt:"
echo "   • Baixe o projeto do Bolt (botão Download)"
echo "   • Extraia e substitua TODOS os arquivos em /var/www/triagem/"
echo "   • Execute: cd /var/www/triagem && npm install && npm run build"
echo "   • Recarregue: systemctl reload nginx"
echo ""
echo "3. 🔄 Para atualizações futuras:"
echo "   • Baixe do Bolt → Substitua arquivos → Build → Reload"
echo ""
info "📁 Arquivos importantes:"
echo "• Projeto: /var/www/triagem/"
echo "• Configuração: /var/www/triagem/.env"
echo "• Nginx: /etc/nginx/sites-available/triagem"
echo "• Logs: /var/log/nginx/triagem_*.log"
echo ""
warn "⚠️ IMPORTANTE:"
echo "• Configure SSL depois: certbot --nginx -d $VPS_DOMAIN"
echo "• Mantenha backups regulares"
echo "• Monitore logs de erro"