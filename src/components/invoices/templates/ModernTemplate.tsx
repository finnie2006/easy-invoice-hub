import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { InvoiceTemplateProps } from './types';

export function ModernTemplate({ invoice, profile }: InvoiceTemplateProps) {
  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="bg-white text-black min-h-[1123px]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
      {/* Header with accent color */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-10 pb-16">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">
              {profile?.company_name || 'Uw Bedrijf'}
            </h1>
            <p className="text-blue-100 mt-2 text-sm">
              {profile?.company_address}<br />
              {profile?.company_postal_code} {profile?.company_city}
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-light">FACTUUR</p>
            <p className="text-xl mt-2">#{invoice.invoice_number}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-10 -mt-8">
        {/* Info Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Factuur aan</p>
            <p className="font-bold text-lg mt-1">{invoice.client_company_name}</p>
            {invoice.client_address && <p className="text-sm text-gray-600">{invoice.client_address}</p>}
            <p className="text-sm text-gray-600">{invoice.client_postal_code} {invoice.client_city}</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Factuurdatum</p>
            <p className="font-bold text-lg mt-1">{format(new Date(invoice.invoice_date), 'd MMM yyyy', { locale: nl })}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wide mt-3">Vervaldatum</p>
            <p className="font-bold mt-1">{format(new Date(invoice.due_date), 'd MMM yyyy', { locale: nl })}</p>
          </div>
          <div className="bg-blue-600 rounded-lg shadow-lg p-5 text-white">
            <p className="text-xs text-blue-100 uppercase tracking-wide">Totaalbedrag</p>
            <p className="font-bold text-2xl mt-1">{formatCurrency(Number(invoice.total))}</p>
            <p className="text-blue-100 text-sm mt-2">Incl. {formatCurrency(Number(invoice.total_btw))} BTW</p>
          </div>
        </div>

        {/* Invoice Items */}
        <div className="mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 font-semibold text-gray-500 uppercase text-xs">Omschrijving</th>
                <th className="text-right py-3 font-semibold text-gray-500 uppercase text-xs w-24">Aantal</th>
                <th className="text-right py-3 font-semibold text-gray-500 uppercase text-xs w-24">Prijs</th>
                <th className="text-right py-3 font-semibold text-gray-500 uppercase text-xs w-20">BTW</th>
                <th className="text-right py-3 font-semibold text-gray-500 uppercase text-xs w-28">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-4">{item.description}</td>
                  <td className="text-right py-4 text-gray-600">{item.quantity} {item.unit || ''}</td>
                  <td className="text-right py-4 text-gray-600">{formatCurrency(item.unit_price)}</td>
                  <td className="text-right py-4 text-gray-600">{item.btw_percentage}%</td>
                  <td className="text-right py-4 font-medium">{formatCurrency(Number(item.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-10">
          <div className="w-72">
            <div className="flex justify-between py-2 text-gray-600">
              <span>Subtotaal</span>
              <span>{formatCurrency(Number(invoice.subtotal))}</span>
            </div>
            <div className="flex justify-between py-2 text-gray-600">
              <span>BTW</span>
              <span>{formatCurrency(Number(invoice.total_btw))}</span>
            </div>
            <div className="flex justify-between py-3 mt-2 border-t-2 border-blue-600 font-bold text-lg">
              <span>Totaal</span>
              <span className="text-blue-600">{formatCurrency(Number(invoice.total))}</span>
            </div>
          </div>
        </div>

        {/* Payment Info */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold text-gray-800">Betalingsinformatie</p>
              <div className="mt-2 text-sm text-gray-600">
                {profile?.company_name && <p>T.n.v.: {profile.company_name}</p>}
                {profile?.iban && <p>IBAN: {profile.iban}</p>}
                <p>Referentie: {invoice.invoice_number}</p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>Gelieve te betalen voor</p>
              <p className="font-bold text-gray-800">{format(new Date(invoice.due_date), 'd MMMM yyyy', { locale: nl })}</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mb-6 text-sm text-gray-600">
            <p className="font-semibold text-gray-800 mb-2">Opmerkingen</p>
            <p className="whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="pt-6 border-t border-gray-200 text-xs text-gray-400 flex justify-between">
          <div>
            {profile?.company_name}
          </div>
          <div className="text-right">
            {profile?.kvk_number && <span>KVK: {profile.kvk_number}</span>}
            {profile?.btw_number && <span className="ml-4">BTW: {profile.btw_number}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
