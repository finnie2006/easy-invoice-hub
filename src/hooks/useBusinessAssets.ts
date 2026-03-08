import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface BusinessAsset {
  id: string;
  user_id: string;
  name: string;
  purchase_date: string;
  purchase_price: number;
  residual_value: number;
  useful_life_years: number;
  category: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessAssetInsert {
  name: string;
  purchase_date: string;
  purchase_price: number;
  residual_value?: number;
  useful_life_years?: number;
  category?: string;
  notes?: string | null;
}

export const ASSET_CATEGORIES = [
  { value: 'inventaris', label: 'Inventaris & inrichting' },
  { value: 'machines', label: 'Machines & apparatuur' },
  { value: 'computer', label: 'Computer & software' },
  { value: 'vervoer', label: 'Vervoermiddelen' },
  { value: 'overig', label: 'Overig' },
];

export function useBusinessAssets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['business-assets', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('business_assets')
        .select('*')
        .order('purchase_date', { ascending: false });
      if (error) throw error;
      return data as BusinessAsset[];
    },
    enabled: !!user,
  });

  const createAsset = useMutation({
    mutationFn: async (asset: BusinessAssetInsert) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('business_assets')
        .insert({ ...asset, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-assets'] });
      toast({ title: 'Bedrijfsmiddel toegevoegd' });
    },
    onError: (error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('business_assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-assets'] });
      toast({ title: 'Bedrijfsmiddel verwijderd' });
    },
    onError: (error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  // Calculate depreciation for a given year
  const getDepreciationForYear = (asset: BusinessAsset, year: number): number => {
    const purchaseYear = new Date(asset.purchase_date).getFullYear();
    const depreciableAmount = Number(asset.purchase_price) - Number(asset.residual_value);
    const yearlyDepreciation = depreciableAmount / asset.useful_life_years;
    const endYear = purchaseYear + asset.useful_life_years - 1;

    if (year < purchaseYear || year > endYear) return 0;
    
    // First year: pro-rata based on purchase month
    if (year === purchaseYear) {
      const purchaseMonth = new Date(asset.purchase_date).getMonth();
      const monthsActive = 12 - purchaseMonth;
      return yearlyDepreciation * (monthsActive / 12);
    }
    
    // Last year: remaining
    if (year === endYear) {
      const purchaseMonth = new Date(asset.purchase_date).getMonth();
      const firstYearMonths = 12 - purchaseMonth;
      const firstYearDep = yearlyDepreciation * (firstYearMonths / 12);
      const middleYears = endYear - purchaseYear - 1;
      const totalSoFar = firstYearDep + (middleYears * yearlyDepreciation);
      return depreciableAmount - totalSoFar;
    }
    
    return yearlyDepreciation;
  };

  // Get book value at end of year
  const getBookValueEndOfYear = (asset: BusinessAsset, year: number): number => {
    const purchaseYear = new Date(asset.purchase_date).getFullYear();
    if (year < purchaseYear) return 0;
    
    let totalDepreciation = 0;
    for (let y = purchaseYear; y <= year; y++) {
      totalDepreciation += getDepreciationForYear(asset, y);
    }
    
    return Math.max(Number(asset.residual_value), Number(asset.purchase_price) - totalDepreciation);
  };

  return {
    assets,
    isLoading,
    createAsset: createAsset.mutate,
    deleteAsset: deleteAsset.mutate,
    isCreating: createAsset.isPending,
    getDepreciationForYear,
    getBookValueEndOfYear,
  };
}
