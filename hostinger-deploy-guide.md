# 🚀 Guia de Deploy no Hostinger

## 📋 Pré-requisitos

Antes de começar, você precisa:
- ✅ Conta no Hostinger com hospedagem web
- ✅ Projeto funcionando localmente
- ✅ Supabase configurado e funcionando
- ✅ Domínio configurado (opcional, mas recomendado)

## 🎯 Opções de Deploy

### Opção 1: Deploy Manual (Mais Simples)
### Opção 2: Deploy via Git (Recomendado)
### Opção 3: Deploy Automático via GitHub Actions

---

## 🔧 Opção 1: Deploy Manual

### Passo 1: Preparar o Build Local
```bash
# No seu computador, dentro da pasta do projeto
npm install
npm run build
```

### Passo 2: Configurar Variáveis de Ambiente
Crie um arquivo `.env.production` na raiz do projeto:
```env
VITE_SUPABASE_URL=https://iisejjtimakkwjrbmzvj.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-do-supabase
```

### Passo 3: Build para Produção
```bash
# Fazer build com variáveis de produção
npm run build
```

### Passo 4: Upload via File Manager
1. **Acesse o hPanel do Hostinger**
2. **Vá em "File Manager"**
3. **Navegue até a pasta `public_html`**
4. **Delete todos os arquivos existentes** (se houver)
5. **Faça upload de todos os arquivos da pasta `dist/`**
6. **Certifique-se que o arquivo `index.html` está na raiz**

### Passo 5: Configurar Redirecionamentos
Crie um arquivo `.htaccess` na pasta `public_html`:
```apache
# Redirecionamentos para SPA (Single Page Application)
RewriteEngine On
RewriteBase /

# Handle Angular and Vue.js routes
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# Cache para assets estáticos
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>

# Compressão gzip
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Headers de segurança
<IfModule mod_headers.c>
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
```

---

## 🔧 Opção 2: Deploy via Git (Recomendado)

### Passo 1: Configurar Git no Hostinger
1. **Acesse o hPanel**
2. **Vá em "Git"** (se disponível no seu plano)
3. **Conecte seu repositório GitHub/GitLab**

### Passo 2: Criar Script de Build
Crie um arquivo `build-hostinger.sh` na raiz do projeto:
```bash
#!/bin/bash

echo "🚀 Iniciando build para Hostinger..."

# Instalar dependências
npm ci

# Fazer build
npm run build

# Copiar arquivos para public_html
cp -r dist/* public_html/

# Criar .htaccess se não existir
if [ ! -f "public_html/.htaccess" ]; then
    cp .htaccess public_html/
fi

echo "✅ Build concluído!"
```

### Passo 3: Configurar Webhook (se disponível)
No seu repositório GitHub, configure um webhook para:
```
URL: https://seudominio.com/deploy-webhook.php
```

---

## 🔧 Opção 3: Deploy Automático via GitHub Actions

### Passo 1: Criar Workflow do GitHub
Crie `.github/workflows/deploy-hostinger.yml`:
```yaml
name: Deploy to Hostinger

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build project
      run: npm run build
      env:
        VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
        VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
    
    - name: Deploy to Hostinger via FTP
      uses: SamKirkland/FTP-Deploy-Action@4.3.3
      with:
        server: ${{ secrets.FTP_SERVER }}
        username: ${{ secrets.FTP_USERNAME }}
        password: ${{ secrets.FTP_PASSWORD }}
        local-dir: ./dist/
        server-dir: /public_html/
```

### Passo 2: Configurar Secrets no GitHub
No seu repositório GitHub, vá em **Settings > Secrets and variables > Actions** e adicione:
- `VITE_SUPABASE_URL`: URL do seu Supabase
- `VITE_SUPABASE_ANON_KEY`: Chave anônima do Supabase
- `FTP_SERVER`: Servidor FTP do Hostinger
- `FTP_USERNAME`: Usuário FTP
- `FTP_PASSWORD`: Senha FTP

---

## 🌐 Configuração de Domínio

