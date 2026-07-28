-- 011_reminders.sql
-- Tabulka pro historii odeslaných upomínek

CREATE TABLE public.reminders (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id     UUID REFERENCES public.documents ON DELETE CASCADE NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level           INT NOT NULL CHECK (level IN (1, 2, 3)),
  recipient_email TEXT NOT NULL
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reminders"
  ON public.reminders FOR ALL
  USING (
    document_id IN (
      SELECT id FROM public.documents WHERE user_id = auth.uid()
    )
  );
