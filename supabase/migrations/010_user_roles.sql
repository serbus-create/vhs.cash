-- 010_user_roles.sql
-- Add role column to existing profiles table

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin'
  CHECK (role IN ('admin', 'accountant'));

UPDATE public.profiles SET role = 'admin';
