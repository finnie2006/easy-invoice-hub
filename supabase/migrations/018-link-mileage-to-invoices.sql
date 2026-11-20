-- Koppel een rit optioneel aan een factuur ter referentie.
ALTER TABLE public.mileage_entries
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mileage_entries_invoice_id
  ON public.mileage_entries (invoice_id)
  WHERE invoice_id IS NOT NULL;
