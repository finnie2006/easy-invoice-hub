-- Add start_time and end_time columns to time_entries
ALTER TABLE public.time_entries 
ADD COLUMN start_time TIME,
ADD COLUMN end_time TIME,
ADD COLUMN is_overnight BOOLEAN DEFAULT false;