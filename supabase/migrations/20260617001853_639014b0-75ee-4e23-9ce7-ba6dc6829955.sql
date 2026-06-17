
CREATE TABLE public.auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  user_id uuid,
  duration_ms integer,
  attempts integer,
  ok boolean,
  reason text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.auth_events TO authenticated;
GRANT ALL ON public.auth_events TO service_role;
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_events self insert" ON public.auth_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "auth_events MA read" ON public.auth_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'MA'::app_role));
CREATE INDEX auth_events_created_at_idx ON public.auth_events (created_at DESC);
CREATE INDEX auth_events_kind_created_at_idx ON public.auth_events (kind, created_at DESC);
