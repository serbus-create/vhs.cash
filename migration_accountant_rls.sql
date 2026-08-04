-- ═══════════════════════════════════════════════════════════════════════════════
-- 013_accountant_rls.sql
-- Přidání SELECT politik pro roli 'accountant'.
-- Accountant vidí veškerá data (jako admin), ale nezíská žádná práva na zápis.
-- Stávající admin politiky (auth.uid() = user_id) zůstávají beze změny.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── clients ─────────────────────────────────────────────────────────────────
CREATE POLICY "Accountants can view all clients"
  ON public.clients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'accountant'
    )
  );

-- ─── documents ───────────────────────────────────────────────────────────────
CREATE POLICY "Accountants can view all documents"
  ON public.documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'accountant'
    )
  );

-- ─── document_items ──────────────────────────────────────────────────────────
CREATE POLICY "Accountants can view all document items"
  ON public.document_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'accountant'
    )
  );

-- ─── company_profiles ────────────────────────────────────────────────────────
CREATE POLICY "Accountants can view all company profiles"
  ON public.company_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'accountant'
    )
  );

-- ─── reminders ───────────────────────────────────────────────────────────────
CREATE POLICY "Accountants can view all reminders"
  ON public.reminders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'accountant'
    )
  );
