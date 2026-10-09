import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mileage as mileageApi } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface MileageEntry {
  id: string;
  user_id: string;
  travel_date: string;
  destination: string;
  purpose: string;
  kilometers: number;
  rate: number;
  notes: string | null;
  is_finalized: boolean;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
}

export type MileageEntryInsert = Omit<MileageEntry, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_finalized' | 'finalized_at'>;

export function useMileage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['mileage', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const response = await mileageApi.getAll();
      return response.data as MileageEntry[];
    },
    enabled: !!user,
  });

  const createEntry = useMutation({
    mutationFn: async (entry: MileageEntryInsert) => {
      if (!user) throw new Error('Not authenticated');
      const response = await mileageApi.create(entry);
      return response.data as MileageEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mileage'] });
      toast({ title: 'Kilometerregistratie opgeslagen' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij opslaan', description: error.message, variant: 'destructive' });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      await mileageApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mileage'] });
      toast({ title: 'Rit verwijderd' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij verwijderen', description: error.message, variant: 'destructive' });
    },
  });

  const finalizeYear = useMutation({
    mutationFn: async (year: number) => {
      if (!user) throw new Error('Not authenticated');
      const response = await mileageApi.finalizeYear(year);
      return response.data as { finalized: number };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['mileage'] });
      toast({ title: 'Ritten definitief gemaakt', description: `${result.finalized} rit(ten) tellen mee in de inkomstenbelasting.` });
    },
    onError: (error) => {
      toast({ title: 'Fout bij definitief maken', description: error.message, variant: 'destructive' });
    },
  });

  return {
    entries,
    isLoading,
    createEntry: createEntry.mutateAsync,
    deleteEntry: deleteEntry.mutate,
    isCreating: createEntry.isPending,
    finalizeYear: finalizeYear.mutateAsync,
    isFinalizing: finalizeYear.isPending,
  };
}
