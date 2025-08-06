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
        WEBHOOK_SECRET: 'seu-webhook-secret-aqui',
        PROJECT_PATH: '/var/www/sites/triagem.site/triagem-main'
      },
      error_file: '/var/log/pm2/triagem-webhook-error.log',
      out_file: '/var/log/pm2/triagem-webhook-out.log',
      log_file: '/var/log/pm2/triagem-webhook.log',
      time: true
    }
  ]
};