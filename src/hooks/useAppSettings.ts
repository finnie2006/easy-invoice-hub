import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appSettings as appSettingsApi, userRole as userRoleApi, adminUsers as adminUsersApi } from '@/api/client';
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

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  role: 'admin' | 'user';
  company_name: string | null;
}

export function useAppSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch app settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const response = await appSettingsApi.getAll();
      const data = response.data as Array<{ setting_key: string; setting_value: unknown }>;
      
      const settingsMap: AppSettings = {
        registration_enabled: true,
        environment_mode: 'isolated',
      };
      
      data?.forEach((row) => {
        if (row.setting_key === 'registration_enabled') {
          settingsMap.registration_enabled = Boolean(row.setting_value);
        }
        if (row.setting_key === 'environment_mode') {
          settingsMap.environment_mode = String(row.setting_value).replace(/"/g, '') as EnvironmentMode;
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

      const response = await userRoleApi.getCurrent();
      return (response.data || null) as UserRole | null;
    },
    enabled: !!user?.id,
  });

  const isAdmin = userRole?.role === 'admin';

  const { data: adminUsers, isLoading: isLoadingAdminUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await adminUsersApi.getAll();
      return (response.data || []) as AdminUser[];
    },
    enabled: !!user && isAdmin,
  });

  // Update setting mutation
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean | string }) => {
      await appSettingsApi.update(key, value);
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

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await adminUsersApi.delete(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: 'Gebruiker verwijderd',
        description: 'Het account is succesvol verwijderd.',
      });
    },
    onError: (error: unknown) => {
      console.error('Error deleting user:', error);
      toast({
        title: 'Fout bij verwijderen',
        description: 'De gebruiker kon niet worden verwijderd.',
        variant: 'destructive',
      });
    },
  });

  return {
    settings,
    isLoading: isLoadingSettings || isLoadingRole,
    isLoadingAdminUsers,
    isAdmin,
    userRole,
    adminUsers: adminUsers || [],
    updateSetting,
    deleteUser: deleteUserMutation.mutate,
    isDeletingUser: deleteUserMutation.isPending,
    isUpdating: updateSettingMutation.isPending,
  };
}
