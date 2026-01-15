import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Expense {
  id: string;
  user_id: string;
  vendor_name: string;
  description: string | null;
  category: string;
  expense_date: string;
  amount_excl_btw: number | null;
  btw_amount: number | null;
  amount_incl_btw: number;
  btw_percentage: number | null;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ExpenseInsert = Omit<Expense, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export const EXPENSE_CATEGORIES = [
  { value: 'kantoor', label: 'Kantoorkosten' },
  { value: 'software', label: 'Software & Abonnementen' },
  { value: 'hardware', label: 'Hardware & Apparatuur' },
  { value: 'reiskosten', label: 'Reiskosten' },
  { value: 'marketing', label: 'Marketing & Reclame' },
  { value: 'telefoon', label: 'Telefoon & Internet' },
  { value: 'verzekeringen', label: 'Verzekeringen' },
  { value: 'advieskosten', label: 'Advies & Accountant' },
  { value: 'overig', label: 'Overig' },
];

export function useExpenses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('expense_date', { ascending: false });
      
      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!user,
  });

  const createExpense = useMutation({
    mutationFn: async (expense: ExpenseInsert) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('expenses')
        .insert({ ...expense, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as Expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({
        title: 'Uitgave toegevoegd',
        description: 'De uitgave is opgeslagen.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij toevoegen uitgave',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({
        title: 'Uitgave verwijderd',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    expenses,
    isLoading,
    createExpense: createExpense.mutateAsync,
    deleteExpense: deleteExpense.mutate,
    isCreating: createExpense.isPending,
  };
}
