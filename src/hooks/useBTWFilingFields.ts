import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { btwFilingFields as btwFilingFieldsApi } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useInvoices } from './useInvoices';
import { useExpenses } from './useExpenses';
import {
  BTW_QUESTIONS,
  BtwFilingAmounts,
  calculateBtwFilingAmounts,
} from '@/lib/btw-filing';

export interface BTWFilingFields extends BtwFilingAmounts {
  id: string;
  user_id: string;
  period: string;
  year: number;
  quarter: number;
  submitted: boolean;
  submitted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type BTWFilingFieldsInsert = Omit<
  BTWFilingFields,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>;

export const BTW_FIELDS = BTW_QUESTIONS;

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Er is een onbekende fout opgetreden.';
};

export function useBTWFilingFields() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { invoices } = useInvoices();
  const { expenses } = useExpenses();

  const getByPeriod = useCallback(async (period: string) => {
    if (!user) return null;
    const response = await btwFilingFieldsApi.getByPeriod(period);
    return response.data as BTWFilingFields | null;
  }, [user]);

  const upsert = useMutation({
    mutationFn: async (data: BTWFilingFieldsInsert) => {
      if (!user) throw new Error('Not authenticated');
      const response = await btwFilingFieldsApi.upsert(data);
      return response.data as BTWFilingFields;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['btw-filing-fields'] });
      toast({
        title: 'Aangifte opgeslagen',
        description: 'Uw BTW-aangifte is opgeslagen.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Fout bij opslaan',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const submit = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      const response = await btwFilingFieldsApi.submit(id);
      return response.data as BTWFilingFields;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['btw-filing-fields'] });
      toast({
        title: 'Aangifte ingediend',
        description: 'Uw BTW-aangifte is ingediend.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Fout bij indienen',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  // Calculate official Dutch VAT return fields from available invoice and expense data.
  const calculateFields = useCallback((year: number, quarter: number) => {
    return calculateBtwFilingAmounts(year, quarter, invoices, expenses);
  }, [expenses, invoices]);

  return {
    getByPeriod,
    upsert,
    submit,
    calculateFields,
  };
}
