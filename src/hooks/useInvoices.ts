import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
}

export interface InvoiceItemInsert {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  btw_percentage: number;
}

export function useInvoices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Invoice[];
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

  const createInvoice = useMutation({
    mutationFn: async ({ 
      invoice, 
      items 
    }: { 
      invoice: InvoiceInsert; 
      items: InvoiceItemInsert[];
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Calculate totals
      const calculatedItems = items.map((item, index) => {
        const subtotal = item.quantity * item.unit_price;
        const btw_amount = subtotal * (item.btw_percentage / 100);
        const total = subtotal + btw_amount;
        return { ...item, subtotal, btw_amount, total, sort_order: index };
      });

      const subtotal = calculatedItems.reduce((sum, item) => sum + item.subtotal, 0);
      const total_btw = calculatedItems.reduce((sum, item) => sum + item.btw_amount, 0);
      const total = subtotal + total_btw;

      // Create invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert({ 
          ...invoice, 
          user_id: user.id,
          subtotal,
          total_btw,
          total,
        })
        .select()
        .single();
      
      if (invoiceError) throw invoiceError;

      // Create invoice items
      if (calculatedItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(calculatedItems.map(item => ({
            ...item,
            invoice_id: invoiceData.id,
          })));
        
        if (itemsError) throw itemsError;
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

  // Upload attachment for external invoice
  const uploadAttachment = async (file: File, userId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('invoice-attachments')
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    return fileName;
  };

  // Get signed URL for attachment
  const getAttachmentUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('invoice-attachments')
      .createSignedUrl(path, 3600); // 1 hour expiry
    
    if (error) return null;
    return data.signedUrl;
  };

  // Create external invoice (without items, just totals)
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

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert({ 
          ...invoice, 
          user_id: user.id,
          attachment_url: attachmentUrl,
        })
        .select()
        .single();
      
      if (invoiceError) throw invoiceError;
      return invoiceData as Invoice;
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
      
      // Calculate totals
      const calculatedItems = items.map((item, index) => {
        const subtotal = item.quantity * item.unit_price;
        const btw_amount = subtotal * (item.btw_percentage / 100);
        const total = subtotal + btw_amount;
        return { ...item, subtotal, btw_amount, total, sort_order: index };
      });

      const subtotal = calculatedItems.reduce((sum, item) => sum + item.subtotal, 0);
      const total_btw = calculatedItems.reduce((sum, item) => sum + item.btw_amount, 0);
      const total = subtotal + total_btw;

      // Update invoice
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ 
          ...invoice, 
          subtotal,
          total_btw,
          total,
        })
        .eq('id', id);
      
      if (invoiceError) throw invoiceError;

      // Delete existing items and insert new ones
      const { error: deleteError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', id);
      
      if (deleteError) throw deleteError;

      // Create new invoice items
      if (calculatedItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(calculatedItems.map(item => ({
            ...item,
            invoice_id: id,
          })));
        
        if (itemsError) throw itemsError;
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
      const { error } = await supabase
        .from('invoices')
        .update({ status, paid_at })
        .eq('id', id);
      
      if (error) throw error;
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
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
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

  // Get overdue invoices (sent but not paid, past due date)
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
    updateInvoiceStatus: updateInvoiceStatus.mutate,
    deleteInvoice: deleteInvoice.mutate,
    getAttachmentUrl,
    isCreating: createInvoice.isPending,
    isCreatingExternal: createExternalInvoice.isPending,
    isUpdating: updateInvoice.isPending,
    overdueInvoices,
  };
}

export function useInvoice(id: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (invoiceError) throw invoiceError;
      if (!invoice) return null;

      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', id)
        .order('sort_order');
      
      if (itemsError) throw itemsError;

      return { ...invoice, items } as Invoice;
    },
    enabled: !!user && !!id,
  });
}
