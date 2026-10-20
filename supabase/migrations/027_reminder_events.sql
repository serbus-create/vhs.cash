-- 027_reminder_events.sql
-- Fronta upomínek ke schválení: jedna událost = jeden milník (1., 8., 15., 22., 30. den po splatnosti) jedné faktury.
-- UNIQUE (invoice_id, milestone) zajišťuje idempotenci (cron smí běžet opakovaně).
-- Stará tabulka reminders zůstává beze změny (historie ručních upomínek).

BEGIN;

CREATE TABLE IF NOT EXISTS public.reminder_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_id          uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  milestone           smallint    NOT NULL CHECK (milestone IN (1, 8, 15, 22, 30)),
  due_date            date        NOT NULL,
  scheduled_for       date        NOT NULL,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'sending', 'sent', 'skipped', 'failed')),
  plan                jsonb,
  subject             text,
  body_text           text,
  body_html           text,
  recipient_email     text,
  skip_reason         text,
  sending_at          timestamptz,
  sent_at             timestamptz,
  sent_by             uuid,
  provider_message_id text,
  error               text,
  attempts            int         NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, milestone)
);

CREATE INDEX IF NOT EXISTS reminder_events_ws_status_sched_idx
  ON public.reminder_events (workspace_id, status, scheduled_for);

ALTER TABLE public.reminder_events ENABLE ROW LEVEL SECURITY;

-- ─── RLS: reminder_events ────────────────────────────────────────────────────
-- Stejný vzor jako documents v 018_multitenant_phase6_rls.sql (reminder_events má vlastní workspace_id).

DROP POLICY IF EXISTS "Workspace members can view reminder events" ON public.reminder_events;
CREATE POLICY "Workspace members can view reminder events"
  ON public.reminder_events FOR SELECT
  USING (is_workspace_member(workspace_id) OR is_super_admin());

DROP POLICY IF EXISTS "Workspace admins can manage reminder events" ON public.reminder_events;
CREATE POLICY "Workspace admins can manage reminder events"
  ON public.reminder_events FOR ALL
  USING (is_workspace_admin(workspace_id) OR is_super_admin())
  WITH CHECK (is_workspace_admin(workspace_id) OR is_super_admin());

COMMIT;

-- Kontrolní SELECT (spusťte po migraci; očekává se 1 řádek tabulky, 2 politiky, RLS zapnutá a 2 indexy včetně UNIQUE):
--   SELECT c.relname, c.relrowsecurity AS rls,
--          (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'reminder_events') AS policies,
--          (SELECT count(*) FROM pg_indexes i WHERE i.schemaname = 'public' AND i.tablename = 'reminder_events') AS indexes
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relname = 'reminder_events';
