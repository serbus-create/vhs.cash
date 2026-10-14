BEGIN;
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_type_check
  CHECK (type IN ('faktura', 'nabidka', 'objednavka', 'podminky', 'vyuctovani'));
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_invoice_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS documents_order_id_idx ON public.documents (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS documents_related_invoice_idx ON public.documents (related_invoice_id) WHERE related_invoice_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.document_counters (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type text NOT NULL,
  year int NOT NULL,
  last_value int NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, type, year)
);
ALTER TABLE public.document_counters ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.next_document_number(p_workspace uuid, p_type text, p_prefix text, p_year int)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v int;
BEGIN
  INSERT INTO public.document_counters (workspace_id, type, year, last_value)
  VALUES (p_workspace, p_type, p_year, 1)
  ON CONFLICT (workspace_id, type, year)
  DO UPDATE SET last_value = public.document_counters.last_value + 1
  RETURNING last_value INTO v;
  RETURN p_prefix || '-' || p_year || '-' || lpad(v::text, 4, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.next_document_number(uuid, text, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_document_number(uuid, text, text, int) TO service_role;
CREATE UNIQUE INDEX IF NOT EXISTS documents_vyuctovani_number_uq
  ON public.documents (workspace_id, number) WHERE type = 'vyuctovani';
COMMIT;
