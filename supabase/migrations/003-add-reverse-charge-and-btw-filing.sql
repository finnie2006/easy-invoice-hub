-- Add reverse charge flag to expenses
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS has_reverse_charge boolean NOT NULL DEFAULT false;

-- Create table for BTW filing fields
CREATE TABLE IF NOT EXISTS public.btw_filing_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period text NOT NULL,
  year integer NOT NULL,
  quarter integer NOT NULL,
  
  -- Received VAT (Ontvangen omzetbelasting)
  field_1a numeric(14,2) DEFAULT 0, -- Domestic sales
  field_1b numeric(14,2) DEFAULT 0, -- Intra-community supplies
  field_1c numeric(14,2) DEFAULT 0, -- Export
  field_1d numeric(14,2) DEFAULT 0, -- Other supplies
  
  -- Deductible VAT paid (Aftrekbare belasting betaald op aankopen)
  field_3a numeric(14,2) DEFAULT 0, -- Intra-community acquisitions
  field_3b numeric(14,2) DEFAULT 0, -- Import
  field_4a numeric(14,2) DEFAULT 0, -- Domestic purchases
  field_4b numeric(14,2) DEFAULT 0, -- Other business expenses
  
  -- VAT to pay or refund
  field_5a numeric(14,2) DEFAULT 0, -- Total received VAT
  field_5b numeric(14,2) DEFAULT 0, -- Total deductible VAT
  field_5c numeric(14,2) DEFAULT 0, -- VAT to pay (5a - 5b) or refund
  
  -- Additional fields
  field_1e numeric(14,2) DEFAULT 0, -- Reverse charge supplies
  field_2a numeric(14,2) DEFAULT 0, -- Services from abroad
  
  submitted boolean NOT NULL DEFAULT false,
  submitted_at timestamptz,
  notes text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, period)
);

CREATE INDEX IF NOT EXISTS idx_btw_filing_user_period ON public.btw_filing_fields (user_id, period);
CREATE INDEX IF NOT EXISTS idx_btw_filing_year_quarter ON public.btw_filing_fields (year, quarter);
