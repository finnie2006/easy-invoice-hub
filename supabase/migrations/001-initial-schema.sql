CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create role and database user if not exists
-- This is idempotent and won't fail on re-runs
DO $$
BEGIN
  -- Create role if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'invoice_hub') THEN
    CREATE ROLE invoice_hub WITH LOGIN PASSWORD 'invoice_hub_password' CREATEDB;
  END IF;
END
$$;

-- Grant necessary permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO invoice_hub;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO invoice_hub;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  company_name text,
  company_address text,
  company_postal_code text,
  company_city text,
  company_country text,
  kvk_number text,
  btw_number text,
  iban text,
  default_hourly_rate numeric(12,2),
  default_payment_terms integer,
  logo_url text,
  use_company_branding boolean DEFAULT false,
  invoice_color_theme text,
  panel_color_theme text,
  payment_name text,
  invoice_email_subject_template text,
  invoice_email_body_template text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_mfa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  totp_secret text,
  totp_enabled boolean DEFAULT false,
  recovery_codes text[] DEFAULT ARRAY[]::text[],
  backup_codes_generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_mfa_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  failed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_oauth_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_id text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_name text,
  contact_name text,
  email text,
  phone text,
  address text,
  postal_code text,
  city text,
  country text,
  kvk_number text,
  btw_number text,
  notes text,
  is_saved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  invoice_number text,
  invoice_date date,
  due_date date,
  status text,
  subtotal numeric(14,2) DEFAULT 0,
  total_btw numeric(14,2) DEFAULT 0,
  total numeric(14,2) DEFAULT 0,
  discount_type text,
  discount_value numeric(14,2),
  discount_amount numeric(14,2),
  notes text,
  notes_title text,
  payment_reference text,
  client_company_name text,
  client_contact_name text,
  client_address text,
  client_postal_code text,
  client_city text,
  client_country text,
  client_kvk_number text,
  client_btw_number text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text,
  quantity numeric(12,2) DEFAULT 0,
  unit text,
  unit_price numeric(14,2) DEFAULT 0,
  btw_percentage numeric(6,2) DEFAULT 0,
  subtotal numeric(14,2) DEFAULT 0,
  btw_amount numeric(14,2) DEFAULT 0,
  total numeric(14,2) DEFAULT 0,
  discount_type text,
  discount_value numeric(14,2),
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vendor_name text,
  description text,
  category text,
  expense_date date,
  amount_excl_btw numeric(14,2) DEFAULT 0,
  btw_amount numeric(14,2) DEFAULT 0,
  amount_incl_btw numeric(14,2) DEFAULT 0,
  btw_percentage numeric(6,2),
  btw_period text,
  receipt_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text,
  name text,
  description text,
  start_date date,
  end_date date,
  hourly_rate numeric(12,2),
  status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  work_date date,
  hours numeric(8,2),
  start_time text,
  end_time text,
  is_overnight boolean DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.btw_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period text,
  year integer,
  quarter integer,
  is_closed boolean DEFAULT false,
  submitted_at timestamptz,
  closed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text,
  purchase_date date,
  purchase_price numeric(14,2),
  residual_value numeric(14,2),
  useful_life_years integer,
  category text,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.annual_tax_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  year integer NOT NULL,
  hours_worked numeric(10,2),
  is_starter boolean DEFAULT false,
  vehicle_private_percentage numeric(6,2),
  vehicle_total_km numeric(12,2),
  vehicle_business_km numeric(12,2),
  vehicle_costs numeric(14,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year)
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  is_system boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.external_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label_id uuid REFERENCES public.labels(id) ON DELETE SET NULL,
  name text NOT NULL,
  url text NOT NULL,
  last_synced_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label_id uuid REFERENCES public.labels(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  all_day boolean DEFAULT false,
  location text,
  external_id text,
  external_feed_id uuid REFERENCES public.external_feeds(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (setting_key, setting_value)
VALUES
  ('registration_enabled', 'true'::jsonb),
  ('smtp_host', '""'::jsonb),
  ('smtp_port', '587'::jsonb),
  ('smtp_user', '""'::jsonb),
  ('smtp_password', '""'::jsonb),
  ('smtp_from_email', '""'::jsonb),
  ('smtp_from_name', '"Easy Invoice Hub"'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_mfa_user_id ON public.user_mfa (user_id);
CREATE INDEX IF NOT EXISTS idx_user_mfa_attempts_user_id ON public.user_mfa_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_user_mfa_attempts_failed_at ON public.user_mfa_attempts (failed_at);
CREATE INDEX IF NOT EXISTS idx_user_oauth_providers_user_id ON public.user_oauth_providers (user_id);
CREATE INDEX IF NOT EXISTS idx_user_oauth_provider ON public.user_oauth_providers (provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients (user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices (user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects (user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON public.time_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_btw_periods_user_id ON public.btw_periods (user_id);
CREATE INDEX IF NOT EXISTS idx_business_assets_user_id ON public.business_assets (user_id);
CREATE INDEX IF NOT EXISTS idx_annual_tax_data_user_id ON public.annual_tax_data (user_id);
CREATE INDEX IF NOT EXISTS idx_labels_user_id ON public.labels (user_id);
CREATE INDEX IF NOT EXISTS idx_external_feeds_user_id ON public.external_feeds (user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON public.calendar_events (user_id);
