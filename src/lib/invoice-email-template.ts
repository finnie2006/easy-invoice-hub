import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

export const DEFAULT_INVOICE_EMAIL_SUBJECT = 'Factuur {factuurnummer}';

export const DEFAULT_INVOICE_EMAIL_BODY = `Beste {klantnaam},

Hierbij ontvang je factuur {factuurnummer}.

Factuurdatum: {factuurdatum}
Vervaldatum: {vervaldatum}
Totaalbedrag: {totaalbedrag}

Met vriendelijke groet,
{bedrijfsnaam}`;

export const INVOICE_EMAIL_VARIABLES = [
  { token: '{factuurnummer}', description: 'Factuurnummer' },
  { token: '{factuurdatum}', description: 'Factuurdatum' },
  { token: '{vervaldatum}', description: 'Vervaldatum' },
  { token: '{totaalbedrag}', description: 'Totaalbedrag' },
  { token: '{klantnaam}', description: 'Naam ontvanger of klant' },
  { token: '{contactnaam}', description: 'Contactpersoon' },
  { token: '{bedrijfsnaam}', description: 'Je bedrijfsnaam' },
  { token: '{iban}', description: 'IBAN' },
  { token: '{betaalreferentie}', description: 'Betaalreferentie' },
] as const;

interface InvoiceEmailInvoice {
  invoice_number?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  total?: number | string | null;
  payment_reference?: string | null;
  client_company_name?: string | null;
  client_contact_name?: string | null;
}

interface InvoiceEmailProfile {
  company_name?: string | null;
  iban?: string | null;
}

function formatDate(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return format(date, 'd MMMM yyyy', { locale: nl });
}

function formatCurrency(value?: number | string | null) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function getInvoiceEmailVariables(
  invoice: InvoiceEmailInvoice,
  profile?: InvoiceEmailProfile | null,
  recipientName?: string,
) {
  const contactName = recipientName || invoice.client_contact_name || '';
  const clientName = contactName || invoice.client_company_name || 'klant';

  return {
    factuurnummer: invoice.invoice_number || '',
    factuurdatum: formatDate(invoice.invoice_date),
    vervaldatum: formatDate(invoice.due_date),
    totaalbedrag: formatCurrency(invoice.total),
    klantnaam: clientName,
    contactnaam: contactName,
    bedrijfsnaam: profile?.company_name || 'Easy Invoice Hub',
    iban: profile?.iban || '',
    betaalreferentie: invoice.payment_reference || invoice.invoice_number || '',
  };
}

export function renderInvoiceEmailTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
  });
}
