BEGIN;
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text;
COMMIT;
