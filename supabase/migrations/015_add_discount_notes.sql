-- 015_add_discount_notes.sql
-- Volitelný textový popis slevy na položce i na celé faktuře.

-- Popis slevy na řádkovou položku (např. "Věrnostní sleva")
ALTER TABLE public.document_items
  ADD COLUMN IF NOT EXISTS discount_note TEXT DEFAULT NULL;

-- Popis celkové slevy na fakturu (např. "Akce -10 %")
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS discount_note TEXT DEFAULT NULL;
