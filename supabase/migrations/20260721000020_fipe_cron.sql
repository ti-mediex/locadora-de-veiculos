-- Agendamento mensal da atualização do valor FIPE de toda a frota.
-- Executa no dia 1 de cada mês (06:00 UTC) chamando a Edge Function fipe-update.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior (idempotente).
select cron.unschedule('fipe-mensal')
where exists (select 1 from cron.job where jobname = 'fipe-mensal');

select cron.schedule(
  'fipe-mensal',
  '0 6 1 * *',
  $$
    select net.http_post(
      url := 'https://iqlhnhlvhkkfsryxvyfa.supabase.co/functions/v1/fipe-update',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer sb_publishable_9S_hMChWbIqI6v29emczHg_APL5T4Aj'
      ),
      body := jsonb_build_object('all', true),
      timeout_milliseconds := 240000
    );
  $$
);
