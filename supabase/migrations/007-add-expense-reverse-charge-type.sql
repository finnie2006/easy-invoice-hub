ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS reverse_charge_type text;

UPDATE public.expenses
SET reverse_charge_type = 'eu'
WHERE has_reverse_charge = true
  AND reverse_charge_type IS NULL;
