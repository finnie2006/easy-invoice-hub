
-- Business assets table for depreciation tracking
CREATE TABLE public.business_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  purchase_date date NOT NULL,
  purchase_price numeric NOT NULL,
  residual_value numeric NOT NULL DEFAULT 0,
  useful_life_years integer NOT NULL DEFAULT 5,
  category text NOT NULL DEFAULT 'overig',
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assets" ON public.business_assets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own assets" ON public.business_assets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own assets" ON public.business_assets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own assets" ON public.business_assets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Annual tax data per year
CREATE TABLE public.annual_tax_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year integer NOT NULL,
  hours_worked integer DEFAULT 0,
  is_starter boolean DEFAULT false,
  vehicle_private_percentage numeric DEFAULT 0,
  vehicle_total_km numeric DEFAULT 0,
  vehicle_business_km numeric DEFAULT 0,
  vehicle_costs numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, year)
);

ALTER TABLE public.annual_tax_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own annual tax data" ON public.annual_tax_data FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own annual tax data" ON public.annual_tax_data FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own annual tax data" ON public.annual_tax_data FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own annual tax data" ON public.annual_tax_data FOR DELETE TO authenticated USING (auth.uid() = user_id);
