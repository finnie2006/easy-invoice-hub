-- Add BTW period column to expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS btw_period TEXT;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_expenses_btw_period ON public.expenses(btw_period);

-- Create table for tracking BTW period status
CREATE TABLE IF NOT EXISTS public.btw_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  period TEXT NOT NULL,
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  is_closed BOOLEAN DEFAULT false,
  submitted_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, period)
);

-- Enable RLS
ALTER TABLE public.btw_periods ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own BTW periods" 
ON public.btw_periods 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own BTW periods" 
ON public.btw_periods 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own BTW periods" 
ON public.btw_periods 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own BTW periods" 
ON public.btw_periods 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_btw_periods_updated_at
BEFORE UPDATE ON public.btw_periods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();