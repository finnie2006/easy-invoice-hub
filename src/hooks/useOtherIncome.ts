import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { otherIncome as otherIncomeApi } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface OtherIncome {
  id: string;
  user_id: string;
  source_name: string;
  description: string | null;
  category: string;
  income_date: string;
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type OtherIncomeInsert = Omit<OtherIncome, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export const OTHER_INCOME_CATEGORIES = [
  { value: 'contant', label: 'Contant werk' },
  { value: 'pin', label: 'Pinbetaling' },
  { value: 'bank', label: 'Bankbetaling' },
  { value: 'marktplaats', label: 'Verkoop' },
  { value: 'overig', label: 'Overig' },
];

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Er is een onbekende fout opgetreden.';
};

export function useOtherIncome() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: otherIncome = [], isLoading } = useQuery({
    queryKey: ['other-income', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const response = await otherIncomeApi.getAll();
      return response.data as OtherIncome[];
    },
    enabled: !!user,
  });

  const createIncome = useMutation({
    mutationFn: async (income: OtherIncomeInsert) => {
      if (!user) throw new Error('Not authenticated');
      const response = await otherIncomeApi.create(income);
      return response.data as OtherIncome;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['other-income'] });
      toast({
        title: 'Inkomst toegevoegd',
        description: 'De inkomst is opgeslagen.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Fout bij toevoegen',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const updateIncome = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<OtherIncomeInsert> }) => {
      if (!user) throw new Error('Not authenticated');
      const response = await otherIncomeApi.update(id, updates);
      return response.data as OtherIncome;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['other-income'] });
      toast({
        title: 'Inkomst bijgewerkt',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Fout bij bijwerken',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const deleteIncome = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      await otherIncomeApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['other-income'] });
      toast({
        title: 'Inkomst verwijderd',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Fout bij verwijderen',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  return {
    otherIncome,
    isLoading,
    createIncome: createIncome.mutateAsync,
    updateIncome: updateIncome.mutateAsync,
    deleteIncome: deleteIncome.mutate,
    isCreating: createIncome.isPending,
    isUpdating: updateIncome.isPending,
  };
}
