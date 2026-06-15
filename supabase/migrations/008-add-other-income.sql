CREATE TABLE IF NOT EXISTS public.other_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'overig',
  income_date date NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_other_income_user_id ON public.other_income (user_id);
CREATE INDEX IF NOT EXISTS idx_other_income_income_date ON public.other_income (income_date);
