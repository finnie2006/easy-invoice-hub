import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profile as profileApi } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Profile {
  id: string;
  user_id: string;
  company_name: string | null;
  company_address: string | null;
  company_postal_code: string | null;
  company_city: string | null;
  company_country: string | null;
  kvk_number: string | null;
  btw_number: string | null;
  iban: string | null;
  default_hourly_rate: number | null;
  default_payment_terms: number | null;
  logo_url: string | null;
  use_company_branding: boolean | null;
  invoice_color_theme: string | null;
  panel_color_theme: string | null;
  payment_name: string | null;
  invoice_email_subject_template: string | null;
  invoice_email_body_template: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const response = await profileApi.getProfile();
      return (response.data || null) as Profile | null;
    },
    enabled: !!user,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!user) throw new Error('Not authenticated');

      await profileApi.updateProfile(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({
        title: 'Instellingen opgeslagen',
        description: 'Je gegevens zijn bijgewerkt.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij opslaan',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Get the app name based on branding preference
  const getAppName = () => {
    if (profile?.use_company_branding && profile?.company_name) {
      return profile.company_name;
    }
    return 'MijnZaak';
  };

  return {
    profile,
    isLoading,
    updateProfile: updateProfile.mutate,
    isUpdating: updateProfile.isPending,
    appName: getAppName(),
  };
}
