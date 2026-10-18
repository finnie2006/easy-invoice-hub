ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_km_rate numeric(8,2);
