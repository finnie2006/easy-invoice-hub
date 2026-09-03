import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoices as invoicesApi, invoiceItems as invoiceItemsApi, files as filesApi } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  btw_percentage: number;
  subtotal: number;
  btw_amount: number;
  total: number;
  sort_order: number;
  discount_type: string | null;
  discount_value: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  total_btw: number;
  total: number;
  discount_type: string | null;
  discount_value: number;
  discount_amount: number;
  notes: string | null;
  notes_title: string | null;
  payment_reference: string | null;
  client_company_name: string | null;
  client_contact_name: string | null;
  client_address: string | null;
  client_postal_code: string | null;
  client_city: string | null;
  client_country: string | null;
  client_kvk_number: string | null;
  client_btw_number: string | null;
  paid_at: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
}

export interface InvoiceInsert {
  client_id?: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status?: string;
  notes?: string;
  notes_title?: string;
  payment_reference?: string;
  client_company_name?: string;
  client_contact_name?: string;
  client_address?: string;
  client_postal_code?: string;
  client_city?: string;
  client_country?: string;
  client_kvk_number?: string;
  client_btw_number?: string;
  discount_type?: string | null;
  discount_value?: number;
}

export interface InvoiceItemInsert {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  btw_percentage: number;
  discount_type?: string | null;
  discount_value?: number;
}

// Calculate item totals with discount
export function calculateItemTotals(item: InvoiceItemInsert) {
  const lineSubtotal = item.quantity * item.unit_price;
  let discountAmount = 0;
  if (item.discount_type === 'percentage' && item.discount_value) {
    discountAmount = lineSubtotal * (item.discount_value / 100);
  } else if (item.discount_type === 'amount' && item.discount_value) {
    discountAmount = item.discount_value;
  }
  const subtotal = lineSubtotal - discountAmount;
  const btw_amount = subtotal * (item.btw_percentage / 100);
  const total = subtotal + btw_amount;
  return { subtotal, btw_amount, total, discountAmount };
}

