import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { InvoiceTemplateProps } from './types';

export function OriginalTemplate({ invoice, profile }: InvoiceTemplateProps) {
  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="bg-white text-black p-12 min-h-[1123px] text-sm" style={{ fontFamily: 'Georgia, Times, serif' }}>
      {/* Elegant Company Header */}
      <div className="mb-10 border-b-2 border-gray-800 pb-6">
        <h2 className="text-3xl font-light tracking-wide text-gray-900">
          {profile?.company_name || 'Uw Bedrijf'}
        </h2>
        <p className="text-xs text-gray-500 mt-3 tracking-widest uppercase">
          {profile?.company_address} · {profile?.company_postal_code} {profile?.company_city}
        </p>
      </div>

      {/* Two Column Header: Client Left, Invoice Info Right */}
      <div className="grid grid-cols-2 gap-12 mb-10">
        {/* Client Info - Left Side */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Factuur aan</p>
          <p className="font-semibold text-lg text-gray-900">{invoice.client_company_name}</p>
          {invoice.client_address && <p className="text-gray-600 mt-1">{invoice.client_address}</p>}
          {(invoice.client_postal_code || invoice.client_city) && (
            <p className="text-gray-600">{invoice.client_postal_code} {invoice.client_city}</p>
          )}
          {invoice.client_country && <p className="text-gray-600">{invoice.client_country}</p>}
        </div>

        {/* Invoice Details - Right Side */}
        <div className="text-right">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Factuurgegevens</p>
          <div className="space-y-1">
            <p className="text-gray-900">
              <span className="text-gray-500">Nr.</span> {invoice.invoice_number}
            </p>
            <p className="text-gray-900">
              <span className="text-gray-500">Datum</span> {format(new Date(invoice.invoice_date), 'd MMMM yyyy', { locale: nl })}
            </p>
            <p className="text-gray-900">
              <span className="text-gray-500">Vervalt</span> {format(new Date(invoice.due_date), 'd MMMM yyyy', { locale: nl })}
            </p>
          </div>
        </div>
      </div>

      {/* Description Line */}
      <div className="mb-8">
        <p className="text-sm text-gray-500 italic">Betreft de volgende geleverde diensten / werkzaamheden</p>
      </div>

      {/* Invoice Items Table */}
      <table className="w-full mb-8 text-sm">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="text-left py-3 font-normal text-xs text-gray-400 uppercase tracking-widest w-12">Nr</th>
            <th className="text-left py-3 font-normal text-xs text-gray-400 uppercase tracking-widest">Omschrijving</th>
            <th className="text-right py-3 font-normal text-xs text-gray-400 uppercase tracking-widest w-20">Aantal</th>
            <th className="text-right py-3 font-normal text-xs text-gray-400 uppercase tracking-widest w-24">Prijs</th>
            <th className="text-right py-3 font-normal text-xs text-gray-400 uppercase tracking-widest w-16">BTW</th>
            <th className="text-right py-3 font-normal text-xs text-gray-400 uppercase tracking-widest w-28">Bedrag</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items?.map((item, index) => (
            <tr key={item.id} className="border-b border-gray-100">
              <td className="py-4 text-gray-400">{index + 1}</td>
              <td className="py-4 text-gray-800">{item.description}</td>
              <td className="text-right py-4 text-gray-600">{item.quantity} {item.unit || ''}</td>
              <td className="text-right py-4 text-gray-600">{formatCurrency(item.unit_price)}</td>
              <td className="text-right py-4 text-gray-600">{item.btw_percentage}%</td>
              <td className="text-right py-4 text-gray-800 font-medium">{formatCurrency(Number(item.subtotal))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals - Elegant Right Aligned */}
      <div className="flex justify-end mb-10">
        <div className="w-72">
          <div className="flex justify-between py-2 text-gray-600 border-b border-gray-100">
            <span>Subtotaal</span>
            <span>{formatCurrency(Number(invoice.subtotal))}</span>
          </div>
          <div className="flex justify-between py-2 text-gray-600 border-b border-gray-100">
            <span>BTW</span>
            <span>{formatCurrency(Number(invoice.total_btw))}</span>
          </div>
          <div className="flex justify-between py-4 mt-2 border-t-2 border-gray-800">
            <span className="text-lg font-light text-gray-900">Totaal</span>
            <span className="text-xl font-semibold text-gray-900">{formatCurrency(Number(invoice.total))}</span>
          </div>
        </div>
      </div>

      {/* Payment Info - Refined */}
      <div className="bg-gray-50 border border-gray-200 p-6 mb-8">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Betalingsgegevens</p>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            {profile?.company_name && <p className="text-gray-800">{profile.company_name}</p>}
            {profile?.iban && <p className="text-gray-600">IBAN: <span className="font-mono">{profile.iban}</span></p>}
          </div>
          <div className="text-right">
            <p className="text-gray-500">Betalen voor</p>
            <p className="text-gray-800 font-medium">{format(new Date(invoice.due_date), 'd MMMM yyyy', { locale: nl })}</p>
          </div>
        </div>
      </div>

      {/* Notes / Changelog Section */}
      {invoice.notes && (
        <div className="mb-8">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">{invoice.notes_title || 'Opmerkingen'}</p>
          <div className="border-l-2 border-gray-300 pl-4 text-sm text-gray-600 whitespace-pre-wrap">
            {invoice.notes}
          </div>
        </div>
      )}

      {/* Footer - Minimal & Elegant */}
      <div className="mt-auto pt-8 border-t border-gray-200 text-xs text-gray-400 flex justify-between">
        <div className="tracking-wide">
          {profile?.company_name}
        </div>
        <div className="text-right space-x-4">
          {profile?.kvk_number && <span>KVK {profile.kvk_number}</span>}
          {profile?.btw_number && <span>BTW {profile.btw_number}</span>}
        </div>
      </div>
    </div>
  );
}
