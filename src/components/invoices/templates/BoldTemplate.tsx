import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { InvoiceTemplateProps } from './types';

export function BoldTemplate({ invoice, profile }: InvoiceTemplateProps) {
  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="bg-white text-black min-h-[1123px]" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Bold Header */}
      <div className="bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white p-10">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-black">
            {profile?.company_name || 'Uw Bedrijf'}
          </h1>
          <div className="text-right">
            <p className="text-6xl font-black opacity-30">#{invoice.invoice_number.slice(-3)}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-10">
        {/* Invoice Badge */}
        <div className="flex justify-between items-start mb-10">
          <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-2 rounded-full inline-block">
            <span className="font-bold">FACTUUR</span> #{invoice.invoice_number}
          </div>
          <div className="text-right">
            <p className="text-2xl font-black">{formatCurrency(Number(invoice.total))}</p>
            <p className="text-gray-500 text-sm">Totaal incl. BTW</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-8 mb-10">
          <div className="bg-gray-50 rounded-2xl p-6">
            <p className="text-xs font-bold text-purple-600 uppercase mb-3">Gefactureerd aan</p>
            <p className="font-bold text-xl">{invoice.client_company_name}</p>
            {invoice.client_address && <p className="text-gray-600 mt-2">{invoice.client_address}</p>}
            <p className="text-gray-600">{invoice.client_postal_code} {invoice.client_city}</p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-purple-600 uppercase">Datum</p>
                <p className="font-bold mt-1">{format(new Date(invoice.invoice_date), 'd MMM yyyy', { locale: nl })}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-purple-600 uppercase">Vervalt</p>
                <p className="font-bold mt-1">{format(new Date(invoice.due_date), 'd MMM yyyy', { locale: nl })}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Items */}
        <div className="mb-10">
          {invoice.items?.map((item, index) => (
            <div 
              key={item.id} 
              className="flex items-center justify-between py-5 border-b-2 border-gray-100"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold">
                  {index + 1}
                </div>
                <div>
                  <p className="font-bold">{item.description}</p>
                  <p className="text-sm text-gray-500">
                    {item.quantity} {item.unit || 'st.'} × {formatCurrency(item.unit_price)} · {item.btw_percentage}% BTW
                  </p>
                </div>
              </div>
              <p className="font-bold text-lg">{formatCurrency(Number(item.subtotal))}</p>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-10">
          <div className="w-80 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 rounded-2xl p-6 text-white">
            <div className="flex justify-between py-2 opacity-80">
              <span>Subtotaal</span>
              <span>{formatCurrency(Number(invoice.subtotal))}</span>
            </div>
            <div className="flex justify-between py-2 opacity-80">
              <span>BTW</span>
              <span>{formatCurrency(Number(invoice.total_btw))}</span>
            </div>
            <div className="flex justify-between py-3 mt-2 border-t border-white/30 font-bold text-xl">
              <span>Totaal</span>
              <span>{formatCurrency(Number(invoice.total))}</span>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="bg-gray-900 text-white rounded-2xl p-6 mb-6">
          <p className="font-bold mb-3">💳 Betalingsinformatie</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              {profile?.company_name && <p>T.n.v.: {profile.company_name}</p>}
              {profile?.iban && <p>IBAN: {profile.iban}</p>}
            </div>
            <div className="text-right">
              <p>Betalen voor</p>
              <p className="font-bold">{format(new Date(invoice.due_date), 'd MMMM yyyy', { locale: nl })}</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="text-sm text-gray-600 mb-6">
            <p className="whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="pt-6 text-xs text-gray-400 flex justify-between">
          <div>
            {profile?.company_name} · {profile?.company_city}
          </div>
          <div>
            {profile?.kvk_number && <span>KVK: {profile.kvk_number}</span>}
            {profile?.btw_number && <span className="ml-3">BTW: {profile.btw_number}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
