import { useParams, Link, useNavigate } from 'react-router-dom';
import { useInvoice, useInvoices } from '@/hooks/useInvoices';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Send, CheckCircle2, Printer, AlertTriangle, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading } = useInvoice(id || '');
  const { updateInvoiceStatus } = useInvoices();
  const { profile } = useProfile();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatCurrencyShort = (amount: number) => {
    return `€${amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Factuur niet gevonden</p>
        <Button variant="link" asChild className="mt-2">
          <Link to="/invoices">Terug naar facturen</Link>
        </Button>
      </div>
    );
  }

  const isOverdue = 
    invoice.status !== 'paid' && 
    invoice.status !== 'cancelled' && 
    new Date(invoice.due_date) < new Date();

  return (
    <div className="space-y-6">
      {/* Header - hide on print */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Factuur {invoice.invoice_number}</h1>
            <div className="flex items-center gap-2 mt-1">
              {isOverdue ? (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Verlopen
                </Badge>
              ) : invoice.status === 'paid' ? (
                <Badge className="bg-success text-success-foreground">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Betaald
                </Badge>
              ) : invoice.status === 'sent' ? (
                <Badge variant="outline">Verzonden</Badge>
              ) : (
                <Badge variant="secondary">Concept</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/invoices/${id}/edit`)}>
            <Pencil className="h-4 w-4 mr-2" />
            Bewerken
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Afdrukken
          </Button>
          {invoice.status === 'draft' && (
            <Button
              onClick={() => updateInvoiceStatus({ id: invoice.id, status: 'sent' })}
            >
              <Send className="h-4 w-4 mr-2" />
              Markeer als verzonden
            </Button>
          )}
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <Button
              onClick={() => updateInvoiceStatus({ 
                id: invoice.id, 
                status: 'paid',
                paid_at: new Date().toISOString(),
              })}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Markeer als betaald
            </Button>
          )}
        </div>
      </div>

      {/* Invoice Card - Professional Layout */}
      <Card className="print:shadow-none print:border-none">
        <CardContent className="p-8 print:p-0">
          {/* Company Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-primary mb-4">
              {profile?.company_name || 'Uw Bedrijf'}
            </h2>
            <p className="text-sm text-muted-foreground border-b pb-2">
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
                    <td className="text-right">Datum: {format(new Date(invoice.invoice_date), 'd MMM yyyy', { locale: nl })}</td>
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
                  <td className="text-right py-3">{formatCurrencyShort(Number(item.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals - Right Aligned */}
          <div className="flex justify-end mb-8">
            <table className="text-sm">
              <tbody>
                <tr>
                  <td className="text-right pr-8 py-1">Subtotaal</td>
                  <td className="text-right">{formatCurrencyShort(Number(invoice.subtotal))},-</td>
                </tr>
                <tr>
                  <td className="text-right pr-8 py-1">BTW</td>
                  <td className="text-right">21%</td>
                  <td className="text-right pl-4">{formatCurrencyShort(Number(invoice.total_btw))}</td>
                </tr>
                <tr className="font-bold text-lg">
                  <td className="text-right pr-8 pt-2">Totaal incl. BTW</td>
                  <td></td>
                  <td className="text-right pl-4 pt-2">{formatCurrencyShort(Number(invoice.total))}</td>
                </tr>
              </tbody>
            </table>
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
            <div className="border-t pt-6 text-sm">
              <h3 className="font-bold mb-4">{invoice.notes.split('\n')[0]?.includes(':') ? invoice.notes.split('\n')[0] : 'Opmerkingen'}</h3>
              <div className="whitespace-pre-wrap">
                {invoice.notes.split('\n').slice(invoice.notes.split('\n')[0]?.includes(':') ? 0 : 0).map((line, i) => {
                  // Check if line starts with bullet point format
                  if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                    const parts = line.replace(/^[•\-]\s*/, '').split(':');
                    if (parts.length > 1) {
                      return (
                        <p key={i} className="ml-4 mb-2">
                          • <strong>{parts[0]}:</strong>{parts.slice(1).join(':')}
                        </p>
                      );
                    }
                    return <p key={i} className="ml-4 mb-2">• {line.replace(/^[•\-]\s*/, '')}</p>;
                  }
                  return <p key={i} className="mb-2">{line}</p>;
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-xs text-muted-foreground flex justify-between">
            <div>
              {profile?.iban && <p>IBAN: {profile.iban}</p>}
            </div>
            <div className="text-right">
              {profile?.btw_number && <span>BTW Nummer: {profile.btw_number}</span>}
              {profile?.kvk_number && <span className="ml-4">· KVK {profile.kvk_number}</span>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
