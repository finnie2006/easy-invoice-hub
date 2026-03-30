import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { annualTaxData as annualTaxDataApi } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface AnnualTaxData {
  id: string;
  user_id: string;
  year: number;
  hours_worked: number;
  is_starter: boolean;
  vehicle_private_percentage: number;
  vehicle_total_km: number;
  vehicle_business_km: number;
  vehicle_costs: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnualTaxDataUpsert {
  year: number;
  hours_worked?: number;
  is_starter?: boolean;
  vehicle_private_percentage?: number;
  vehicle_total_km?: number;
  vehicle_business_km?: number;
  vehicle_costs?: number;
  notes?: string | null;
}

// Dutch tax constants per year (simplified, using 2024/2025 values)
export const TAX_CONSTANTS: Record<number, {
  zelfstandigenaftrek: number;
  startersaftrek: number;
  mkbVrijstellingPercentage: number;
}> = {
  2023: { zelfstandigenaftrek: 5030, startersaftrek: 2123, mkbVrijstellingPercentage: 14 },
  2024: { zelfstandigenaftrek: 3750, startersaftrek: 2123, mkbVrijstellingPercentage: 13.31 },
  2025: { zelfstandigenaftrek: 2470, startersaftrek: 2123, mkbVrijstellingPercentage: 13.31 },
  2026: { zelfstandigenaftrek: 2470, startersaftrek: 2123, mkbVrijstellingPercentage: 13.31 },
};

export function useAnnualTaxData(year: number) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: taxData, isLoading } = useQuery({
    queryKey: ['annual-tax-data', user?.id, year],
    queryFn: async () => {
      if (!user) return null;
      const response = await annualTaxDataApi.getAll();
      const rows = response.data as AnnualTaxData[];
      return rows.find((row) => row.year === year) || null;
    },
    enabled: !!user,
  });

  const upsertTaxData = useMutation({
    mutationFn: async (data: AnnualTaxDataUpsert) => {
      if (!user) throw new Error('Not authenticated');

      await annualTaxDataApi.save(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annual-tax-data'] });
      toast({ title: 'Gegevens opgeslagen' });
    },
    onError: (error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const getTaxConstants = (yr: number) => {
    return TAX_CONSTANTS[yr] || TAX_CONSTANTS[2026];
  };

  return {
    taxData,
    isLoading,
    upsertTaxData: upsertTaxData.mutate,
    isSaving: upsertTaxData.isPending,
    getTaxConstants,
  };
}
