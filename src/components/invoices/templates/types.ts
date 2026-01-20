import { Profile } from '@/hooks/useProfile';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  btw_percentage: number;
  subtotal: number;
  btw_amount: number;
  total: number;
}

export interface InvoiceData {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  client_company_name: string | null;
  client_contact_name: string | null;
  client_address: string | null;
  client_postal_code: string | null;
  client_city: string | null;
  client_country: string | null;
  client_kvk_number: string | null;
  client_btw_number: string | null;
  subtotal: number;
  total_btw: number;
  total: number;
  notes: string | null;
  notes_title: string | null;
  items: InvoiceItem[];
}

export interface InvoiceTemplateProps {
  invoice: InvoiceData;
  profile: Profile | null;
}

export type InvoiceDesign = 'original' | 'classic' | 'modern' | 'minimal' | 'bold';

export const INVOICE_DESIGNS: { id: InvoiceDesign; name: string; description: string }[] = [
  { id: 'original', name: 'Origineel', description: 'Uw huidige factuurstijl' },
  { id: 'classic', name: 'Klassiek', description: 'Professionele traditionele stijl' },
  { id: 'modern', name: 'Modern', description: 'Strak en eigentijds design' },
  { id: 'minimal', name: 'Minimalistisch', description: 'Rustig en overzichtelijk' },
  { id: 'bold', name: 'Opvallend', description: 'Kleurrijk en dynamisch' },
];
