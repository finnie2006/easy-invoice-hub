import { useParams, Link, useNavigate } from 'react-router-dom';
import { useInvoice, useInvoices } from '@/hooks/useInvoices';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowLeft, Send, CheckCircle2, Printer, AlertTriangle } from 'lucide-react';
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

      {/* Invoice Card */}
      <Card className="print:shadow-none print:border-none">
        <CardContent className="p-8">
          {/* Invoice Header */}
          <div className="flex justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-primary mb-4">FACTUUR</h2>
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Factuurnummer:</span> {invoice.invoice_number}</p>
                <p><span className="text-muted-foreground">Factuurdatum:</span> {format(new Date(invoice.invoice_date), 'd MMMM yyyy', { locale: nl })}</p>
                <p><span className="text-muted-foreground">Vervaldatum:</span> {format(new Date(invoice.due_date), 'd MMMM yyyy', { locale: nl })}</p>
              </div>
            </div>
            <div className="text-right">
              {profile?.company_name && (
                <div className="space-y-1 text-sm">
                  <p className="font-bold text-lg">{profile.company_name}</p>
                  {profile.company_address && <p>{profile.company_address}</p>}
                  {(profile.company_postal_code || profile.company_city) && (
                    <p>{profile.company_postal_code} {profile.company_city}</p>
                  )}
                  {profile.kvk_number && <p className="text-muted-foreground">KVK: {profile.kvk_number}</p>}
                  {profile.btw_number && <p className="text-muted-foreground">BTW: {profile.btw_number}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Client Info */}
          <div className="mb-8 p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Factuuradres</p>
            <p className="font-bold">{invoice.client_company_name}</p>
            {invoice.client_contact_name && <p>t.a.v. {invoice.client_contact_name}</p>}
            {invoice.client_address && <p>{invoice.client_address}</p>}
            {(invoice.client_postal_code || invoice.client_city) && (
              <p>{invoice.client_postal_code} {invoice.client_city}</p>
            )}
            {invoice.client_btw_number && (
              <p className="text-sm text-muted-foreground mt-2">BTW: {invoice.client_btw_number}</p>
            )}
          </div>

          {/* Invoice Items */}
          <table className="w-full mb-8">
            <thead>
              <tr className="border-b text-sm">
                <th className="text-left py-3 font-medium">Omschrijving</th>
                <th className="text-right py-3 font-medium w-24">Aantal</th>
                <th className="text-right py-3 font-medium w-24">Prijs</th>
                <th className="text-right py-3 font-medium w-20">BTW</th>
                <th className="text-right py-3 font-medium w-28">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-3">{item.description}</td>
                  <td className="text-right py-3">{item.quantity} {item.unit}</td>
                  <td className="text-right py-3">{formatCurrency(Number(item.unit_price))}</td>
                  <td className="text-right py-3 text-muted-foreground">{item.btw_percentage}%</td>
                  <td className="text-right py-3">{formatCurrency(Number(item.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotaal</span>
                <span>{formatCurrency(Number(invoice.subtotal))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">BTW</span>
                <span>{formatCurrency(Number(invoice.total_btw))}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Totaal</span>
                <span>{formatCurrency(Number(invoice.total))}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t text-sm text-muted-foreground">
            <p>
              Gelieve het totaalbedrag binnen {profile?.default_payment_terms || 14} dagen over te maken naar:
            </p>
            {profile?.iban && (
              <p className="font-medium text-foreground mt-1">IBAN: {profile.iban}</p>
            )}
            <p className="mt-1">Onder vermelding van: {invoice.payment_reference || invoice.invoice_number}</p>
            
            {invoice.notes && (
              <div className="mt-4 p-3 bg-muted/50 rounded">
                <p className="font-medium text-foreground">Opmerkingen:</p>
                <p>{invoice.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
