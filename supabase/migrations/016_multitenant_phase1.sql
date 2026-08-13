-- Fáze 1 multi-tenant migrace: vytvoření nových tabulek a přidání is_super_admin do profiles.
-- Nedestruktivní — žádné existující tabulky ani RLS politiky se nemění.
-- Žádné RLS politiky pro nové tabulky zatím nevznikají.

-- Tabulka workspaců (firem/tenant)
CREATE TABLE workspaces (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text        NOT NULL,
  drive_folder_id      text,
  email_from_reminders text,
  email_from_uctarna   text,
  email_reply_to       text,
  created_at           timestamptz NOT NULL DEFAULT NOW()
);

-- Tabulka členství uživatelů ve workspacích (nahradí profiles.role v budoucí fázi)
CREATE TABLE workspace_members (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text        NOT NULL CHECK (role IN ('admin', 'accountant')),
  invited_by   uuid        REFERENCES auth.users(id),
  joined_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (workspace_id, user_id)
);

-- Globální super_admin flag na profilu (mimo workspace strukturu)
ALTER TABLE profiles
  ADD COLUMN is_super_admin boolean NOT NULL DEFAULT false;
