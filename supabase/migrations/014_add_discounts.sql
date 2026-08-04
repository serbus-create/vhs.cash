-- 014_add_discounts.sql
-- Přidání procentuální slevy na jednotlivou položku faktury a celkové slevy na fakturu.

-- Sleva na řádek (položku): odečte se před výpočtem mezisoučtu
ALTER TABLE public.document_items
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0;

-- Celková sleva na fakturu: odečte se z mezisoučtu po položkových slevách, před DPH
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0;
