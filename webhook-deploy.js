const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.WEBHOOK_PORT || 3001;
const SECRET = process.env.WEBHOOK_SECRET || 'seu-webhook-secret-aqui';
const PROJECT_PATH = process.env.PROJECT_PATH || '/var/www/sites/triagem.site/triagem-main';

// Middleware para parsing JSON
app.use(express.json({ limit: '10mb' }));

// Middleware para verificar assinatura do GitHub
const verifySignature = (req, res, next) => {
  const signature = req.get('X-Hub-Signature-256');
  
  if (!signature) {
    console.log('⚠️ Webhook sem assinatura recebido');
    return res.status(401).json({ error: 'Assinatura não fornecida' });
  }

  const body = JSON.stringify(req.body);
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', SECRET)
    .update(body, 'utf8')
    .digest('hex')}`;

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    console.log('❌ Assinatura inválida');
    return res.status(401);
  }

  next();
};

// Log de requisições
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

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
});