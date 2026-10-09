CREATE TABLE IF NOT EXISTS public.mileage_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  travel_date date NOT NULL,
  destination text NOT NULL,
  purpose text NOT NULL,
  kilometers numeric(10,1) NOT NULL CHECK (kilometers > 0),
  rate numeric(6,2) NOT NULL DEFAULT 0.25,
  notes text,
  is_finalized boolean NOT NULL DEFAULT false,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mileage_entries
  ADD COLUMN IF NOT EXISTS is_finalized boolean NOT NULL DEFAULT false;

ALTER TABLE public.mileage_entries
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_mileage_entries_user_date
  ON public.mileage_entries (user_id, travel_date DESC);
