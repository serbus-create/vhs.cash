BEGIN;

CREATE TABLE IF NOT EXISTS public.terms_templates (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  version      integer     NOT NULL,
  body         text        NOT NULL,
  defaults     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_active    boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS terms_templates_one_active_per_workspace
  ON public.terms_templates (workspace_id) WHERE is_active;

ALTER TABLE public.terms_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view terms templates" ON public.terms_templates;
CREATE POLICY "Workspace members can view terms templates"
  ON public.terms_templates FOR SELECT
  USING (is_workspace_member(workspace_id) OR is_super_admin());

DROP POLICY IF EXISTS "Workspace admins can manage terms templates" ON public.terms_templates;
CREATE POLICY "Workspace admins can manage terms templates"
  ON public.terms_templates FOR ALL
  USING (is_workspace_admin(workspace_id) OR is_super_admin())
  WITH CHECK (is_workspace_admin(workspace_id) OR is_super_admin());

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS terms_template_id uuid REFERENCES public.terms_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS terms_values jsonb,
  ADD COLUMN IF NOT EXISTS terms_snapshot text,
  ADD COLUMN IF NOT EXISTS terms_hash text,
  ADD COLUMN IF NOT EXISTS terms_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirm_token_hash text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by_name text,
  ADD COLUMN IF NOT EXISTS confirmed_by_role text,
  ADD COLUMN IF NOT EXISTS confirmed_by_email text,
  ADD COLUMN IF NOT EXISTS confirmed_ip text;

CREATE UNIQUE INDEX IF NOT EXISTS documents_confirm_token_hash_key
  ON public.documents (confirm_token_hash) WHERE confirm_token_hash IS NOT NULL;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS represented_by text;

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_entity_type_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_entity_type_check
  CHECK (entity_type IS NULL OR entity_type IN ('firma', 'osvc'));

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_status_check
  CHECK (status IN ('draft', 'issued', 'sent', 'paid', 'cancelled', 'confirmed', 'expired'));

COMMIT;
