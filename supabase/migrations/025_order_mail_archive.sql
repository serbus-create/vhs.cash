BEGIN;
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS terms_mail_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_mail_to text,
  ADD COLUMN IF NOT EXISTS confirm_mail_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_drive_file_id text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_user_agent text;
COMMIT;
