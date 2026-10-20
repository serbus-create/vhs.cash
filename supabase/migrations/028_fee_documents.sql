-- 028_fee_documents.sql
-- Vyúčtování smluvních pokut a paušální náhrady (documents.type = 'vyuctovani'): druh poplatku a ochrana proti duplicitám.
-- Jeden aktivní (nestornovaný) doklad daného druhu na fakturu; souběžné vystavení druhým adminem narazí na unikátní index.

BEGIN;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS fee_kind text
  CHECK (fee_kind IS NULL OR fee_kind IN ('pokuta', 'pokuta_navyseni', 'pausal', 'denni'));

CREATE UNIQUE INDEX IF NOT EXISTS documents_fee_kind_uq
  ON public.documents (related_invoice_id, fee_kind)
  WHERE type = 'vyuctovani' AND status <> 'cancelled' AND fee_kind IS NOT NULL;

COMMIT;

-- Kontrolní SELECT (spusťte po migraci; očekává se 1 sloupec fee_kind a 1 unikátní index documents_fee_kind_uq):
--   SELECT
--     (SELECT count(*) FROM information_schema.columns
--       WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'fee_kind') AS fee_kind_column,
--     (SELECT count(*) FROM pg_indexes
--       WHERE schemaname = 'public' AND tablename = 'documents' AND indexname = 'documents_fee_kind_uq') AS unique_index;
