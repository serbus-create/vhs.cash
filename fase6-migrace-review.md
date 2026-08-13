# Fáze 6 — SQL migrace: review

Obsah souboru `supabase/migrations/018_multitenant_phase6_rls.sql` rozdělený do sekcí.

---

## Pomocné SECURITY DEFINER funkce

```sql
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION is_workspace_admin(ws_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM profiles WHERE id = auth.uid()),
    false
  )
$$;
```

---

## RLS politiky pro `workspaces`

```sql
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view their workspace"
  ON workspaces FOR SELECT
  USING (is_workspace_member(id) OR is_super_admin());

-- Pouze super_admin může vytvářet a měnit workspacy (správa workspace je mimo appku).
CREATE POLICY "Only super_admin can manage workspaces"
  ON workspaces FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
```

---

## RLS politiky pro `workspace_members`

```sql
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Člen vidí všechny členy svého workspace; super_admin vidí vše.
CREATE POLICY "Members can view their workspace members"
  ON workspace_members FOR SELECT
  USING (is_workspace_member(workspace_id) OR is_super_admin());

-- Přidávat členy smí admin daného workspace nebo super_admin.
CREATE POLICY "Workspace admins can insert members"
  ON workspace_members FOR INSERT
  WITH CHECK (is_workspace_admin(workspace_id) OR is_super_admin());

-- Měnit roli / joined_at smí admin daného workspace nebo super_admin.
CREATE POLICY "Workspace admins can update members"
  ON workspace_members FOR UPDATE
  USING (is_workspace_admin(workspace_id) OR is_super_admin())
  WITH CHECK (is_workspace_admin(workspace_id) OR is_super_admin());

-- Odebrat člena smí admin daného workspace nebo super_admin.
CREATE POLICY "Workspace admins can delete members"
  ON workspace_members FOR DELETE
  USING (is_workspace_admin(workspace_id) OR is_super_admin());
```

---

## RLS politiky pro `clients`

```sql
DROP POLICY IF EXISTS "Users manage own clients" ON clients;
DROP POLICY IF EXISTS "Accountants can view all clients" ON clients;

CREATE POLICY "Workspace members can view clients"
  ON clients FOR SELECT
  USING (is_workspace_member(workspace_id) OR is_super_admin());

CREATE POLICY "Workspace admins can manage clients"
  ON clients FOR ALL
  USING (is_workspace_admin(workspace_id) OR is_super_admin())
  WITH CHECK (is_workspace_admin(workspace_id) OR is_super_admin());
```

---

## RLS politiky pro `documents`

```sql
DROP POLICY IF EXISTS "Users manage own documents" ON documents;
DROP POLICY IF EXISTS "Accountants can view all documents" ON documents;

CREATE POLICY "Workspace members can view documents"
  ON documents FOR SELECT
  USING (is_workspace_member(workspace_id) OR is_super_admin());

CREATE POLICY "Workspace admins can manage documents"
  ON documents FOR ALL
  USING (is_workspace_admin(workspace_id) OR is_super_admin())
  WITH CHECK (is_workspace_admin(workspace_id) OR is_super_admin());
```

---

## RLS politiky pro `document_items`

`document_items` nemá vlastní `workspace_id` — izolace jde přes JOIN na `documents`.

```sql
DROP POLICY IF EXISTS "Users manage items via documents" ON document_items;
DROP POLICY IF EXISTS "Accountants can view all document items" ON document_items;

CREATE POLICY "Workspace members can view document items"
  ON document_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
        AND (is_workspace_member(d.workspace_id) OR is_super_admin())
    )
  );

CREATE POLICY "Workspace admins can manage document items"
  ON document_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
        AND (is_workspace_admin(d.workspace_id) OR is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
        AND (is_workspace_admin(d.workspace_id) OR is_super_admin())
    )
  );
```

---

## RLS politiky pro `company_profiles`

```sql
DROP POLICY IF EXISTS "Users manage own company profiles" ON company_profiles;
DROP POLICY IF EXISTS "Accountants can view all company profiles" ON company_profiles;

CREATE POLICY "Workspace members can view company profiles"
  ON company_profiles FOR SELECT
  USING (is_workspace_member(workspace_id) OR is_super_admin());

CREATE POLICY "Workspace admins can manage company profiles"
  ON company_profiles FOR ALL
  USING (is_workspace_admin(workspace_id) OR is_super_admin())
  WITH CHECK (is_workspace_admin(workspace_id) OR is_super_admin());
```

---

## RLS politiky pro `reminders`

`reminders` nemá vlastní `workspace_id` — izolace jde přes JOIN na `documents`.

```sql
DROP POLICY IF EXISTS "Users manage own reminders" ON reminders;
DROP POLICY IF EXISTS "Accountants can view all reminders" ON reminders;

CREATE POLICY "Workspace members can view reminders"
  ON reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
        AND (is_workspace_member(d.workspace_id) OR is_super_admin())
    )
  );

CREATE POLICY "Workspace admins can manage reminders"
  ON reminders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
        AND (is_workspace_admin(d.workspace_id) OR is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
        AND (is_workspace_admin(d.workspace_id) OR is_super_admin())
    )
  );
```
