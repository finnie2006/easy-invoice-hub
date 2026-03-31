import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { btwFilingFields as btwFilingFieldsApi } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useInvoices } from './useInvoices';
import { useExpenses } from './useExpenses';

export interface BTWFilingFields {
  id: string;
  user_id: string;
  period: string;
  year: number;
  quarter: number;
  field_1a: number;
  field_1b: number;
  field_1c: number;
  field_1d: number;
  field_1e: number;
  field_2a: number;
  field_3a: number;
  field_3b: number;
  field_4a: number;
  field_4b: number;
  field_5a: number;
  field_5b: number;
  field_5c: number;
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

export const BTW_FIELDS = {
  '1a': { label: 'Omzetbelasting leveringen binnen NL', section: 'ontvangen' },
  '1b': {
    label: 'Omzetbelasting intracommunautaire leveringen',
    section: 'ontvangen',
  },
  '1c': { label: 'Omzetbelasting export van goederen', section: 'ontvangen' },
  '1d': {
    label: 'Omzetbelasting diensten buiten NL',
    section: 'ontvangen',
  },
  '1e': {
    label: 'Omzetbelasting diensten waarvan klant schuldenaar',
    section: 'ontvangen',
  },
  '2a': {
    label: 'Aftrekbare belasting diensten/goederen buitenland',
    section: 'aftrekbaar',
  },
  '3a': {
    label: 'Aftrekbare belasting intracommunautaire aankopen',
    section: 'aftrekbaar',
  },
  '3b': {
    label: 'Aftrekbare belasting import van goederen',
    section: 'aftrekbaar',
  },
  '4a': {
    label: 'Aftrekbare belasting aankopen goederen/diensten NL',
    section: 'aftrekbaar',
  },
  '4b': {
    label: 'Aftrekbare belasting andere zaken',
    section: 'aftrekbaar',
  },
  '5a': { label: 'Totaal ontvangen omzetbelasting', section: 'totaal' },
  '5b': { label: 'Totaal aftrekbare belasting', section: 'totaal' },
  '5c': {
    label: 'Verschuldigde omzetbelasting',
    section: 'totaal',
  },
};

export function useBTWFilingFields() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { invoices } = useInvoices();
  const { expenses } = useExpenses();

  const getByPeriod = async (period: string) => {
    if (!user) return null;
    const response = await btwFilingFieldsApi.getByPeriod(period);
    return response.data as BTWFilingFields | null;
  };

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
    onError: (error: any) => {
      toast({
        title: 'Fout bij opslaan',
        description: error.message,
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
    onError: (error: any) => {
      toast({
        title: 'Fout bij indienen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Calculate fields automatically based on invoices and expenses
  const calculateFields = (year: number, quarter: number) => {
    const quarterStart = new Date(year, (quarter - 1) * 3, 1);
    const quarterEnd = new Date(year, (quarter - 1) * 3 + 3, 0);

    // Filter invoices for quarter
    const periodInvoices = invoices.filter((inv) => {
      const invDate = new Date(inv.invoice_date);
      return (
        invDate >= quarterStart &&
        invDate <= quarterEnd &&
        inv.status === 'paid'
      );
    });

    // Filter expenses for quarter
    const periodExpenses = expenses.filter((exp) => {
      const expDate = new Date(exp.expense_date);
      return expDate >= quarterStart && expDate <= quarterEnd;
    });

    // Calculate received VAT (1a-1e)
    const field_1a = periodInvoices.reduce(
      (sum, inv) => sum + Number(inv.total_btw),
      0
    );
    const field_1b = 0; // User would enter manually
    const field_1c = 0; // User would enter manually
    const field_1d = 0; // User would enter manually
    const field_1e = 0; // User would enter manually

    // Calculate deductible VAT (2a-4b)
    const field_2a = periodExpenses
      .filter((exp) => exp.has_reverse_charge)
      .reduce((sum, exp) => sum + Number(exp.btw_amount || 0), 0);

    const field_3a = 0; // User would enter manually
    const field_3b = 0; // User would enter manually

    const field_4a = periodExpenses
      .filter((exp) => !exp.has_reverse_charge)
      .reduce((sum, exp) => sum + Number(exp.btw_amount || 0), 0);

    const field_4b = 0; // User would enter manually

    // Calculate totals (5a-5c)
    const field_5a = field_1a + field_1b + field_1c + field_1d + field_1e;
    const field_5b =
      field_2a + field_3a + field_3b + field_4a + field_4b;
    const field_5c = field_5a - field_5b;

    return {
      field_1a,
      field_1b,
      field_1c,
      field_1d,
      field_1e,
      field_2a,
      field_3a,
      field_3b,
      field_4a,
      field_4b,
      field_5a,
      field_5b,
      field_5c,
    };
  };

  return {
    getByPeriod,
    upsert,
    submit,
    calculateFields,
  };
}
