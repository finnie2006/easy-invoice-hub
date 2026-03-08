import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { InvoiceTemplateProps } from './types';

export function BoldTemplate({ invoice, profile }: InvoiceTemplateProps) {
  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="bg-white text-black min-h-[1123px]" style={{ fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif' }}>
      {/* Executive Header */}
      <div className="bg-slate-900 text-white p-10">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {profile?.company_name || 'Uw Bedrijf'}
            </h1>
            <p className="text-slate-400 mt-2 text-sm">
              {profile?.company_address} · {profile?.company_postal_code} {profile?.company_city}
            </p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-black text-slate-600">#{invoice.invoice_number.slice(-3)}</p>
          </div>
        </div>
      </div>

      {/* Invoice Badge Strip */}
      <div className="bg-amber-500 px-10 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-sm tracking-wide">FACTUUR</span>
          <span className="bg-white/20 text-white px-3 py-1 rounded text-sm font-mono">
            {invoice.invoice_number}
          </span>
        </div>
        <div className="text-white text-right">
          <span className="text-white/80 text-sm mr-2">Totaal:</span>
          <span className="text-xl font-bold">{formatCurrency(Number(invoice.total))}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-10">
        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-8 mb-10">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Gefactureerd aan</p>
            <p className="font-bold text-xl text-slate-900">{invoice.client_company_name}</p>
            {invoice.client_address && <p className="text-slate-600 mt-1">{invoice.client_address}</p>}
            <p className="text-slate-600">{invoice.client_postal_code} {invoice.client_city}</p>
          </div>
          <div className="text-right">
            <div className="inline-block text-left">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <p className="text-slate-400">Factuurdatum</p>
                <p className="font-semibold text-slate-900">{format(new Date(invoice.invoice_date), 'd MMM yyyy', { locale: nl })}</p>
                <p className="text-slate-400">Vervaldatum</p>
                <p className="font-semibold text-slate-900">{format(new Date(invoice.due_date), 'd MMM yyyy', { locale: nl })}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Items */}
        <div className="mb-10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-900">
                <th className="text-left py-3 font-bold text-slate-900 uppercase text-xs tracking-wide">Omschrijving</th>
                <th className="text-right py-3 font-bold text-slate-900 uppercase text-xs tracking-wide w-20">Aantal</th>
                <th className="text-right py-3 font-bold text-slate-900 uppercase text-xs tracking-wide w-24">Prijs</th>
                <th className="text-right py-3 font-bold text-slate-900 uppercase text-xs tracking-wide w-16">BTW</th>
                <th className="text-right py-3 font-bold text-slate-900 uppercase text-xs tracking-wide w-28">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item, index) => (
                <tr 
                  key={item.id} 
                  className={`border-b border-slate-200 ${index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}
                >
                  <td className="py-4 font-medium text-slate-800">{item.description}</td>
                  <td className="text-right py-4 text-slate-600">{item.quantity} {item.unit || ''}</td>
                  <td className="text-right py-4 text-slate-600">{formatCurrency(item.unit_price)}</td>
                  <td className="text-right py-4 text-slate-600">{item.btw_percentage}%</td>
                  <td className="text-right py-4 font-bold text-slate-900">{formatCurrency(Number(item.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-10">
          <div className="w-80">
            <div className="flex justify-between py-2 text-slate-600">
              <span>Subtotaal</span>
              <span>{formatCurrency(Number(invoice.subtotal))}</span>
            </div>
            <div className="flex justify-between py-2 text-slate-600">
              <span>BTW</span>
              <span>{formatCurrency(Number(invoice.total_btw))}</span>
            </div>
            <div className="flex justify-between py-4 mt-2 bg-slate-900 text-white px-4 -mx-4">
              <span className="font-bold">Totaal</span>
              <span className="font-bold text-xl">{formatCurrency(Number(invoice.total))}</span>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="border-2 border-slate-200 p-6 mb-6">
          <p className="font-bold text-slate-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
            Betalingsinformatie
          </p>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div className="text-slate-600">
              {(profile?.payment_name || profile?.company_name) && <p>{profile?.payment_name || profile?.company_name}</p>}
              {profile?.iban && <p>IBAN: <span className="font-mono">{profile.iban}</span></p>}
            </div>
            <div className="text-right">
              <p className="text-slate-400">Betalen voor</p>
              <p className="font-bold text-slate-900">{format(new Date(invoice.due_date), 'd MMMM yyyy', { locale: nl })}</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="text-sm mb-6">
            <p className="font-bold text-slate-900 mb-2">{invoice.notes_title || 'Opmerkingen'}</p>
            <p className="text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="pt-6 border-t border-slate-200 text-xs text-slate-400 flex justify-between">
          <div>
            {profile?.company_name}
          </div>
          <div className="space-x-4">
            {profile?.kvk_number && <span>KVK: {profile.kvk_number}</span>}
            {profile?.btw_number && <span>BTW: {profile.btw_number}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
