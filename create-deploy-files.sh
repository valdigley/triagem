#!/bin/bash

# Script para criar todos os arquivos de deploy diretamente na VPS
# Execute na VPS: bash create-deploy-files.sh

set -e

echo "🚀 Criando arquivos de deploy..."

# Gerar secret
WEBHOOK_SECRET="d662bf126362592df80167816917eca8e73283fa14a93c24bdd861b8ba9d0ed7"
PROJECT_PATH="/var/www/sites/triagem.site/triagem-main"

echo "📁 Diretório do projeto: $PROJECT_PATH"
echo "🔑 Secret: $WEBHOOK_SECRET"

# Criar ecosystem.config.cjs
cat > ecosystem.config.cjs << EOF
module.exports = {
  apps: [
    {
      name: 'triagem-webhook',
      script: 'webhook-deploy.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        WEBHOOK_PORT: 3001,
        WEBHOOK_SECRET: '$WEBHOOK_SECRET',
        PROJECT_PATH: '$PROJECT_PATH'
      },
      error_file: '/var/log/pm2/triagem-webhook-error.log',
      out_file: '/var/log/pm2/triagem-webhook-out.log',
      log_file: '/var/log/pm2/triagem-webhook.log',
      time: true
    }
  ]
};
EOF

# Criar webhook-deploy.js
cat > webhook-deploy.js << 'EOF'
const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.WEBHOOK_PORT || 3001;
const SECRET = process.env.WEBHOOK_SECRET;
const PROJECT_PATH = process.env.PROJECT_PATH || '/var/www/sites/triagem.site/triagem-main';

app.use(express.json({ limit: '10mb' }));

// Verificar assinatura do GitHub
const verifySignature = (req, res, next) => {
  const signature = req.get('X-Hub-Signature-256');
  
  if (!signature || !SECRET) {
    console.log('⚠️ Webhook sem assinatura');
    return res.status(401).json({ error: 'Assinatura não fornecida' });
  }

  const body = JSON.stringify(req.body);
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', SECRET)
    .update(body, 'utf8')
    .digest('hex')}`;

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    console.log('❌ Assinatura inválida');
    return res.status(401).json({ error: 'Assinatura inválida' });
  }

  next();
};

// Endpoint de saúde
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    project_path: PROJECT_PATH,
    uptime: process.uptime(),
    secret_configured: !!SECRET
  });
});

// Endpoint principal do webhook
app.post('/deploy', verifySignature, (req, res) => {
  const { ref, repository, head_commit } = req.body;
  
  console.log('🔔 Webhook recebido:');
  console.log(`   📂 Repositório: ${repository?.full_name}`);
  console.log(`   🌿 Branch: ${ref}`);
  console.log(`   📝 Commit: ${head_commit?.id?.substring(0, 7)} - ${head_commit?.message}`);

  // Verificar se é push para branch principal
  if (ref !== 'refs/heads/main' && ref !== 'refs/heads/master') {
    console.log(`⏭️ Ignorando push para branch: ${ref}`);
    return res.json({ message: 'Branch ignorada', ref });
  }

  console.log('🚀 Iniciando deploy automático...');
  
  const deployCommand = `cd ${PROJECT_PATH} && bash deploy-vps.sh`;
  
  exec(deployCommand, { timeout: 300000 }, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Erro no deploy:', error.message);
      return res.status(500).json({ 
        error: 'Deploy falhou', 
        details: error.message 
      });
    }

    console.log('✅ Deploy concluído!');
    res.json({ 
      success: true, 
      message: 'Deploy realizado com sucesso',
      commit: head_commit?.id,
      timestamp: new Date().toISOString()
    });
  });
});

// Endpoint para logs
app.get('/logs', (req, res) => {
  try {
    const logPath = path.join(PROJECT_PATH, 'deploy.log');
    if (fs.existsSync(logPath)) {
      const logs = fs.readFileSync(logPath, 'utf8');
      res.json({ logs: logs.split('\n').slice(-50) });
    } else {
      res.json({ logs: ['Nenhum log encontrado'] });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🔗 Webhook server rodando na porta ${PORT}`);
  console.log(`📁 Projeto: ${PROJECT_PATH}`);
  console.log(`🔑 Secret: ${SECRET ? 'Configurado' : 'NÃO CONFIGURADO'}`);
  console.log(`🌐 Endpoints:`);
  console.log(`   • POST /deploy - Webhook do GitHub`);
  console.log(`   • GET /health - Status`);
  console.log(`   • GET /logs - Logs de deploy`);
});
EOF

# Criar deploy-vps.sh
cat > deploy-vps.sh << 'EOF'
#!/bin/bash

echo "🚀 Iniciando deploy..." | tee -a deploy.log

# Fazer backup
if [ -d "dist" ]; then
    mv dist dist.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
fi

# Atualizar código
echo "📥 Atualizando código..." | tee -a deploy.log
git pull origin main

# Instalar dependências
echo "📦 Instalando dependências..." | tee -a deploy.log
npm ci

# Build
echo "🔨 Fazendo build..." | tee -a deploy.log
npm run build

# Recarregar Nginx
echo "🌐 Recarregando Nginx..." | tee -a deploy.log
systemctl reload nginx

echo "✅ Deploy concluído em $(date)" | tee -a deploy.log
EOF

chmod +x deploy-vps.sh

echo "✅ Arquivos criados com sucesso!"
echo ""
echo "🔑 Secret para GitHub webhook:"
echo "$WEBHOOK_SECRET"
echo ""
echo "📝 Configure no GitHub:"
echo "• URL: http://$(hostname -I | awk '{print $1}'):3001/deploy"
echo "• Secret: $WEBHOOK_SECRET"
echo "• Content-Type: application/json"
echo "• Events: Just the push event"