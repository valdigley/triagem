# Guia de Deploy no VPS

## 🚀 Preparação do VPS

### 1. Requisitos do Servidor
```bash
# Ubuntu 20.04+ ou CentOS 7+
# Mínimo: 2GB RAM, 20GB disco
# Node.js 18+, Nginx, PM2
```

### 2. Instalação das Dependências
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2 (gerenciador de processos)
sudo npm install -g pm2

# Instalar Nginx
sudo apt install nginx -y

# Instalar Git
sudo apt install git -y
```

## 📁 Deploy do Frontend

### 1. Clonar e Configurar o Projeto
```bash
# Conectar no VPS via SSH
ssh usuario@seu-vps-ip

# Criar diretório para o projeto
sudo mkdir -p /var/www/triagem
sudo chown $USER:$USER /var/www/triagem

# Clonar o projeto (ou fazer upload dos arquivos)
cd /var/www/triagem
git clone seu-repositorio .

# Instalar dependências
npm install
```

### 2. Configurar Variáveis de Ambiente
```bash
# Criar arquivo .env
nano .env
```

Conteúdo do `.env`:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
VITE_N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/triagem
```

### 3. Build do Projeto
```bash
# Fazer build para produção
npm run build

# Verificar se a pasta dist foi criada
ls -la dist/
```

### 4. Configurar Nginx
```bash
# Criar configuração do site
sudo nano /etc/nginx/sites-available/triagem
```

Conteúdo da configuração:
```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;
    
    root /var/www/triagem/dist;
    index index.html;
    
    # Configuração para SPA (Single Page Application)
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache para assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Compressão gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
```

### 5. Ativar o Site
```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/triagem /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 🔒 Configurar HTTPS (SSL)

### 1. Instalar Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Obter Certificado SSL
```bash
sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com
```

## 🔄 Deploy Automático com PM2

### 1. Criar Script de Deploy
```bash
nano deploy.sh
```

Conteúdo do `deploy.sh`:
```bash
#!/bin/bash

echo "🚀 Iniciando deploy..."

# Parar processos antigos
pm2 stop triagem-build 2>/dev/null || true

# Atualizar código
git pull origin main

# Instalar dependências
npm install

# Fazer build
npm run build

# Iniciar processo de build watch (opcional)
pm2 start npm --name "triagem-build" -- run build:watch 2>/dev/null || true

# Recarregar Nginx
sudo systemctl reload nginx

echo "✅ Deploy concluído!"
```

### 2. Tornar Executável
```bash
chmod +x deploy.sh
```

## 🌐 Configuração de Domínio

### 1. DNS
Configure os registros DNS do seu domínio:
```
A     @              SEU-VPS-IP
A     www            SEU-VPS-IP
CNAME triagem        seu-dominio.com
```

### 2. Subdomínio para API (opcional)
Se quiser usar subdomínio para as edge functions:
```
CNAME api            seu-dominio.com
```

## 🔧 Edge Functions (Supabase)

As edge functions continuam rodando no Supabase, mas você pode configurar um proxy:

### 1. Proxy para Edge Functions
Adicione no Nginx:
```nginx
# Adicionar dentro do bloco server
location /api/ {
    proxy_pass https://seu-projeto.supabase.co/functions/v1/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 2. Atualizar URLs no Frontend
```bash
# Atualizar .env para usar proxy local
VITE_SUPABASE_URL=https://seu-dominio.com/api
```

## 📊 Monitoramento

### 1. Configurar PM2 Monitoring
```bash
# Salvar configuração atual
pm2 save

# Configurar inicialização automática
pm2 startup

# Monitorar logs
pm2 logs

# Status dos processos
pm2 status
```

### 2. Logs do Nginx
```bash
# Logs de acesso
sudo tail -f /var/log/nginx/access.log

# Logs de erro
sudo tail -f /var/log/nginx/error.log
```

## 🔄 Atualizações Automáticas

### 1. Webhook para Deploy Automático
Crie um endpoint para receber webhooks do Git:

```bash
nano webhook-deploy.js
```

```javascript
const express = require('express');
const { exec } = require('child_process');
const app = express();

app.use(express.json());

app.post('/deploy', (req, res) => {
    console.log('Deploy webhook received');
    
    exec('cd /var/www/triagem && ./deploy.sh', (error, stdout, stderr) => {
        if (error) {
            console.error('Deploy error:', error);
            return res.status(500).json({ error: error.message });
        }
        
        console.log('Deploy output:', stdout);
        res.json({ success: true, output: stdout });
    });
});

app.listen(3001, () => {
    console.log('Webhook server running on port 3001');
});
```

### 2. Executar Webhook Server
```bash
# Instalar dependências
npm install express

# Executar com PM2
pm2 start webhook-deploy.js --name "triagem-webhook"
```

## 🛡️ Segurança

### 1. Firewall
```bash
# Configurar UFW
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 3001  # Se usar webhook
```

### 2. Backup Automático
```bash
# Criar script de backup
nano backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/triagem"

mkdir -p $BACKUP_DIR

# Backup do código
tar -czf $BACKUP_DIR/code_$DATE.tar.gz /var/www/triagem

# Backup do banco (se usar PostgreSQL local)
# pg_dump triagem > $BACKUP_DIR/db_$DATE.sql

echo "Backup criado: $DATE"
```

### 3. Cron para Backup
```bash
# Editar crontab
crontab -e

# Adicionar linha para backup diário às 2h
0 2 * * * /var/www/triagem/backup.sh
```

## 📱 Configuração Final

### 1. Testar o Sistema
```bash
# Verificar se o site está acessível
curl -I http://seu-dominio.com

# Verificar HTTPS
curl -I https://seu-dominio.com

# Testar rotas da API
curl https://seu-dominio.com/api/health
```

### 2. Configurar Monitoramento
- Configure alertas para quando o site ficar fora do ar
- Use ferramentas como UptimeRobot ou Pingdom
- Configure notificações por email/WhatsApp

## 🚨 Troubleshooting

### Problemas Comuns:

1. **Site não carrega:**
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   sudo journalctl -u nginx
   ```

2. **Erro 502 Bad Gateway:**
   ```bash
   pm2 status
   pm2 logs
   ```

3. **SSL não funciona:**
   ```bash
   sudo certbot renew --dry-run
   sudo systemctl status certbot.timer
   ```

4. **Build falha:**
   ```bash
   npm run build
   # Verificar erros no console
   ```

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs: `pm2 logs` e `sudo journalctl -u nginx`
2. Teste as configurações: `sudo nginx -t`
3. Verifique o status dos serviços: `sudo systemctl status nginx`
4. Monitore recursos: `htop` ou `free -h`

---

**🎉 Pronto!** Seu sistema estará rodando em `https://seu-dominio.com`