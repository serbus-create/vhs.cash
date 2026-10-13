BEGIN;
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_type_check
  CHECK (type IN ('faktura', 'nabidka', 'objednavka', 'podminky'));
ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS represented_by text;
COMMIT;
