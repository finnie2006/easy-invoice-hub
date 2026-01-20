-- Add client_name column for manual client entry
ALTER TABLE public.projects 
ADD COLUMN client_name TEXT;