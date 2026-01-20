import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { InvoiceTemplateProps } from './types';

export function ClassicTemplate({ invoice, profile }: InvoiceTemplateProps) {
  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="bg-white text-black p-10 min-h-[1123px] text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Company Header */}
      <div className="mb-8 border-b-2 border-gray-800 pb-4">
        <h1 className="text-2xl font-bold text-gray-800">
          {profile?.company_name || 'Uw Bedrijf'}
        </h1>
        <p className="text-xs text-gray-600 mt-1">
          {profile?.company_address} · {profile?.company_postal_code} {profile?.company_city}
        </p>
      </div>

      {/* Invoice Title */}
      <div className="text-right mb-8">
        <h2 className="text-3xl font-bold text-gray-800">FACTUUR</h2>
      </div>

      {/* Two Column Header */}
      <div className="grid grid-cols-2 gap-8 mb-10">
        {/* Client Info */}
        <div>
          <p className="text-xs text-gray-500 uppercase mb-2">Factuur aan:</p>
          <p className="font-bold text-base">{invoice.client_company_name}</p>
          {invoice.client_contact_name && <p>{invoice.client_contact_name}</p>}
          {invoice.client_address && <p>{invoice.client_address}</p>}
          {(invoice.client_postal_code || invoice.client_city) && (
            <p>{invoice.client_postal_code} {invoice.client_city}</p>
          )}
          {invoice.client_country && <p>{invoice.client_country}</p>}
        </div>

        {/* Invoice Details */}
        <div className="text-right">
          <table className="ml-auto text-sm">
            <tbody>
              <tr>
                <td className="font-bold pr-4 py-1 text-left">Factuurnummer:</td>
                <td className="text-right">{invoice.invoice_number}</td>
              </tr>
              <tr>
                <td className="font-bold pr-4 py-1 text-left">Factuurdatum:</td>
                <td className="text-right">{format(new Date(invoice.invoice_date), 'd MMMM yyyy', { locale: nl })}</td>
              </tr>
              <tr>
                <td className="font-bold pr-4 py-1 text-left">Vervaldatum:</td>
                <td className="text-right">{format(new Date(invoice.due_date), 'd MMMM yyyy', { locale: nl })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Items Table */}
      <table className="w-full mb-8">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="text-left py-3 px-4 font-medium">Omschrijving</th>
            <th className="text-right py-3 px-4 font-medium w-20">Aantal</th>
            <th className="text-right py-3 px-4 font-medium w-24">Prijs</th>
            <th className="text-right py-3 px-4 font-medium w-16">BTW</th>
            <th className="text-right py-3 px-4 font-medium w-28">Bedrag</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items?.map((item, index) => (
            <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
              <td className="py-3 px-4">{item.description}</td>
              <td className="text-right py-3 px-4">{item.quantity} {item.unit || ''}</td>
              <td className="text-right py-3 px-4">{formatCurrency(item.unit_price)}</td>
              <td className="text-right py-3 px-4">{item.btw_percentage}%</td>
              <td className="text-right py-3 px-4">{formatCurrency(Number(item.subtotal))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-10">
        <div className="w-72 border border-gray-300">
          <div className="flex justify-between py-2 px-4 border-b border-gray-300">
            <span>Subtotaal</span>
            <span>{formatCurrency(Number(invoice.subtotal))}</span>
          </div>
          <div className="flex justify-between py-2 px-4 border-b border-gray-300">
            <span>BTW</span>
            <span>{formatCurrency(Number(invoice.total_btw))}</span>
          </div>
          <div className="flex justify-between py-3 px-4 bg-gray-800 text-white font-bold text-base">
            <span>Totaal</span>
            <span>{formatCurrency(Number(invoice.total))}</span>
          </div>
        </div>
      </div>

      {/* Payment Info */}
      <div className="mb-8 p-4 bg-gray-50 border border-gray-200">
        <p className="font-bold mb-2">Betalingsgegevens</p>
        <p>Gelieve te betalen voor {format(new Date(invoice.due_date), 'd MMMM yyyy', { locale: nl })}</p>
        <div className="mt-2">
          {profile?.company_name && <p>T.n.v.: {profile.company_name}</p>}
          {profile?.iban && <p>IBAN: {profile.iban}</p>}
          <p>O.v.v.: {invoice.invoice_number}</p>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="mb-8">
          <p className="font-bold mb-2">Opmerkingen</p>
          <p className="whitespace-pre-wrap text-gray-600">{invoice.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="absolute bottom-10 left-10 right-10 pt-4 border-t border-gray-300 text-xs text-gray-500 flex justify-between">
        <div>
          {profile?.company_name && <span>{profile.company_name}</span>}
          {profile?.iban && <span className="ml-4">IBAN: {profile.iban}</span>}
        </div>
        <div>
          {profile?.kvk_number && <span>KVK: {profile.kvk_number}</span>}
          {profile?.btw_number && <span className="ml-4">BTW: {profile.btw_number}</span>}
        </div>
      </div>
    </div>
  );
}
