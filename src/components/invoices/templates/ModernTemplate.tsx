import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { InvoiceTemplateProps } from './types';

export function ModernTemplate({ invoice, profile }: InvoiceTemplateProps) {
  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const hasItemDiscounts = invoice.items?.some(item => item.discount_type && item.discount_value > 0);
  const hasInvoiceDiscount = invoice.discount_type && invoice.discount_amount > 0;

  return (
    <div className="bg-white text-black min-h-[1123px] flex flex-col" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
      {/* Header with accent sidebar */}
      <div data-pdf-section className="flex">
        <div className="w-2 bg-emerald-500"></div>
        <div className="flex-1 p-10 pb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {profile?.company_name || 'Uw Bedrijf'}
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                {profile?.company_address}<br />
                {profile?.company_postal_code} {profile?.company_city}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-light text-gray-300">FACTUUR</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">#{invoice.invoice_number}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-10 pb-16 flex-1 flex flex-col">
        {/* Two Column Info */}
        <div data-pdf-section className="flex justify-between mb-10 pb-6 border-b border-gray-200">
          <div>
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mb-2">Factuur aan</p>
            <p className="font-semibold text-lg text-gray-900">{invoice.client_company_name}</p>
            {invoice.client_address && <p className="text-gray-600 text-sm">{invoice.client_address}</p>}
            <p className="text-gray-600 text-sm">{invoice.client_postal_code} {invoice.client_city}</p>
          </div>
          <div className="text-right">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Factuurdatum</p>
                <p className="font-semibold text-gray-900">{format(new Date(invoice.invoice_date), 'd MMM yyyy', { locale: nl })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Vervaldatum</p>
                <p className="font-semibold text-gray-900">{format(new Date(invoice.due_date), 'd MMM yyyy', { locale: nl })}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Items */}
        <div data-pdf-section className="mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 font-semibold text-gray-500 uppercase text-xs">Omschrijving</th>
                <th className="text-right py-3 font-semibold text-gray-500 uppercase text-xs w-24">Aantal</th>
                <th className="text-right py-3 font-semibold text-gray-500 uppercase text-xs w-24">Prijs</th>
                {hasItemDiscounts && <th className="text-right py-3 font-semibold text-gray-500 uppercase text-xs w-20">Korting</th>}
                <th className="text-right py-3 font-semibold text-gray-500 uppercase text-xs w-20">BTW</th>
                <th className="text-right py-3 font-semibold text-gray-500 uppercase text-xs w-28">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-4 text-gray-800 whitespace-pre-wrap">{item.description}</td>
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
                  <td className="text-right py-4 font-medium text-gray-900">{formatCurrency(Number(item.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div data-pdf-section className="flex justify-end mb-10">
          <div className="w-72">
            <div className="flex justify-between py-2 text-gray-600">
              <span>Subtotaal</span>
              <span>{formatCurrency(Number(invoice.subtotal))}</span>
            </div>
            {hasInvoiceDiscount && (
              <div className="flex justify-between py-2 text-red-600">
                <span>Korting{invoice.discount_type === 'percentage' ? ` (${invoice.discount_value}%)` : ''}</span>
                <span>-{formatCurrency(Number(invoice.discount_amount))}</span>
              </div>
            )}
            <div className="flex justify-between py-2 text-gray-600">
              <span>BTW</span>
              <span>{formatCurrency(Number(invoice.total_btw))}</span>
            </div>
            <div className="flex justify-between py-3 mt-2 border-t-2 border-emerald-500">
              <span className="font-bold text-gray-900">Totaal</span>
              <span className="font-bold text-lg text-emerald-600">{formatCurrency(Number(invoice.total))}</span>
            </div>
          </div>
            </div>

        {/* Payment Info */}
        <div data-pdf-section className="bg-gray-50 border-l-4 border-emerald-500 p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold text-gray-900 mb-2">Betalingsinformatie</p>
              <div className="text-sm text-gray-600 space-y-1">
                {(profile?.payment_name || profile?.company_name) && <p>T.n.v.: {profile?.payment_name || profile?.company_name}</p>}
                {profile?.iban && <p>IBAN: <span className="font-mono">{profile.iban}</span></p>}
                <p>Referentie: {invoice.invoice_number}</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="text-gray-500">Betalen voor</p>
              <p className="font-bold text-gray-900">{format(new Date(invoice.due_date), 'd MMMM yyyy', { locale: nl })}</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div data-pdf-section data-pdf-start-page="2" className="mb-6 text-sm">
            <p className="font-semibold text-gray-900 mb-2">{invoice.notes_title || 'Opmerkingen'}</p>
            <div className="text-gray-600 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: invoice.notes }} />
          </div>
        )}

        {/* Footer */}
        <div data-pdf-section className="mt-auto pt-6 border-t border-gray-200 text-xs text-gray-400 flex justify-between">
          <div>{profile?.company_name}</div>
          <div className="space-x-4">
            {profile?.kvk_number && <span>KVK: {profile.kvk_number}</span>}
            {profile?.btw_number && <span>BTW: {profile.btw_number}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
