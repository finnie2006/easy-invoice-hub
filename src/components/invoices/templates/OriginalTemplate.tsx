import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { InvoiceTemplateProps } from './types';

export function OriginalTemplate({ invoice, profile }: InvoiceTemplateProps) {
  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="bg-white text-black p-10 min-h-[1123px] text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Company Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
          {profile?.company_name || 'Uw Bedrijf'}
        </h2>
        <p className="text-sm text-gray-500 border-b pb-2 mt-2">
          {profile?.company_name} · {profile?.company_address} · {profile?.company_postal_code} {profile?.company_city}
        </p>
      </div>

      {/* Two Column Header: Client Left, Invoice Info Right */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Client Info - Left Side */}
        <div>
          <p className="font-bold">{invoice.client_company_name}</p>
          {invoice.client_address && <p>{invoice.client_address}</p>}
          {(invoice.client_postal_code || invoice.client_city) && (
            <p>{invoice.client_postal_code} {invoice.client_city}</p>
          )}
          {invoice.client_country && <p>{invoice.client_country}</p>}
        </div>

        {/* Invoice Details - Right Side */}
        <div className="text-right">
          <table className="ml-auto text-sm">
            <tbody>
              <tr>
                <td className="font-bold pr-4 py-1">Factuurnummer #:</td>
                <td className="text-right">{invoice.invoice_number}</td>
              </tr>
              {invoice.client_kvk_number && (
                <tr>
                  <td className="font-bold pr-4 py-1">Klantnummer #:</td>
                  <td className="text-right">{invoice.client_kvk_number}</td>
                </tr>
              )}
              <tr>
                <td className="font-bold pr-4 py-1">Factuurdatum:</td>
                <td className="text-right">{format(new Date(invoice.invoice_date), 'd MMM yyyy', { locale: nl })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Description Line */}
      <div className="mb-6">
        <p className="text-sm">Betreft de volgende geleverde diensten / werkzaamheden</p>
      </div>

      {/* Invoice Items Table */}
      <table className="w-full mb-6 text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-medium w-12">Nr.</th>
            <th className="text-left py-2 font-medium">Omschrijving</th>
            <th className="text-right py-2 font-medium w-20">Uren</th>
            <th className="text-right py-2 font-medium w-16">BTW</th>
            <th className="text-right py-2 font-medium w-24">Totaal</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items?.map((item, index) => (
            <tr key={item.id} className="border-b">
              <td className="py-3">{index + 1}</td>
              <td className="py-3">{item.description}</td>
              <td className="text-right py-3">{item.quantity}</td>
              <td className="text-right py-3">{item.btw_percentage}%</td>
              <td className="text-right py-3">{formatCurrency(Number(item.subtotal))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals - Right Aligned */}
      <div className="flex justify-end mb-8">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotaal</span>
            <span>{formatCurrency(Number(invoice.subtotal))},-</span>
          </div>
          <div className="flex justify-between">
            <span>BTW 21%</span>
            <span>{formatCurrency(Number(invoice.total_btw))}</span>
          </div>
          <div className="border-t pt-2 flex justify-between font-bold text-lg">
            <span>Totaal incl. BTW</span>
            <span>{formatCurrency(Number(invoice.total))}</span>
          </div>
        </div>
      </div>

      {/* Payment Info */}
      <div className="mb-8 text-sm">
        <p>
          Betaling gelieve voor {format(new Date(invoice.due_date), 'd/MM/yyyy', { locale: nl })} overmaken naar:
        </p>
        <div className="mt-2">
          {profile?.company_name && <p>{profile.company_name}</p>}
          {profile?.iban && <p>IBAN: {profile.iban}</p>}
        </div>
      </div>

      {/* Notes / Changelog Section */}
      {invoice.notes && (
        <div className="border-t pt-4 text-sm">
          <h3 className="font-bold mb-2">Opmerkingen</h3>
          <div className="border-t pt-2 whitespace-pre-wrap text-gray-600">
            {invoice.notes}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-8 border-t text-xs text-gray-500 flex justify-between" style={{ marginTop: 'auto' }}>
        <div>
          {profile?.iban && <p>IBAN: {profile.iban}</p>}
        </div>
        <div className="text-right">
          {profile?.btw_number && <span>BTW Nummer: {profile.btw_number}</span>}
          {profile?.kvk_number && <span className="ml-4">· KVK {profile.kvk_number}</span>}
        </div>
      </div>
    </div>
  );
}
