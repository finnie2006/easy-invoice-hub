CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  billing_interval_months integer NOT NULL CHECK (billing_interval_months IN (1, 3, 6, 12)),
  monthly_price numeric(14,2) NOT NULL DEFAULT 0,
  invoice_amount numeric(14,2) NOT NULL DEFAULT 0,
  minimum_term_months integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_user_active
  ON public.subscription_plans (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_sort_order
  ON public.subscription_plans (user_id, sort_order);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text,
  service_name text NOT NULL DEFAULT 'Vevuno',
  plan_name text NOT NULL,
  billing_interval_months integer NOT NULL CHECK (billing_interval_months IN (1, 3, 6, 12)),
  monthly_price numeric(14,2) NOT NULL DEFAULT 0,
  invoice_amount numeric(14,2) NOT NULL DEFAULT 0,
  btw_percentage numeric(6,2) NOT NULL DEFAULT 21,
  start_date date NOT NULL,
  next_invoice_date date NOT NULL,
  last_invoice_date date,
  minimum_term_months integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON public.subscriptions (user_id, status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_next_invoice_date
  ON public.subscriptions (next_invoice_date);
