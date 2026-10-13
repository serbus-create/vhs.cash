BEGIN;
ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS default_hourly_rate numeric(10,2);
ALTER TABLE public.company_profiles DROP CONSTRAINT IF EXISTS company_profiles_default_hourly_rate_check;
ALTER TABLE public.company_profiles ADD CONSTRAINT company_profiles_default_hourly_rate_check
  CHECK (default_hourly_rate IS NULL OR default_hourly_rate > 0);
COMMIT;