export function useInvoices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const response = await invoicesApi.getAll();
      return response.data as Invoice[];
    },
    enabled: !!user,
  });

  const getNextInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const existingNumbers = invoices
      .filter(inv => inv.invoice_number.startsWith(year.toString()))
      .map(inv => parseInt(inv.invoice_number.slice(-3)) || 0);
    
    const nextNumber = existingNumbers.length > 0 
      ? Math.max(...existingNumbers) + 1 
      : 1;
    
    return `${year}${String(nextNumber).padStart(3, '0')}`;
  };

  const calculateTotals = (items: InvoiceItemInsert[], invoiceDiscountType?: string | null, invoiceDiscountValue?: number) => {
    const calculatedItems = items.map((item, index) => {
      const { subtotal, btw_amount, total } = calculateItemTotals(item);
      return { ...item, subtotal, btw_amount, total, sort_order: index };
    });

    const subtotal = calculatedItems.reduce((sum, item) => sum + item.subtotal, 0);
    let total_btw = calculatedItems.reduce((sum, item) => sum + item.btw_amount, 0);

    // Apply invoice-level discount
    let invoiceDiscountAmount = 0;
    if (invoiceDiscountType === 'percentage' && invoiceDiscountValue) {
      invoiceDiscountAmount = subtotal * (invoiceDiscountValue / 100);
    } else if (invoiceDiscountType === 'amount' && invoiceDiscountValue) {
      invoiceDiscountAmount = invoiceDiscountValue;
    }

    const discountedSubtotal = subtotal - invoiceDiscountAmount;
    // Recalculate BTW proportionally if there's an invoice discount
    if (invoiceDiscountAmount > 0 && subtotal > 0) {
      const ratio = discountedSubtotal / subtotal;
      total_btw = total_btw * ratio;
    }

    const total = discountedSubtotal + total_btw;

    return { calculatedItems, subtotal, total_btw, total, invoiceDiscountAmount };
  };

  const createInvoice = useMutation({
    mutationFn: async ({ 
      invoice, 
      items 
    }: { 
      invoice: InvoiceInsert; 
      items: InvoiceItemInsert[];
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { calculatedItems, subtotal, total_btw, total, invoiceDiscountAmount } = calculateTotals(
        items, invoice.discount_type, invoice.discount_value
      );

      const invoiceResponse = await invoicesApi.create({
        ...invoice,
        subtotal,
        total_btw,
        total,
        discount_amount: invoiceDiscountAmount,
      });
      const invoiceData = invoiceResponse.data as Invoice;

      if (calculatedItems.length > 0) {
        await Promise.all(
          calculatedItems.map((item) =>
            invoiceItemsApi.create({
              ...item,
              invoice_id: invoiceData.id,
            })
          )
        );
      }

      return invoiceData as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({
        title: 'Factuur aangemaakt',
        description: 'De factuur is succesvol aangemaakt.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken factuur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const uploadAttachment = async (file: File, userId: string): Promise<string> => {
    if (!userId) throw new Error('Not authenticated');
    const response = await filesApi.upload(file, 'invoice-attachments');
    return response.data.url;
  };

  const createExternalInvoice = useMutation({
    mutationFn: async ({ 
      invoice, 
      file 
    }: { 
      invoice: InvoiceInsert & { 
        subtotal: number; 
        total_btw: number; 
        total: number;
      };
      file?: File;
    }) => {
      if (!user) throw new Error('Not authenticated');

      let attachmentUrl: string | null = null;
      if (file) {
        attachmentUrl = await uploadAttachment(file, user.id);
      }

      const response = await invoicesApi.create({
        ...invoice,
        attachment_url: attachmentUrl,
      });
      return response.data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({
        title: 'Externe factuur geregistreerd',
        description: 'De factuur is succesvol toegevoegd.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij registreren factuur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateAttachment = useMutation({
    mutationFn: async ({ 
      invoiceId, 
      file 
    }: { 
      invoiceId: string;
      file: File | null;
    }) => {
      if (!user) throw new Error('Not authenticated');

      let attachmentUrl: string | null = null;
      
      if (file) {
        attachmentUrl = await uploadAttachment(file, user.id);
      }

      await invoicesApi.update(invoiceId, { attachment_url: attachmentUrl });
      return attachmentUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      toast({
        title: 'Bijlage bijgewerkt',
        description: 'De factuur bijlage is opgeslagen.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij uploaden bijlage',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ 
      id,
      invoice, 
      items 
    }: { 
      id: string;
      invoice: Partial<InvoiceInsert>; 
      items: InvoiceItemInsert[];
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { calculatedItems, subtotal, total_btw, total, invoiceDiscountAmount } = calculateTotals(
        items, invoice.discount_type, invoice.discount_value
      );

      await invoicesApi.update(id, {
        ...invoice,
        subtotal,
        total_btw,
        total,
        discount_amount: invoiceDiscountAmount,
      });

      const existingInvoiceResponse = await invoicesApi.getOne(id);
      const existingItems = (existingInvoiceResponse.data?.items || []) as InvoiceItem[];
      await Promise.all(existingItems.map((item) => invoiceItemsApi.delete(item.id)));

      if (calculatedItems.length > 0) {
        await Promise.all(
          calculatedItems.map((item) =>
            invoiceItemsApi.create({
              ...item,
              invoice_id: id,
            })
          )
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      toast({
        title: 'Factuur bijgewerkt',
        description: 'De wijzigingen zijn opgeslagen.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken factuur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateInvoiceStatus = useMutation({
    mutationFn: async ({ id, status, paid_at }: { id: string; status: string; paid_at?: string }) => {
      const payload: { status: string; paid_at?: string | null } = { status };
      if (status === 'paid') {
        payload.paid_at = paid_at || new Date().toISOString();
      } else if (paid_at) {
        payload.paid_at = paid_at;
      }
      await invoicesApi.update(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({
        title: 'Status bijgewerkt',
        description: 'De factuurstatus is aangepast.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      await invoicesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({
        title: 'Factuur verwijderd',
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

  const overdueInvoices = invoices.filter(inv => {
    if (inv.status === 'paid' || inv.status === 'cancelled') return false;
    const dueDate = new Date(inv.due_date);
    return dueDate < new Date();
  });

  return {
    invoices,
    isLoading,
    getNextInvoiceNumber,
    createInvoice: createInvoice.mutateAsync,
    createExternalInvoice: createExternalInvoice.mutateAsync,
    updateInvoice: updateInvoice.mutateAsync,
    updateInvoiceStatus: updateInvoiceStatus.mutateAsync,
    updateAttachment: updateAttachment.mutateAsync,
    deleteInvoice: deleteInvoice.mutate,
    isCreating: createInvoice.isPending,
    isCreatingExternal: createExternalInvoice.isPending,
    isUpdating: updateInvoice.isPending,
    isUpdatingAttachment: updateAttachment.isPending,
    overdueInvoices,
  };
}

export function useInvoice(id: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      if (!user) return null;

      const response = await invoicesApi.getOne(id);
      return (response.data || null) as Invoice | null;
    },
    enabled: !!user && !!id,
  });
}
