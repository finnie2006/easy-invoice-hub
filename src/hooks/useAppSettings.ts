import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export type EnvironmentMode = 'isolated' | 'shared' | 'team';

export interface AppSettings {
  registration_enabled: boolean;
  environment_mode: EnvironmentMode;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'user';
  created_at: string;
}

export function useAppSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch app settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value');
      
      if (error) throw error;
      
      const settingsMap: AppSettings = {
        registration_enabled: true,
        environment_mode: 'isolated',
      };
      
      data?.forEach((row) => {
        if (row.setting_key === 'registration_enabled') {
          settingsMap.registration_enabled = row.setting_value as boolean;
        }
        if (row.setting_key === 'environment_mode') {
          settingsMap.environment_mode = (row.setting_value as string).replace(/"/g, '') as EnvironmentMode;
        }
      });
      
      return settingsMap;
    },
    enabled: !!user,
  });

  // Fetch current user's role
  const { data: userRole, isLoading: isLoadingRole } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        // User might not have a role yet (existing users before migration)
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }
      
      return data as UserRole;
    },
    enabled: !!user?.id,
  });

  const isAdmin = userRole?.role === 'admin';

  // Update setting mutation
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean | string }) => {
      const { error } = await supabase
        .from('app_settings')
        .update({ setting_value: JSON.stringify(value) })
        .eq('setting_key', key);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      toast({
        title: 'Instelling opgeslagen',
        description: 'De instelling is succesvol bijgewerkt.',
      });
    },
    onError: (error) => {
      console.error('Error updating setting:', error);
      toast({
        title: 'Fout',
        description: 'Je hebt geen rechten om deze instelling te wijzigen.',
        variant: 'destructive',
      });
    },
  });

  const updateSetting = (key: string, value: boolean | string) => {
    updateSettingMutation.mutate({ key, value });
  };

  return {
    settings,
    isLoading: isLoadingSettings || isLoadingRole,
    isAdmin,
    userRole,
    updateSetting,
    isUpdating: updateSettingMutation.isPending,
  };
}
