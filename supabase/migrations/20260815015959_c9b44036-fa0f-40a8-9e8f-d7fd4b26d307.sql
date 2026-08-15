ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

CREATE TABLE public.external_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  role_title text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX external_contacts_phone_active_uidx ON public.external_contacts (phone) WHERE active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_contacts TO authenticated;
GRANT ALL ON public.external_contacts TO service_role;
ALTER TABLE public.external_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MA manage external contacts" ON public.external_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'MA')) WITH CHECK (public.has_role(auth.uid(), 'MA'));

CREATE TABLE public.sms_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid,
  sender_name text,
  message text NOT NULL,
  groups text[] NOT NULL DEFAULT '{}',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDING',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_campaigns TO authenticated;
GRANT ALL ON public.sms_campaigns TO service_role;
ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MA manage sms campaigns" ON public.sms_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'MA')) WITH CHECK (public.has_role(auth.uid(), 'MA'));

CREATE TABLE public.sms_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.sms_campaigns(id) ON DELETE CASCADE,
  contact_name text,
  phone text NOT NULL,
  source_group text,
  status text NOT NULL DEFAULT 'PENDING',
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sms_recipients_campaign_idx ON public.sms_recipients (campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_recipients TO authenticated;
GRANT ALL ON public.sms_recipients TO service_role;
ALTER TABLE public.sms_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MA manage sms recipients" ON public.sms_recipients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'MA')) WITH CHECK (public.has_role(auth.uid(), 'MA'));

CREATE OR REPLACE FUNCTION public.set_updated_at_ts() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER update_external_contacts_updated_at BEFORE UPDATE ON public.external_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts();
CREATE TRIGGER update_sms_campaigns_updated_at BEFORE UPDATE ON public.sms_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts();