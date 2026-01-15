import { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useInvoice, useInvoices } from '@/hooks/useInvoices';
import { useProfile } from '@/hooks/useProfile';
import { useClients } from '@/hooks/useClients';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, ArrowLeft, Send, CheckCircle2, Download, AlertTriangle, Pencil, Mail, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading } = useInvoice(id || '');
  const { updateInvoiceStatus, createInvoice } = useInvoices();
  const { profile } = useProfile();
  const { clients } = useClients();
  const { toast } = useToast();

  const invoiceRef = useRef<HTMLDivElement>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailName, setEmailName] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatCurrencyShort = (amount: number) => {
    return `€${amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleDownloadPdf = async () => {
    if (!invoiceRef.current || !invoice) return;

    setIsGeneratingPdf(true);
    try {
      const element = invoiceRef.current;
      
      // Create canvas from the invoice element
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      
      // Create PDF with A4 dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth - 20; // 10mm margins on each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Add image to PDF, centered with margins
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, Math.min(imgHeight, pdfHeight - 20));

      // Download the PDF
      pdf.save(`Factuur-${invoice.invoice_number}.pdf`);

      toast({
        title: 'PDF gedownload',
        description: `Factuur ${invoice.invoice_number} is opgeslagen als PDF`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Fout bij genereren PDF',
        description: 'Er is een fout opgetreden bij het maken van de PDF',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleOpenEmailDialog = () => {
    // Pre-fill email from client if available
    if (invoice?.client_id) {
      const client = clients.find(c => c.id === invoice.client_id);
      if (client) {
        setEmailTo(client.email || '');
        setEmailName(client.contact_name || client.company_name);
      }
    } else {
      setEmailTo('');
      setEmailName(invoice?.client_contact_name || invoice?.client_company_name || '');
    }
    setEmailMessage('');
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!emailTo || !id) return;

    setIsSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          invoiceId: id,
          recipientEmail: emailTo,
          recipientName: emailName || undefined,
          customMessage: emailMessage || undefined,
        },
      });

      if (error) throw error;

      toast({
        title: 'E-mail verzonden',
        description: `Factuur is succesvol verzonden naar ${emailTo}`,
      });

      setEmailDialogOpen(false);

      // Optionally mark as sent if it was a draft
      if (invoice?.status === 'draft') {
        updateInvoiceStatus({ id: invoice.id, status: 'sent' });
      }
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: 'Fout bij verzenden',
        description: error.message || 'Er is een fout opgetreden bij het verzenden van de e-mail',
        variant: 'destructive',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleDuplicate = async () => {
    if (!invoice) return;

    try {
      const newInvoice = await createInvoice({
        invoice: {
          invoice_number: '', // Will be auto-generated
          invoice_date: format(new Date(), 'yyyy-MM-dd'),
          due_date: format(new Date(Date.now() + (profile?.default_payment_terms || 14) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
          client_id: invoice.client_id || undefined,
          client_company_name: invoice.client_company_name || undefined,
          client_contact_name: invoice.client_contact_name || undefined,
          client_address: invoice.client_address || undefined,
          client_postal_code: invoice.client_postal_code || undefined,
          client_city: invoice.client_city || undefined,
          client_country: invoice.client_country || undefined,
          client_kvk_number: invoice.client_kvk_number || undefined,
          client_btw_number: invoice.client_btw_number || undefined,
          notes: invoice.notes || undefined,
          status: 'draft',
        },
        items: invoice.items?.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          btw_percentage: item.btw_percentage,
        })) || [],
      });

      toast({
        title: 'Factuur gedupliceerd',
        description: 'Een nieuwe conceptfactuur is aangemaakt',
      });

      navigate(`/invoices/${newInvoice.id}/edit`);
    } catch (error: any) {
      toast({
        title: 'Fout bij dupliceren',
        description: error.message,
        variant: 'destructive',
      });
    }
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
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" onClick={() => navigate(`/invoices/${id}/edit`)}>
            <Pencil className="h-4 w-4 mr-2" />
            Bewerken
          </Button>
          <Button variant="outline" onClick={handleDuplicate}>
            <Copy className="h-4 w-4 mr-2" />
            Dupliceren
          </Button>
          <Button variant="outline" onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
            {isGeneratingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            PDF downloaden
          </Button>
          <Button variant="outline" onClick={handleOpenEmailDialog}>
            <Mail className="h-4 w-4 mr-2" />
            E-mailen
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
        <CardContent ref={invoiceRef} className="p-8 print:p-0 bg-white">
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
                  <td className="text-right py-3">{formatCurrencyShort(Number(item.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals - Right Aligned */}
          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotaal</span>
                <span>{formatCurrencyShort(Number(invoice.subtotal))},-</span>
              </div>
              <div className="flex justify-between">
                <span>BTW 21%</span>
                <span>{formatCurrencyShort(Number(invoice.total_btw))}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>Totaal incl. BTW</span>
                <span>{formatCurrencyShort(Number(invoice.total))}</span>
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
            <div className="border-t pt-6 text-sm">
              <h3 className="font-bold mb-4">{invoice.notes.split('\n')[0]?.includes(':') ? invoice.notes.split('\n')[0] : 'Opmerkingen'}</h3>
              <div className="whitespace-pre-wrap">
                {invoice.notes.split('\n').slice(invoice.notes.split('\n')[0]?.includes(':') ? 0 : 0).map((line, i) => {
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

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Factuur verzenden per e-mail</DialogTitle>
            <DialogDescription>
              Verstuur factuur {invoice.invoice_number} naar de klant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-to">E-mailadres *</Label>
              <Input
                id="email-to"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="klant@bedrijf.nl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-name">Naam ontvanger</Label>
              <Input
                id="email-name"
                value={emailName}
                onChange={(e) => setEmailName(e.target.value)}
                placeholder="Naam van de ontvanger"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-message">Persoonlijk bericht (optioneel)</Label>
              <Textarea
                id="email-message"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Voeg een persoonlijk bericht toe aan de e-mail..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleSendEmail} disabled={!emailTo || isSendingEmail}>
              {isSendingEmail && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Mail className="h-4 w-4 mr-2" />
              Versturen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
