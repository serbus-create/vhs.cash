BEGIN;
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS confirmed_by_phone text;
COMMIT;
