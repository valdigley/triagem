// Configuração PM2 para Triagem
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
        PORT: 3001
      },
      error_file: './logs/webhook-err.log',
      out_file: './logs/webhook-out.log',
      log_file: './logs/webhook-combined.log',
      time: true
    }
  ]
};