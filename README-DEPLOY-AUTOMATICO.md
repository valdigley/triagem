# 🚀 Deploy Automático via Git para VPS

Este guia configura deploy automático do projeto para sua VPS usando GitHub Actions e webhooks.

## 📋 Pré-requisitos

- ✅ VPS com Ubuntu/Debian
- ✅ Node.js 18+ instalado
- ✅ Nginx instalado
- ✅ PM2 instalado
- ✅ Repositório Git (GitHub/GitLab)
- ✅ Acesso SSH à VPS

## 🎯 Processo Completo

### Passo 1: Criar Repositório
1. **GitHub**: Criar novo repositório
2. **Bolt**: Conectar ao GitHub e fazer push
3. **VPS**: Executar script de configuração
4. **GitHub**: Configurar webhook e secrets

## 🔧 Configuração na VPS

### 1. Download e Execução Manual
```bash
# Conectar na VPS via SSH
ssh usuario@sua-vps

# Baixar script do seu repositório (substitua SEU-USUARIO e NOME-DO-REPO)
wget https://raw.githubusercontent.com/SEU-USUARIO/NOME-DO-REPO/main/setup-vps-manual.sh

# Executar
bash setup-vps-manual.sh
```

### 2. Ou Configuração Manual Completa
Siga o arquivo `GUIA-DEPLOY-VPS.md` para configuração passo-a-passo.

### 2. Configurar Variáveis de Ambiente
```bash
# Editar arquivo .env
nano /var/www/triagem/.env
```

Adicione suas credenciais:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-do-supabase
```

## 🔗 Configuração no GitHub

### 1. Configurar Secrets
Vá em **Settings > Secrets and variables > Actions** e adicione:

```
VPS_HOST=seu-vps-ip-ou-dominio
VPS_USERNAME=seu-usuario-ssh
VPS_SSH_KEY=sua-chave-privada-ssh
VPS_PORT=22
VPS_DOMAIN=seu-dominio.com
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
```

### 2. Configurar Webhook
Vá em **Settings > Webhooks > Add webhook**:

```
Payload URL: http://seu-vps:3001/deploy
Content type: application/json
Secret: o-secret-gerado-pelo-script
Events: Just the push event
Active: ✅
```

## 🚀 Como Funciona

### Fluxo Automático:
1. **Bolt** → Commit/Push para GitHub
2. **GitHub Actions** → Build do projeto
3. **SSH Deploy** → Envia para VPS
4. **Webhook** → Notifica VPS
5. **VPS** → Pull + Build + Reload Nginx

### Comandos Automáticos na VPS:
```bash
cd /var/www/triagem
git pull origin main
npm ci
npm run build
sudo systemctl reload nginx
```

## 📊 Monitoramento

### Verificar Status
```bash
# Status do webhook
curl http://seu-vps:3001/health

# Logs do webhook
pm2 logs triagem-webhook

# Status do PM2
pm2 status

# Logs do Nginx
sudo tail -f /var/log/nginx/access.log
```

### Logs de Deploy
```bash
# Ver último deploy
curl http://seu-vps:3001/logs

# Logs detalhados
cat /var/www/triagem/deploy-success.log
cat /var/www/triagem/deploy-error.log
```

## 🛠️ Troubleshooting

### Webhook não funciona:
```bash
# Verificar se está rodando
pm2 status

# Reiniciar webhook
pm2 restart triagem-webhook

# Verificar firewall
sudo ufw status
sudo ufw allow 3001/tcp
```

### Deploy falha:
```bash
# Verificar logs
pm2 logs triagem-webhook

# Deploy manual
cd /var/www/triagem
bash deploy-vps.sh

# Verificar permissões
ls -la /var/www/triagem
sudo chown -R $USER:$USER /var/www/triagem
```

### Site não carrega:
```bash
# Verificar Nginx
sudo nginx -t
sudo systemctl status nginx
sudo systemctl reload nginx

# Verificar build
ls -la /var/www/triagem/dist/
```

## 🔄 Fluxo de Desenvolvimento

### No Bolt:
1. Faça suas alterações
2. Commit e push para GitHub
3. GitHub Actions faz build automaticamente
4. VPS recebe webhook e atualiza

### Verificação:
1. Acesse: `http://seu-dominio.com`
2. Teste: `http://seu-dominio.com/agendar`
3. Verifique logs se necessário

## 🎯 URLs Importantes

- **Site Principal**: `http://seu-dominio.com`
- **Agendamento Público**: `http://seu-dominio.com/agendar`
- **Webhook Status**: `http://seu-dominio.com:3001/health`
- **Logs de Deploy**: `http://seu-dominio.com:3001/logs`

## 🔒 Segurança

- ✅ Webhook protegido por secret
- ✅ Firewall configurado
- ✅ Logs de auditoria
- ✅ Backup automático de builds

## 📱 Teste Rápido

Após configurar, teste fazendo uma pequena alteração no Bolt:

1. Edite qualquer arquivo
2. Commit no Bolt
3. Aguarde 2-3 minutos
4. Acesse seu site para ver a mudança

**🎉 Pronto!** Agora toda mudança no Bolt será automaticamente deployada na sua VPS!