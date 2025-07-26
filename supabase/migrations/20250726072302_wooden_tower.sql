/*
  # Configurar agendamento automático de lembretes por email
  
  1. Cron Job
    - Executa a cada hora durante o dia (8h às 18h)
    - Chama a função de lembretes por email
    - Processa eventos do dia seguinte e do dia atual
  
  2. Configuração
    - Lembretes de 1 dia antes: qualquer hora
    - Lembretes do dia: apenas entre 8h e 10h
    - Logs de execução salvos automaticamente
*/

-- Criar extensão pg_cron se não existir (apenas em produção)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar execução da função de lembretes por email
-- Executa a cada hora das 8h às 18h (horário do servidor)
-- SELECT cron.schedule(
--   'email-reminders-hourly',
--   '0 8-18 * * *',
--   $$
--   SELECT
--     net.http_post(
--       url := 'https://your-project.supabase.co/functions/v1/schedule-email-reminders',
--       headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--       body := '{}'::jsonb
--     ) as request_id;
--   $$
-- );

-- Para desenvolvimento local, você pode testar manualmente:
-- curl -X POST "http://localhost:54321/functions/v1/schedule-email-reminders" \
--   -H "Authorization: Bearer YOUR_ANON_KEY" \
--   -H "Content-Type: application/json"

-- Verificar jobs agendados:
-- SELECT * FROM cron.job;

-- Remover job se necessário:
-- SELECT cron.unschedule('email-reminders-hourly');

-- Criar índices para otimizar consultas de lembretes
CREATE INDEX IF NOT EXISTS idx_events_reminder_lookup 
ON events (event_date, status) 
WHERE status = 'scheduled';

-- Comentário explicativo sobre configuração manual necessária
COMMENT ON TABLE events IS 'Para ativar lembretes automáticos por email, configure o cron job no Supabase Dashboard ou use um serviço externo como GitHub Actions para chamar a função schedule-email-reminders regularmente.';