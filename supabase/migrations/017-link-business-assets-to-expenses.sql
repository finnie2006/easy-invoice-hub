-- Koppel bedrijfsmiddelen (afschrijving) aan de uitgave waarmee ze zijn aangeschaft.
-- Een gekoppelde uitgave telt niet meer als directe kosten; de afschrijving wel.
ALTER TABLE public.business_assets
  ADD COLUMN IF NOT EXISTS expense_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS business_assets_expense_id_key
  ON public.business_assets(expense_id)
  WHERE expense_id IS NOT NULL;
