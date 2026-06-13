import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { sanitizeRichTextHtml } from '@/lib/sanitize-html';
import { InvoiceTemplateProps } from './types';

const colorThemes = {
  gray: { primary: '#1F2937', secondary: '#4B5563', accent: '#6B7280', light: '#F3F4F6', border: '#D1D5DB' },
  blue: { primary: '#1E40AF', secondary: '#3B82F6', accent: '#60A5FA', light: '#EFF6FF', border: '#BFDBFE' },
  emerald: { primary: '#047857', secondary: '#10B981', accent: '#34D399', light: '#ECFDF5', border: '#A7F3D0' },
  amber: { primary: '#B45309', secondary: '#F59E0B', accent: '#FBBF24', light: '#FFFBEB', border: '#FDE68A' },
  rose: { primary: '#BE123C', secondary: '#F43F5E', accent: '#FB7185', light: '#FFF1F2', border: '#FECDD3' },
  purple: { primary: '#7C3AED', secondary: '#8B5CF6', accent: '#A78BFA', light: '#F5F3FF', border: '#DDD6FE' },
};

export function OriginalTemplate({ invoice, profile }: InvoiceTemplateProps) {
  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const themeKey = (profile?.invoice_color_theme || 'gray') as keyof typeof colorThemes;
  const theme = colorThemes[themeKey] || colorThemes.gray;

  const hasItemDiscounts = invoice.items?.some(item => item.discount_type && item.discount_value > 0);
  const hasInvoiceDiscount = invoice.discount_type && invoice.discount_amount > 0;
  const sanitizedNotes = sanitizeRichTextHtml(invoice.notes);

  return (
    <div className="bg-white text-gray-900 p-12 min-h-[1123px] flex flex-col text-sm" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div data-pdf-section className="mb-10 pb-6" style={{ borderBottom: `2px solid ${theme.primary}` }}>
        <h2 className="text-3xl font-semibold tracking-tight" style={{ color: theme.primary }}>{profile?.company_name || 'Uw Bedrijf'}</h2>
        <p className="text-xs mt-3 tracking-wide uppercase" style={{ color: theme.accent }}>
          {profile?.company_address} · {profile?.company_postal_code} {profile?.company_city}
        </p>
      </div>

      <div data-pdf-section className="grid grid-cols-2 gap-12 mb-10">
        <div>
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: theme.accent }}>Factuur aan</p>
          <p className="font-semibold text-lg" style={{ color: theme.primary }}>{invoice.client_company_name}</p>
          {invoice.client_address && <p className="text-gray-600 mt-1">{invoice.client_address}</p>}
          {(invoice.client_postal_code || invoice.client_city) && (
            <p className="text-gray-600">{invoice.client_postal_code} {invoice.client_city}</p>
          )}
          {invoice.client_country && <p className="text-gray-600">{invoice.client_country}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: theme.accent }}>Factuurgegevens</p>
          <div className="space-y-1">
            <p><span className="text-gray-500">Nr.</span> {invoice.invoice_number}</p>
            <p><span className="text-gray-500">Datum</span> {format(new Date(invoice.invoice_date), 'd MMMM yyyy', { locale: nl })}</p>
            <p><span className="text-gray-500">Vervalt</span> {format(new Date(invoice.due_date), 'd MMMM yyyy', { locale: nl })}</p>
          </div>
        </div>
      </div>

      <div data-pdf-section className="mb-8">
        <p className="text-sm text-gray-500">Betreft de volgende geleverde diensten / werkzaamheden</p>
      </div>

      <div data-pdf-section>
        <table className="w-full mb-8 text-sm">
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
              <th className="text-left py-3 font-medium text-xs uppercase tracking-wide w-12" style={{ color: theme.accent }}>Nr</th>
              <th className="text-left py-3 font-medium text-xs uppercase tracking-wide" style={{ color: theme.accent }}>Omschrijving</th>
              <th className="text-right py-3 font-medium text-xs uppercase tracking-wide w-20" style={{ color: theme.accent }}>Aantal</th>
              <th className="text-right py-3 font-medium text-xs uppercase tracking-wide w-24" style={{ color: theme.accent }}>Prijs</th>
              {hasItemDiscounts && <th className="text-right py-3 font-medium text-xs uppercase tracking-wide w-20" style={{ color: theme.accent }}>Korting</th>}
              <th className="text-right py-3 font-medium text-xs uppercase tracking-wide w-16" style={{ color: theme.accent }}>BTW</th>
              <th className="text-right py-3 font-medium text-xs uppercase tracking-wide w-28" style={{ color: theme.accent }}>Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item, index) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-4 text-gray-400">{index + 1}</td>
                <td className="py-4 text-gray-800">{item.description}</td>
                <td className="text-right py-4 text-gray-600">{item.quantity} {item.unit || ''}</td>
                <td className="text-right py-4 text-gray-600">{formatCurrency(item.unit_price)}</td>
                {hasItemDiscounts && (
                  <td className="text-right py-4 text-gray-600">
                    {item.discount_type && item.discount_value > 0 
                      ? item.discount_type === 'percentage' ? `${item.discount_value}%` : formatCurrency(item.discount_value)
                      : '—'}
                  </td>
                )}
                <td className="text-right py-4 text-gray-600">{item.btw_percentage}%</td>
                <td className="text-right py-4 font-medium" style={{ color: theme.primary }}>{formatCurrency(Number(item.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div data-pdf-section className="flex justify-end mb-10">
        <div className="w-72">
          <div className="flex justify-between py-2 text-gray-600 border-b border-gray-100">
            <span>Subtotaal</span>
            <span>{formatCurrency(Number(invoice.subtotal))}</span>
          </div>
          {hasInvoiceDiscount && (
            <div className="flex justify-between py-2 text-red-600 border-b border-gray-100">
              <span>Korting{invoice.discount_type === 'percentage' ? ` (${invoice.discount_value}%)` : ''}</span>
              <span>-{formatCurrency(Number(invoice.discount_amount))}</span>
            </div>
          )}
          <div className="flex justify-between py-2 text-gray-600 border-b border-gray-100">
            <span>BTW</span>
            <span>{formatCurrency(Number(invoice.total_btw))}</span>
          </div>
          <div className="flex justify-between py-4 mt-2" style={{ borderTop: `2px solid ${theme.primary}` }}>
            <span className="text-lg font-medium" style={{ color: theme.primary }}>Totaal</span>
            <span className="text-xl font-bold" style={{ color: theme.primary }}>{formatCurrency(Number(invoice.total))}</span>
          </div>
        </div>
      </div>

      <div data-pdf-section className="p-6 mb-8 rounded-lg" style={{ backgroundColor: theme.light, border: `1px solid ${theme.border}` }}>
        <p className="text-xs uppercase tracking-wide mb-3" style={{ color: theme.accent }}>Betalingsgegevens</p>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            {(profile?.payment_name || profile?.company_name) && <p style={{ color: theme.primary }}>{profile?.payment_name || profile?.company_name}</p>}
            {profile?.iban && <p className="text-gray-600">IBAN: <span className="font-mono">{profile.iban}</span></p>}
          </div>
          <div className="text-right">
            <p className="text-gray-500">Betalen voor</p>
            <p className="font-medium" style={{ color: theme.primary }}>{format(new Date(invoice.due_date), 'd MMMM yyyy', { locale: nl })}</p>
          </div>
        </div>
      </div>

      {sanitizedNotes && (
        <div data-pdf-section data-pdf-start-page="2" className="mb-8">
          <p className="text-xs uppercase tracking-wide mb-3" style={{ color: theme.accent }}>{invoice.notes_title || 'Opmerkingen'}</p>
          <div className="pl-4 text-sm text-gray-600 whitespace-pre-wrap" style={{ borderLeft: `2px solid ${theme.border}` }} dangerouslySetInnerHTML={{ __html: sanitizedNotes }} />
        </div>
      )}

      <div data-pdf-section data-pdf-stick-bottom className="mt-auto pt-8 border-t border-gray-200 text-xs text-gray-400 flex justify-between">
        <div className="tracking-wide">{profile?.company_name}</div>
        <div className="text-right space-x-4">
          {profile?.kvk_number && <span>KVK {profile.kvk_number}</span>}
          {profile?.btw_number && <span>BTW {profile.btw_number}</span>}
        </div>
      </div>
    </div>
  );
}
