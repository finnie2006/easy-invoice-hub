import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expenses as expensesApi, files as filesApi } from '@/api/client';
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
  btw_period: string | null;
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
      const response = await expensesApi.getAll();
      return response.data as Expense[];
    },
    enabled: !!user,
  });

  const uploadReceipt = async (file: File): Promise<string | null> => {
    if (!user) throw new Error('Not authenticated');

    const response = await filesApi.upload(file, 'receipts');
    return response.data.url || null;
  };

  const getReceiptUrl = (path: string): string => {
    return path;
  };

  const createExpense = useMutation({
    mutationFn: async ({ expense, file }: { expense: ExpenseInsert; file?: File }) => {
      if (!user) throw new Error('Not authenticated');
      
      let receiptUrl = expense.receipt_url;
      
      if (file) {
        receiptUrl = await uploadReceipt(file);
      }

      const response = await expensesApi.create({ ...expense, receipt_url: receiptUrl });
      return response.data as Expense;
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

  const updateExpense = useMutation({
    mutationFn: async ({ id, updates, file }: { id: string; updates: Partial<Expense>; file?: File }) => {
      if (!user) throw new Error('Not authenticated');
      
      let receiptUrl = updates.receipt_url;
      
      if (file) {
        receiptUrl = await uploadReceipt(file);
      }

      await expensesApi.update(id, { ...updates, receipt_url: receiptUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({
        title: 'Uitgave bijgewerkt',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      // First get the expense to delete the receipt if it exists
      const expense = expenses.find(e => e.id === id);
      
      if (expense?.receipt_url && expense.receipt_url.includes('/uploads/')) {
        await filesApi.remove(expense.receipt_url);
      }

      await expensesApi.delete(id);
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

  // Get signed URL for private receipt
  const getSignedReceiptUrl = async (path: string): Promise<string | null> => {
    return path || null;
  };

  return {
    expenses,
    isLoading,
    createExpense: createExpense.mutateAsync,
    updateExpense: updateExpense.mutate,
    deleteExpense: deleteExpense.mutate,
    isCreating: createExpense.isPending,
    getSignedReceiptUrl,
  };
}