### Passo 1: Configurar DNS (se usar domínio próprio)
No painel do seu domínio, configure:
```
A     @              IP-DO-HOSTINGER
A     www            IP-DO-HOSTINGER
CNAME triagem        seudominio.com
```

### Passo 2: Configurar SSL
1. **No hPanel, vá em "SSL/TLS"**
2. **Ative "Force HTTPS"**
3. **Configure certificado Let's Encrypt** (gratuito)

---

## ⚙️ Configurações Específicas do Hostinger

### Arquivo de Configuração PHP (se necessário)
Crie `public_html/index.php`:
```php
<?php
// Redirecionar tudo para index.html (SPA)
if (!file_exists(__DIR__ . $_SERVER['REQUEST_URI'])) {
    include __DIR__ . '/index.html';
    exit;
}
?>
```

### Configuração de Node.js (Planos Premium)
Se seu plano suporta Node.js:
```json
{
  "name": "triagem-hostinger",
  "version": "1.0.0",
  "scripts": {
    "start": "serve -s dist -l 3000",
    "build": "npm run build"
  },
  "dependencies": {
    "serve": "^14.0.0"
  }
}
```

---

## 🔄 Script de Deploy Automático

Crie `deploy-hostinger.js` para automatizar o processo:
```javascript
const FtpDeploy = require('ftp-deploy');
const ftpDeploy = new FtpDeploy();

const config = {
    user: process.env.FTP_USER || 'seu-usuario-ftp',
    password: process.env.FTP_PASSWORD || 'sua-senha-ftp',
    host: process.env.FTP_HOST || 'ftp.hostinger.com',
    port: 21,
    localRoot: __dirname + '/dist/',
    remoteRoot: '/public_html/',
    include: ['*', '**/*'],
    exclude: [
        'dist/**/*.map',
        'node_modules/**',
        'node_modules/**/.*',
        '.git/**'
    ],
    deleteRemote: false,
    forcePasv: true,
    sftp: false
};

ftpDeploy.deploy(config)
    .then(res => console.log('✅ Deploy concluído:', res))
    .catch(err => console.log('❌ Erro no deploy:', err));
```

Para usar:
```bash
npm install ftp-deploy
node deploy-hostinger.js
```

---

## 🛠️ Troubleshooting

### Problema: Rotas não funcionam
**Solução:** Verifique se o arquivo `.htaccess` está correto e na pasta `public_html`

### Problema: Assets não carregam
**Solução:** Verifique se todos os arquivos da pasta `dist/assets/` foram enviados

### Problema: Erro 500
**Solução:** Verifique os logs de erro no hPanel e a configuração do `.htaccess`

### Problema: HTTPS não funciona
**Solução:** Configure SSL no hPanel e force HTTPS

---

## 📱 Teste Final

Após o deploy, teste:
1. **Página principal:** `https://seudominio.com`
2. **Rota de agendamento:** `https://seudominio.com/agendar`
3. **Rota de álbum:** `https://seudominio.com/album/token-teste`
4. **Login e funcionalidades**

---

## 🔧 Comandos Úteis

### Build e Deploy Manual
```bash
# Build local
npm run build

# Compactar para upload
zip -r triagem-build.zip dist/*

# Upload via FTP (usando lftp)
lftp -u usuario,senha ftp.hostinger.com -e "mirror -R dist/ public_html/; quit"
```

### Verificar Status
```bash
# Testar se o site está online
curl -I https://seudominio.com

# Verificar redirecionamentos
curl -I https://seudominio.com/agendar
```

---

## 💡 Dicas Importantes

1. **Sempre faça backup** antes de fazer deploy
2. **Teste localmente** antes de enviar para produção
3. **Use HTTPS** sempre em produção
4. **Configure cache** para melhor performance
5. **Monitore logs** de erro no hPanel
6. **Mantenha as variáveis de ambiente seguras**

---

## 📞 Suporte

Se encontrar problemas:
1. **Verifique os logs** no hPanel > Error Logs
2. **Teste as URLs** diretamente no navegador
3. **Verifique se o Supabase** está acessível
4. **Confirme se todas as variáveis** estão configuradas

**🎉 Pronto!** Seu sistema estará rodando no Hostinger em `https://seudominio.com`