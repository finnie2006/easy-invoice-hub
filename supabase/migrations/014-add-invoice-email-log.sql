CREATE TABLE IF NOT EXISTS public.invoice_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  subject text,
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_email_log_invoice_created
  ON public.invoice_email_log (invoice_id, created_at DESC);

INSERT INTO public.app_settings (setting_key, setting_value)
VALUES
  ('smtp_security', '"auto"'::jsonb),
  ('smtp_allow_self_signed', 'false'::jsonb),
  ('smtp_reply_to', '""'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
