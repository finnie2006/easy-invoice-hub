-- Add branding preference to profiles
ALTER TABLE public.profiles 
ADD COLUMN use_company_branding BOOLEAN DEFAULT false;

-- Create labels table for calendar labels
CREATE TABLE public.labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on labels
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

-- RLS policies for labels
CREATE POLICY "Users can view their own labels"
ON public.labels FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own labels"
ON public.labels FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own labels"
ON public.labels FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own labels"
ON public.labels FOR DELETE
USING (auth.uid() = user_id AND is_system = false);

-- Create calendar_events table
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label_id UUID REFERENCES public.labels(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  all_day BOOLEAN DEFAULT false,
  location TEXT,
  external_id TEXT,
  external_feed_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on calendar_events
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for calendar_events
CREATE POLICY "Users can view their own events"
ON public.calendar_events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own events"
ON public.calendar_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
ON public.calendar_events FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events"
ON public.calendar_events FOR DELETE
USING (auth.uid() = user_id);

-- Create external_feeds table for imported calendars
CREATE TABLE public.external_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label_id UUID REFERENCES public.labels(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on external_feeds
ALTER TABLE public.external_feeds ENABLE ROW LEVEL SECURITY;

-- RLS policies for external_feeds
CREATE POLICY "Users can view their own feeds"
ON public.external_feeds FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feeds"
ON public.external_feeds FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feeds"
ON public.external_feeds FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feeds"
ON public.external_feeds FOR DELETE
USING (auth.uid() = user_id);

-- Add foreign key for external_feed_id in calendar_events
ALTER TABLE public.calendar_events 
ADD CONSTRAINT calendar_events_external_feed_id_fkey 
FOREIGN KEY (external_feed_id) REFERENCES public.external_feeds(id) ON DELETE CASCADE;

-- Create trigger for calendar_events timestamp
CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for external_feeds timestamp
CREATE TRIGGER update_external_feeds_updated_at
BEFORE UPDATE ON public.external_feeds
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to initialize default labels for new users
CREATE OR REPLACE FUNCTION public.create_default_labels()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.labels (user_id, name, color, is_system) VALUES
    (NEW.id, 'Privé', '#10B981', true),
    (NEW.id, 'Werk', '#3B82F6', true),
    (NEW.id, 'School', '#F59E0B', true),
    (NEW.id, 'Eigen bedrijf', '#8B5CF6', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to add default labels when user signs up
CREATE TRIGGER on_auth_user_created_labels
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_default_labels();