# 🚀 Guia Completo: Deploy Automático na VPS

## 📋 Passo a Passo

### 1. **Criar Repositório Git**

**No GitHub:**
1. Acesse: https://github.com/new
2. Nome: `triagem` (ou outro nome)
3. Visibilidade: Private (recomendado)
4. Clique em **Create repository**

### 2. **Conectar Bolt ao GitHub**

**No Bolt:**
1. Clique no ícone do **GitHub** (canto superior direito)
2. **Connect to GitHub**
3. Autorize o acesso
4. Selecione o repositório criado
5. Faça o primeiro **commit** e **push**

### 3. **Configurar na VPS**

**Conecte na sua VPS via SSH:**
```bash
ssh usuario@sua-vps-ip
```

**Execute os comandos:**
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências básicas
sudo apt install -y curl wget git unzip nginx

# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2
sudo npm install -g pm2

# Criar diretório do projeto
sudo mkdir -p /var/www/triagem
sudo chown $USER:$USER /var/www/triagem

# Clonar seu repositório
cd /var/www/triagem
git clone https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git .

# Instalar dependências
npm install

# Criar arquivo .env
nano .env
```

**Conteúdo do .env:**
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-do-supabase
```

### 4. **Configurar Nginx**

```bash
# Criar configuração do site
sudo nano /etc/nginx/sites-available/triagem
```

**Conteúdo da configuração:**
```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;
    
    root /var/www/triagem/dist;
    index index.html;
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache para assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Webhook endpoint
    location /webhook {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Rotas do app
    location /agendar {
        try_files $uri $uri/ /index.html;
    }
    
    location /album/ {
        try_files $uri $uri/ /index.html;
    }
}
```

**Ativar o site:**
```bash
# Ativar configuração
sudo ln -sf /etc/nginx/sites-available/triagem /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Testar e recarregar
sudo nginx -t
sudo systemctl reload nginx
```

### 5. **Configurar Deploy Automático**

```bash
# Instalar express para webhook
cd /var/www/triagem
npm install express

# Gerar secret para webhook
WEBHOOK_SECRET=$(openssl rand -hex 32)
echo "Secret gerado: $WEBHOOK_SECRET"

# Configurar PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 6. **Fazer Build Inicial**

```bash
cd /var/www/triagem
npm run build
sudo systemctl reload nginx
```

### 7. **Configurar GitHub Secrets**

**No seu repositório GitHub, vá em Settings > Secrets and variables > Actions:**

Adicione estes secrets:
```
VPS_HOST=seu-vps-ip
VPS_USERNAME=seu-usuario-ssh
VPS_SSH_KEY=sua-chave-privada-ssh-completa
VPS_PORT=22
VPS_DOMAIN=seu-dominio.com
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
```

### 8. **Configurar Webhook no GitHub**

**No repositório, vá em Settings > Webhooks > Add webhook:**
```
Payload URL: http://seu-vps-ip:3001/deploy
Content type: application/json
Secret: o-secret-gerado-no-passo-5
Events: Just the push event
Active: ✅
```

## 🧪 Testar o Sistema

### 1. **Teste Manual:**
```bash
# Na VPS
cd /var/www/triagem
bash deploy-vps.sh
```

### 2. **Teste Automático:**
- Faça uma mudança no Bolt
- Commit e push
- Aguarde 2-3 minutos
- Acesse: `http://seu-vps-ip`

## 📊 Monitoramento

```bash
# Status do webhook
curl http://seu-vps-ip:3001/health

# Logs do webhook
pm2 logs triagem-webhook

# Logs do deploy
curl http://seu-vps-ip:3001/logs

# Status do Nginx
sudo systemctl status nginx
```

## 🔧 Comandos Úteis

```bash
# Deploy manual
cd /var/www/triagem && bash deploy-vps.sh

# Reiniciar webhook
pm2 restart triagem-webhook

# Ver logs em tempo real
pm2 logs --lines 50

# Recarregar Nginx
sudo systemctl reload nginx
```

## 🎯 URLs Finais

Após configurar:
- **Site**: `http://seu-vps-ip`
- **Agendamento**: `http://seu-vps-ip/agendar`
- **Webhook Status**: `http://seu-vps-ip:3001/health`

## ⚠️ Importante

1. **Substitua** `seu-vps-ip`, `seu-usuario`, `SEU-USUARIO/SEU-REPOSITORIO` pelos valores reais
2. **Configure SSL** depois com Let's Encrypt para HTTPS
3. **Teste** o webhook fazendo um commit pequeno primeiro

**🎉 Resultado:** Toda mudança no Bolt será automaticamente deployada na sua VPS!