import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { labels as labelsApi, calendarEvents as calendarEventsApi, externalFeeds as externalFeedsApi } from '@/api/client';
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
      const response = await labelsApi.getAll();
      return response.data as Label[];
    },
    enabled: !!user,
  });

  const createLabel = useMutation({
    mutationFn: async (label: LabelInsert) => {
      if (!user) throw new Error('Not authenticated');

      const response = await labelsApi.create(label);
      return response.data as Label;
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
      await labelsApi.update(id, updates);
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
      await labelsApi.delete(id);
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
      const response = await calendarEventsApi.getAll();
      return response.data as CalendarEvent[];
    },
    enabled: !!user,
  });

  const createEvent = useMutation({
    mutationFn: async (event: CalendarEventInsert) => {
      if (!user) throw new Error('Not authenticated');

      const response = await calendarEventsApi.create(event);
      return response.data as CalendarEvent;
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
      await calendarEventsApi.update(id, updates);
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
      await calendarEventsApi.delete(id);
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
      const response = await externalFeedsApi.getAll();
      return response.data as ExternalFeed[];
    },
    enabled: !!user,
  });

  const createFeed = useMutation({
    mutationFn: async (feed: ExternalFeedInsert) => {
      if (!user) throw new Error('Not authenticated');

      const response = await externalFeedsApi.create(feed);
      return response.data as ExternalFeed;
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
      await externalFeedsApi.delete(id);
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
