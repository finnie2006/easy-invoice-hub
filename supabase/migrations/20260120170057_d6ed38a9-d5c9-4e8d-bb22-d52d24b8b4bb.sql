-- Create app_settings table for global application configuration
CREATE TABLE public.app_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read settings
CREATE POLICY "Authenticated users can read app settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);

-- Create enum for environment modes
CREATE TYPE public.environment_mode AS ENUM ('isolated', 'shared', 'team');

-- Insert default settings
INSERT INTO public.app_settings (setting_key, setting_value) VALUES 
('registration_enabled', 'true'::jsonb),
('environment_mode', '"isolated"'::jsonb);

-- Create trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();