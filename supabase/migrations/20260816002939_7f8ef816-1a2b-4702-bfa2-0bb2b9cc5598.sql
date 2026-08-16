CREATE TABLE IF NOT EXISTS public.sms_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key text,
  sender_id text,
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('development','production')),
  prod_base_url text NOT NULL DEFAULT 'https://api.smsethiopia.com/api/send',
  dev_base_url text NOT NULL DEFAULT 'https://api.smsethiopia.com/api/send',
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.sms_settings TO authenticated;
GRANT ALL ON public.sms_settings TO service_role;
ALTER TABLE public.sms_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "MA manage sms settings" ON public.sms_settings;
CREATE POLICY "MA manage sms settings" ON public.sms_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'MA'))
  WITH CHECK (public.has_role(auth.uid(), 'MA'));

DROP TRIGGER IF EXISTS set_sms_settings_updated_at ON public.sms_settings;
CREATE TRIGGER set_sms_settings_updated_at
  BEFORE UPDATE ON public.sms_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts();

ALTER TABLE public.sms_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS environment text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS sms_campaigns_due_idx
  ON public.sms_campaigns (scheduled_at)
  WHERE status = 'SCHEDULED';

CREATE TABLE IF NOT EXISTS public.sms_scheduled_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.sms_campaigns(id) ON DELETE CASCADE,
  contact_name text,
  phone text NOT NULL,
  source_group text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_scheduled_recipients_campaign_idx
  ON public.sms_scheduled_recipients (campaign_id);

GRANT SELECT ON public.sms_scheduled_recipients TO authenticated;
GRANT ALL ON public.sms_scheduled_recipients TO service_role;
ALTER TABLE public.sms_scheduled_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "MA read scheduled recipients" ON public.sms_scheduled_recipients;
CREATE POLICY "MA read scheduled recipients" ON public.sms_scheduled_recipients
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'MA'));

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('sms-dispatch-due') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sms-dispatch-due');

SELECT cron.schedule(
  'sms-dispatch-due',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--16267a41-18fb-4638-917c-8e52fc4e5d2b.lovable.app/api/public/sms-dispatch',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53Z21rZGRjZGlqdnZxenRjYWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NTk5NjIsImV4cCI6MjA5NDQzNTk2Mn0.O5ERgsBm6wpIrlDnINSMPYWyMRBCs6zt_WpNmL9uofo"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);