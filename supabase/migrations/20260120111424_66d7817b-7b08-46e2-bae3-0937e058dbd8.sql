-- Add notes_title column to invoices table for customizable notes header
ALTER TABLE public.invoices 
ADD COLUMN notes_title TEXT DEFAULT 'Opmerkingen';