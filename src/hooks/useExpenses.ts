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

  const uploadReceipt = async (file: File): Promise<string | null> => {
    if (!user) throw new Error('Not authenticated');
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    
    const { data } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName);
    
    return data.publicUrl;
  };

  const getReceiptUrl = (path: string): string => {
    const { data } = supabase.storage
      .from('receipts')
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const createExpense = useMutation({
    mutationFn: async ({ expense, file }: { expense: ExpenseInsert; file?: File }) => {
      if (!user) throw new Error('Not authenticated');
      
      let receiptUrl = expense.receipt_url;
      
      if (file) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        // Store the path, not the full URL
        receiptUrl = filePath;
      }
      
      const { data, error } = await supabase
        .from('expenses')
        .insert({ ...expense, receipt_url: receiptUrl, user_id: user.id })
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

  const updateExpense = useMutation({
    mutationFn: async ({ id, updates, file }: { id: string; updates: Partial<Expense>; file?: File }) => {
      if (!user) throw new Error('Not authenticated');
      
      let receiptUrl = updates.receipt_url;
      
      if (file) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        receiptUrl = filePath;
      }
      
      const { error } = await supabase
        .from('expenses')
        .update({ ...updates, receipt_url: receiptUrl })
        .eq('id', id);
      
      if (error) throw error;
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
      
      if (expense?.receipt_url) {
        await supabase.storage
          .from('receipts')
          .remove([expense.receipt_url]);
      }
      
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

  // Get signed URL for private receipt
  const getSignedReceiptUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('receipts')
      .createSignedUrl(path, 3600); // 1 hour expiry
    
    if (error) return null;
    return data.signedUrl;
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
