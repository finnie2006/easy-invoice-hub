-- Align saved BTW filing fields with the Belastingdienst VAT return structure.
-- Rows 1a, 1b, 1c, 2a, 4a and 4b need both turnover and VAT columns.
-- Rows 1e, 3a, 3b and 3c need turnover columns. Field columns are kept for
-- compatibility and for totals where VAT is applicable.

ALTER TABLE public.btw_filing_fields
  ADD COLUMN IF NOT EXISTS turnover_1a numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS turnover_1b numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS turnover_1c numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS turnover_1e numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS turnover_2a numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS turnover_3a numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS turnover_3b numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS turnover_3c numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS turnover_4a numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS turnover_4b numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS field_3c numeric(14,2) DEFAULT 0;
