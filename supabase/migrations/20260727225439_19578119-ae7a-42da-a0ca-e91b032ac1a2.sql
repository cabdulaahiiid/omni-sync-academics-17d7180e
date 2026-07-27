-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS audit_logs_timestamp_idx ON public.audit_logs ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs (action_type);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id);

-- Grants: append-only for authenticated users
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- Policies
DROP POLICY IF EXISTS "audit MA all" ON public.audit_logs;
DROP POLICY IF EXISTS "audit MA read" ON public.audit_logs;
DROP POLICY IF EXISTS "audit self insert" ON public.audit_logs;

CREATE POLICY "audit MA read"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'MA'::app_role));

CREATE POLICY "audit self insert"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- Immutability: no updates, no deletes, ever
CREATE OR REPLACE FUNCTION public.audit_logs_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are append-only and cannot be % ', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_no_update ON public.audit_logs;
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_immutable();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON public.audit_logs;
CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_immutable();

REVOKE EXECUTE ON FUNCTION public.audit_logs_immutable() FROM anon, public;