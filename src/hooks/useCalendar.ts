import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Label {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_system: boolean;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  label_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  location: string | null;
  external_id: string | null;
  external_feed_id: string | null;
  created_at: string;
  updated_at: string;
  label?: Label;
}

export interface ExternalFeed {
  id: string;
  user_id: string;
  label_id: string | null;
  name: string;
  url: string;
  last_synced_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  label?: Label;
}

export type CalendarEventInsert = Omit<CalendarEvent, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'label'>;
export type LabelInsert = Omit<Label, 'id' | 'user_id' | 'created_at'>;
export type ExternalFeedInsert = Omit<ExternalFeed, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'label'>;

export function useLabels() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: labels = [], isLoading } = useQuery({
    queryKey: ['labels', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('labels')
        .select('*')
        .eq('user_id', user.id)
        .order('is_system', { ascending: false })
        .order('name');
      
      if (error) throw error;
      return data as Label[];
    },
    enabled: !!user,
  });

  const createLabel = useMutation({
    mutationFn: async (label: LabelInsert) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('labels')
        .insert({ ...label, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as Label;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
      toast({ title: 'Label aangemaakt' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij aanmaken label', description: error.message, variant: 'destructive' });
    },
  });

  const updateLabel = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Label> & { id: string }) => {
      const { error } = await supabase
        .from('labels')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
      toast({ title: 'Label bijgewerkt' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij bijwerken label', description: error.message, variant: 'destructive' });
    },
  });

  const deleteLabel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('labels')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
      toast({ title: 'Label verwijderd' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij verwijderen label', description: error.message, variant: 'destructive' });
    },
  });

  return {
    labels,
    isLoading,
    createLabel: createLabel.mutateAsync,
    updateLabel: updateLabel.mutate,
    deleteLabel: deleteLabel.mutate,
  };
}

export function useCalendarEvents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar_events', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, label:labels(*)')
        .eq('user_id', user.id)
        .order('start_time');
      
      if (error) throw error;
      return data as CalendarEvent[];
    },
    enabled: !!user,
  });

  const createEvent = useMutation({
    mutationFn: async (event: CalendarEventInsert) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({ ...event, user_id: user.id })
        .select('*, label:labels(*)')
        .single();
      
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
      toast({ title: 'Afspraak aangemaakt' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij aanmaken afspraak', description: error.message, variant: 'destructive' });
    },
  });

  const updateEvent = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CalendarEvent> & { id: string }) => {
      const { error } = await supabase
        .from('calendar_events')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
      toast({ title: 'Afspraak bijgewerkt' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij bijwerken afspraak', description: error.message, variant: 'destructive' });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
      toast({ title: 'Afspraak verwijderd' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij verwijderen', description: error.message, variant: 'destructive' });
    },
  });

  return {
    events,
    isLoading,
    createEvent: createEvent.mutateAsync,
    updateEvent: updateEvent.mutate,
    deleteEvent: deleteEvent.mutate,
  };
}

export function useExternalFeeds() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: feeds = [], isLoading } = useQuery({
    queryKey: ['external_feeds', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('external_feeds')
        .select('*, label:labels(*)')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) throw error;
      return data as ExternalFeed[];
    },
    enabled: !!user,
  });

  const createFeed = useMutation({
    mutationFn: async (feed: ExternalFeedInsert) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('external_feeds')
        .insert({ ...feed, user_id: user.id })
        .select('*, label:labels(*)')
        .single();
      
      if (error) throw error;
      return data as ExternalFeed;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external_feeds'] });
      toast({ title: 'Feed toegevoegd' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij toevoegen feed', description: error.message, variant: 'destructive' });
    },
  });

  const deleteFeed = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('external_feeds')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external_feeds'] });
      toast({ title: 'Feed verwijderd' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij verwijderen feed', description: error.message, variant: 'destructive' });
    },
  });

  return {
    feeds,
    isLoading,
    createFeed: createFeed.mutateAsync,
    deleteFeed: deleteFeed.mutate,
  };
}
