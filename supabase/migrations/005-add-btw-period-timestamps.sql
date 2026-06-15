ALTER TABLE public.btw_periods
ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

ALTER TABLE public.btw_periods
ADD COLUMN IF NOT EXISTS closed_at timestamptz;
