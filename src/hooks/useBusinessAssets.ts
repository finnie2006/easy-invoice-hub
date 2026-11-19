import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { businessAssets as businessAssetsApi } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  getBookValueEndOfYear,
  getCapitalizedExpenseIds,
  getDepreciationForYear,
} from '@/lib/depreciation';

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
  expense_id: string | null;
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
  expense_id?: string | null;
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
      const response = await businessAssetsApi.getAll();
      return response.data as BusinessAsset[];
    },
    enabled: !!user,
  });

  const createAsset = useMutation({
    mutationFn: async (asset: BusinessAssetInsert) => {
      if (!user) throw new Error('Not authenticated');
      await businessAssetsApi.create(asset);
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
      await businessAssetsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-assets'] });
      toast({ title: 'Bedrijfsmiddel verwijderd' });
    },
    onError: (error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const updateAsset = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<BusinessAssetInsert> }) => {
      await businessAssetsApi.update(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-assets'] });
    },
    onError: (error) => {
      toast({ title: 'Fout bij bijwerken bedrijfsmiddel', description: error.message, variant: 'destructive' });
    },
  });

  const capitalizedExpenseIds = getCapitalizedExpenseIds(assets);
  const getAssetForExpense = (expenseId: string) => assets.find((asset) => asset.expense_id === expenseId);

  return {
    assets,
    isLoading,
    createAsset: createAsset.mutate,
    createAssetAsync: createAsset.mutateAsync,
    updateAssetAsync: updateAsset.mutateAsync,
    deleteAsset: deleteAsset.mutate,
    deleteAssetAsync: deleteAsset.mutateAsync,
    isCreating: createAsset.isPending,
    capitalizedExpenseIds,
    getAssetForExpense,
    getDepreciationForYear,
    getBookValueEndOfYear,
  };
}
