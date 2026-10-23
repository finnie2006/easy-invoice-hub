ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_revenue_target numeric(12,2);
