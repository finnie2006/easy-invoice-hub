import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { InvoiceTemplateProps } from './types';

export function MinimalTemplate({ invoice, profile }: InvoiceTemplateProps) {
  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const hasInvoiceDiscount = invoice.discount_type && invoice.discount_amount > 0;

  return (
    <div className="bg-white text-black p-12 min-h-[1123px] text-sm" style={{ fontFamily: 'Georgia, serif' }}>
      <div className="flex justify-between items-start mb-16">
        <div>
          <h1 className="text-xl font-normal tracking-wide">{profile?.company_name || 'Uw Bedrijf'}</h1>
        </div>
        <div className="text-right">
          <p className="text-3xl font-light tracking-widest text-gray-400">FACTUUR</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-16 mb-16">
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-4">Aan</p>
          <p className="font-medium">{invoice.client_company_name}</p>
          {invoice.client_address && <p className="text-gray-600">{invoice.client_address}</p>}
          <p className="text-gray-600">{invoice.client_postal_code} {invoice.client_city}</p>
          {invoice.client_country && <p className="text-gray-600">{invoice.client_country}</p>}
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-4">Details</p>
          <p><span className="text-gray-500">Nr.</span> {invoice.invoice_number}</p>
          <p><span className="text-gray-500">Datum</span> {format(new Date(invoice.invoice_date), 'd/M/yyyy')}</p>
          <p><span className="text-gray-500">Vervalt</span> {format(new Date(invoice.due_date), 'd/M/yyyy')}</p>
        </div>
      </div>

      <div className="mb-16">
        <div className="border-b border-gray-200 pb-2 mb-4 flex text-xs text-gray-400 uppercase tracking-widest">
          <div className="flex-1">Omschrijving</div>
          <div className="w-24 text-right">Bedrag</div>
        </div>
        {invoice.items?.map((item) => (
          <div key={item.id} className="flex py-3 border-b border-gray-100">
            <div className="flex-1">
              <p>{item.description}</p>
              <p className="text-xs text-gray-400 mt-1">
                {item.quantity} × {formatCurrency(item.unit_price)}
                {item.discount_type && item.discount_value > 0 && (
                  <span> · korting {item.discount_type === 'percentage' ? `${item.discount_value}%` : formatCurrency(item.discount_value)}</span>
                )}
                {' '}· {item.btw_percentage}% BTW
              </p>
            </div>
            <div className="w-24 text-right">{formatCurrency(Number(item.total))}</div>
          </div>
        ))}
      </div>

      <div className="flex justify-end mb-16">
        <div className="w-64">
          <div className="flex justify-between py-2 text-gray-500">
            <span>Subtotaal</span>
            <span>{formatCurrency(Number(invoice.subtotal))}</span>
          </div>
          {hasInvoiceDiscount && (
            <div className="flex justify-between py-2 text-red-600">
              <span>Korting{invoice.discount_type === 'percentage' ? ` (${invoice.discount_value}%)` : ''}</span>
              <span>-{formatCurrency(Number(invoice.discount_amount))}</span>
            </div>
          )}
          <div className="flex justify-between py-2 text-gray-500">
            <span>BTW</span>
            <span>{formatCurrency(Number(invoice.total_btw))}</span>
          </div>
          <div className="flex justify-between py-4 mt-4 border-t border-gray-900 text-lg">
            <span>Totaal</span>
            <span>{formatCurrency(Number(invoice.total))}</span>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-4">Betaling</p>
        <p className="text-gray-600">
          Graag het totaalbedrag overmaken voor {format(new Date(invoice.due_date), 'd MMMM yyyy', { locale: nl })} naar:
        </p>
        <div className="mt-2">
          {profile?.iban && <p>{profile.iban}</p>}
          {(profile?.payment_name || profile?.company_name) && <p className="text-gray-600">t.n.v. {profile?.payment_name || profile?.company_name}</p>}
        </div>
      </div>

      {invoice.notes && (
        <div className="mb-8 text-gray-600">
          <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: invoice.notes }} />
        </div>
      )}

      <div className="absolute bottom-12 left-12 right-12 text-xs text-gray-400 flex justify-between">
        <div>{profile?.company_address} · {profile?.company_postal_code} {profile?.company_city}</div>
        <div>
          {profile?.kvk_number && <span>KVK {profile.kvk_number}</span>}
          {profile?.btw_number && <span className="ml-4">BTW {profile.btw_number}</span>}
        </div>
      </div>
    </div>
  );
}
