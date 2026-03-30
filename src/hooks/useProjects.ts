import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projects as projectsApi, timeEntries as timeEntriesApi } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Project {
  id: string;
  user_id: string;
  client_id: string | null;
  client_name: string | null;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  hourly_rate: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  client?: {
    company_name: string;
  } | null;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string;
  work_date: string;
  hours: number;
  start_time: string | null;
  end_time: string | null;
  is_overnight: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  client_id?: string;
  client_name?: string;
  start_date: string;
  end_date?: string;
  hourly_rate?: number;
}

export interface CreateTimeEntryData {
  project_id: string;
  work_date: string;
  hours: number;
  start_time?: string;
  end_time?: string;
  is_overnight?: boolean;
  description?: string;
}

export function useProjects() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const projectsQuery = useQuery({
    queryKey: ['projects', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await projectsApi.getAll();
      return response.data as Project[];
    },
    enabled: !!user?.id,
  });

  const createProject = useMutation({
    mutationFn: async (projectData: CreateProjectData) => {
      if (!user?.id) throw new Error('Not authenticated');

      const response = await projectsApi.create({
        name: projectData.name,
        description: projectData.description || null,
        client_id: projectData.client_id || null,
        client_name: projectData.client_name || null,
        start_date: projectData.start_date,
        end_date: projectData.end_date || null,
        hourly_rate: projectData.hourly_rate || null,
        status: 'active',
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project aangemaakt');
    },
    onError: (error) => {
      toast.error('Fout bij aanmaken project: ' + error.message);
    },
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, ...projectData }: Partial<Project> & { id: string }) => {
      const response = await projectsApi.update(id, projectData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project bijgewerkt');
    },
    onError: (error) => {
      toast.error('Fout bij bijwerken project: ' + error.message);
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      await projectsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project verwijderd');
    },
    onError: (error) => {
      toast.error('Fout bij verwijderen project: ' + error.message);
    },
  });

  return {
    projects: projectsQuery.data || [],
    isLoading: projectsQuery.isLoading,
    createProject,
    updateProject,
    deleteProject,
  };
}

export function useTimeEntries(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const timeEntriesQuery = useQuery({
    queryKey: ['time-entries', projectId, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const response = await timeEntriesApi.getAll();
      const entries = response.data as TimeEntry[];
      return projectId ? entries.filter((entry) => entry.project_id === projectId) : entries;
    },
    enabled: !!user?.id,
  });

  const createTimeEntry = useMutation({
    mutationFn: async (entryData: CreateTimeEntryData) => {
      if (!user?.id) throw new Error('Not authenticated');

      const response = await timeEntriesApi.create({
        project_id: entryData.project_id,
        work_date: entryData.work_date,
        hours: entryData.hours,
        start_time: entryData.start_time || null,
        end_time: entryData.end_time || null,
        is_overnight: entryData.is_overnight || false,
        description: entryData.description || null,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success('Uren geregistreerd');
    },
    onError: (error) => {
      toast.error('Fout bij registreren uren: ' + error.message);
    },
  });

  const updateTimeEntry = useMutation({
    mutationFn: async ({ id, ...entryData }: Partial<TimeEntry> & { id: string }) => {
      const response = await timeEntriesApi.update(id, entryData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success('Uren bijgewerkt');
    },
    onError: (error) => {
      toast.error('Fout bij bijwerken uren: ' + error.message);
    },
  });

  const deleteTimeEntry = useMutation({
    mutationFn: async (id: string) => {
      await timeEntriesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success('Uren verwijderd');
    },
    onError: (error) => {
      toast.error('Fout bij verwijderen uren: ' + error.message);
    },
  });

  return {
    timeEntries: timeEntriesQuery.data || [],
    isLoading: timeEntriesQuery.isLoading,
    createTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
  };
}
