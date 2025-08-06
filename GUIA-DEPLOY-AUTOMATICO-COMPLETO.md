# 🚀 Guia Completo: Deploy Automático na VPS

## 📋 Processo Completo (3 Passos)

### **Passo 1: Configurar VPS**

**Na sua VPS, execute:**
```bash
# Baixar e executar script
curl -sSL https://raw.githubusercontent.com/valdigley/triagem-app/main/setup-vps-completo.sh | bash
```

**O script vai:**
- ✅ Instalar Node.js, PM2, Nginx
- ✅ Clonar seu repositório
- ✅ Configurar webhook automático
- ✅ Fazer build inicial
- ✅ Configurar Nginx
- ✅ Gerar secret para GitHub

### **Passo 2: Upload do Código**

**No Bolt:**
1. Clique em **Download** (canto superior direito)
2. Extraia o ZIP no seu computador
3. Suba para o GitHub:

```bash
# Na pasta extraída do Bolt:
git init
git add .
git commit -m "Deploy inicial do sistema Triagem"
git branch -M main
git remote add origin https://github.com/valdigley/triagem-app.git
git push -u origin main
```

### **Passo 3: Configurar Webhook no GitHub**

**No GitHub:**
1. Vá em: https://github.com/valdigley/triagem-app/settings/hooks
2. Clique em **Add webhook**
3. Configure:
   ```
   Payload URL: http://SEU-VPS-IP:3001/deploy
   Content type: application/json
   Secret: (o secret que o script gerou)
   Events: Just the push event
   Active: ✅
   ```

## 🎯 Como Funciona Depois:

### **Fluxo Automático:**
1. **Bolt** → Faça mudanças
2. **Download** → Baixe projeto atualizado
3. **Git** → Commit e push
4. **GitHub** → Notifica VPS via webhook
5. **VPS** → Pull + Build + Deploy automático

### **Comandos para Atualizações:**
```bash
# Na pasta do projeto (seu computador):
git add .
git commit -m "Atualização do sistema"
git push origin main

# Deploy acontece automaticamente em 1-2 minutos!
```

## 📊 Monitoramento:

```bash
# Status do webhook
curl http://SEU-VPS-IP:3001/health

# Logs do deploy
curl http://SEU-VPS-IP:3001/logs

# Status PM2
pm2 status

# Logs em tempo real
pm2 logs triagem-webhook
```

## 🔧 URLs Importantes:

- **Site**: `http://SEU-VPS-IP`
- **Agendamento**: `http://SEU-VPS-IP/agendar`
- **Webhook Status**: `http://SEU-VPS-IP:3001/health`
- **GitHub Webhook**: https://github.com/valdigley/triagem-app/settings/hooks

## ⚡ Teste Rápido:

Após configurar tudo:
1. Faça uma pequena mudança no Bolt
2. Download → Commit → Push
3. Aguarde 1-2 minutos
4. Acesse seu site para ver a mudança

**🎉 Pronto! Deploy 100% automático configurado!**

## 🆘 Troubleshooting:

### Webhook não funciona:
```bash
pm2 logs triagem-webhook
sudo ufw status
```

### Site não atualiza:
```bash
cd /var/www/triagem-app
bash deploy-vps.sh
```

### Nginx com problema:
```bash
sudo nginx -t
sudo systemctl status nginx
```