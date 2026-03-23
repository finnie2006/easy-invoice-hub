
-- Add discount fields to invoice_items
ALTER TABLE public.invoice_items 
  ADD COLUMN discount_type text DEFAULT NULL,
  ADD COLUMN discount_value numeric DEFAULT 0;

-- Add discount fields to invoices (total-level discount)
ALTER TABLE public.invoices 
  ADD COLUMN discount_type text DEFAULT NULL,
  ADD COLUMN discount_value numeric DEFAULT 0,
  ADD COLUMN discount_amount numeric DEFAULT 0;
