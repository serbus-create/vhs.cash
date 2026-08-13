-- Fáze 2 multi-tenant migrace: přidání workspace_id jako nullable sloupce do datových tabulek.
-- Nedestruktivní — žádné FK, žádné NOT NULL, žádné UPDATE dat, žádné RLS změny.
-- Existující záznamy budou mít workspace_id = NULL, stará RLS (user_id) stále platí.

ALTER TABLE company_profiles
  ADD COLUMN workspace_id uuid;

ALTER TABLE clients
  ADD COLUMN workspace_id uuid;

ALTER TABLE documents
  ADD COLUMN workspace_id uuid;
