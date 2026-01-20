-- Add color theme settings to profiles
ALTER TABLE public.profiles 
ADD COLUMN invoice_color_theme TEXT DEFAULT 'gray',
ADD COLUMN panel_color_theme TEXT DEFAULT 'default';