ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invoice_email_subject_template text,
  ADD COLUMN IF NOT EXISTS invoice_email_body_template text;
