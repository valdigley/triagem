const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware para parsing JSON
app.use(express.json({ limit: '10mb' }));

// Middleware de logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
    next();
});

// Criar diretório de logs se não existir
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Função para log com timestamp
const log = (message, type = 'INFO') => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type}] ${message}`;
    console.log(logMessage);
    
    // Salvar em arquivo
    fs.appendFileSync(
        path.join(logsDir, 'webhook.log'), 
        logMessage + '\n'
    );
};

// Verificar se o webhook é válido (opcional - para GitHub/GitLab)
const verifyWebhook = (req, res, next) => {
    const secret = process.env.WEBHOOK_SECRET;
    
    if (!secret) {
        // Se não há secret configurado, pular verificação
        return next();
    }
    
    const signature = req.headers['x-hub-signature-256'] || req.headers['x-gitlab-token'];
    
    if (!signature) {
        log('Webhook sem assinatura', 'WARN');
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Verificar assinatura (GitHub)
    if (req.headers['x-hub-signature-256']) {
        const hmac = crypto.createHmac('sha256', secret);
        const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
        
        if (signature !== digest) {
            log('Assinatura inválida', 'ERROR');
            return res.status(401).json({ error: 'Invalid signature' });
        }
    }
    
    next();
};

// Endpoint de health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Endpoint principal de deploy
app.post('/deploy', verifyWebhook, (req, res) => {
    log('Deploy webhook recebido', 'INFO');
    
    // Log do payload (sem dados sensíveis)
    const safePayload = {
        repository: req.body.repository?.name || 'unknown',
        ref: req.body.ref || req.body.checkout_sha || 'unknown',
        pusher: req.body.pusher?.name || req.body.user_name || 'unknown'
    };
    log(`Payload: ${JSON.stringify(safePayload)}`, 'INFO');
    
    // Verificar se é push para branch main/master
    const ref = req.body.ref || '';
    if (ref && !ref.includes('main') && !ref.includes('master')) {
        log(`Ignorando push para branch: ${ref}`, 'INFO');
        return res.json({ message: 'Branch ignorada', ref });
    }
    
    // Executar deploy
    const deployCommand = 'cd /var/www/triagem && ./deploy.sh';
    
    log('Iniciando processo de deploy...', 'INFO');
    
    exec(deployCommand, { timeout: 300000 }, (error, stdout, stderr) => {
        if (error) {
            log(`Erro no deploy: ${error.message}`, 'ERROR');
            log(`stderr: ${stderr}`, 'ERROR');
            return res.status(500).json({ 
                error: error.message, 
                stderr: stderr.substring(0, 1000) // Limitar tamanho
            });
        }
        
        log('Deploy concluído com sucesso', 'INFO');
        log(`stdout: ${stdout.substring(0, 1000)}`, 'INFO'); // Limitar tamanho
        
        res.json({ 
            success: true, 
            message: 'Deploy executado com sucesso',
            timestamp: new Date().toISOString(),
            output: stdout.substring(0, 500) // Resumo da saída
        });
    });
});

// Endpoint para logs (protegido)
app.get('/logs', (req, res) => {
    const token = req.headers.authorization;
    const expectedToken = process.env.LOGS_TOKEN || 'admin123';
    
    if (token !== `Bearer ${expectedToken}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const logFile = path.join(logsDir, 'webhook.log');
        if (fs.existsSync(logFile)) {
            const logs = fs.readFileSync(logFile, 'utf8');
            const lines = logs.split('\n').slice(-100); // Últimas 100 linhas
            res.json({ logs: lines });
        } else {
            res.json({ logs: ['Nenhum log encontrado'] });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Middleware de erro
app.use((error, req, res, next) => {
    log(`Erro não tratado: ${error.message}`, 'ERROR');
    res.status(500).json({ error: 'Internal server error' });
});

// Iniciar servidor
app.listen(PORT, () => {
    log(`Webhook server rodando na porta ${PORT}`, 'INFO');
    log(`Health check: http://localhost:${PORT}/health`, 'INFO');
    log(`Deploy endpoint: http://localhost:${PORT}/deploy`, 'INFO');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    log('Recebido SIGTERM, encerrando servidor...', 'INFO');
    process.exit(0);
});

process.on('SIGINT', () => {
    log('Recebido SIGINT, encerrando servidor...', 'INFO');
    process.exit(0);
});