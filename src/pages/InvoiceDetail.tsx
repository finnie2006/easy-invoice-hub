import { useState, useRef, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, ArrowLeft, Send, CheckCircle2, Download, AlertTriangle, Pencil, Mail, Copy, Palette, FileText, ExternalLink, Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { invoices as invoicesApi } from '@/api/client';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { AxiosError } from 'axios';
import {
  OriginalTemplate,
  ClassicTemplate,
  ModernTemplate,
  MinimalTemplate,
  BoldTemplate,
  INVOICE_DESIGNS,
  type InvoiceDesign,
  type InvoiceData,
} from '@/components/invoices/templates';

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading } = useInvoice(id || '');
  const { updateInvoiceStatus, createInvoice, updateAttachment, isUpdatingAttachment } = useInvoices();
  const { profile } = useProfile();
  const { clients } = useClients();
  const { toast } = useToast();

  const invoiceRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailName, setEmailName] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDesign, setSelectedDesign] = useState<InvoiceDesign>(() => {
    const saved = localStorage.getItem('invoice-design');
    return (saved as InvoiceDesign) || 'original';
  });

  useEffect(() => {
    localStorage.setItem('invoice-design', selectedDesign);
  }, [selectedDesign]);

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    const axiosError = error as AxiosError<{ error?: string }>;
    if (axiosError?.response?.data?.error) {
      return axiosError.response.data.error;
    }

    return fallback;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleDownloadPdf = async () => {
    if (!invoiceRef.current || !invoice) return;

    setIsGeneratingPdf(true);
    let clone: HTMLElement | null = null;

    try {
      const element = invoiceRef.current;

      // A4 dimensions
      const A4_WIDTH_MM = 210;
      const A4_HEIGHT_MM = 297;
      const a4WidthPx = 794;
      const SCALE = 2;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Clone element for PDF generation
      clone = element.cloneNode(true) as HTMLElement;
      clone.style.width = `${a4WidthPx}px`;
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.backgroundColor = '#ffffff';
      document.body.appendChild(clone);

      // Ensure custom fonts are loaded before capture to avoid text reflow in the PDF.
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const fullCanvas = await html2canvas(clone, {
        scale: SCALE,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: a4WidthPx,
        windowWidth: a4WidthPx,
      });

      const pxPerMm = fullCanvas.width / A4_WIDTH_MM;
      const pageHeightPx = Math.floor(A4_HEIGHT_MM * pxPerMm);
      const trailingBlankTolerancePx = Math.ceil(pxPerMm * 2);
      const cloneRect = clone.getBoundingClientRect();
      const cssPxToCanvasPx = fullCanvas.width / cloneRect.width;
      const fullCanvasCtx = fullCanvas.getContext('2d');
      const isBlankCanvasSlice = (startY: number, heightPx: number) => {
        if (!fullCanvasCtx || heightPx <= 0) {
          return false;
        }

        const imageData = fullCanvasCtx.getImageData(
          0,
          startY,
          fullCanvas.width,
          Math.max(1, Math.floor(heightPx)),
        ).data;

        for (let i = 0; i < imageData.length; i += 4) {
          const alpha = imageData[i + 3];
          const red = imageData[i];
          const green = imageData[i + 1];
          const blue = imageData[i + 2];

          if (alpha > 8 && (red < 248 || green < 248 || blue < 248)) {
            return false;
          }
        }

        return true;
      };
      const forcedBreakOffsets = Array.from(clone.querySelectorAll('[data-pdf-start-page]'))
        .map((section) => {
          const value = Number((section as HTMLElement).getAttribute('data-pdf-start-page') || 0);
          if (value < 2) {
            return null;
          }

          const sectionRect = (section as HTMLElement).getBoundingClientRect();
          const topCssPx = sectionRect.top - cloneRect.top;
          const topCanvasPx = Math.round(topCssPx * cssPxToCanvasPx);

          if (topCanvasPx <= 0 || topCanvasPx >= fullCanvas.height) {
            return null;
          }

          return topCanvasPx;
        })
        .filter((value): value is number => value !== null)
        .sort((a, b) => a - b);

      let offsetY = 0;
      let pageIndex = 0;

      while (offsetY < fullCanvas.height) {
        const remainingHeightPx = fullCanvas.height - offsetY;
        if (
          remainingHeightPx <= trailingBlankTolerancePx &&
          isBlankCanvasSlice(offsetY, remainingHeightPx)
        ) {
          break;
        }

        const defaultSliceHeightPx = Math.min(pageHeightPx, fullCanvas.height - offsetY);
        const nextForcedBreak = forcedBreakOffsets.find((breakOffset) => breakOffset > offsetY);
        const shouldBreakBeforeMarker =
          nextForcedBreak !== undefined && nextForcedBreak < offsetY + defaultSliceHeightPx;
        const sliceHeightPx = shouldBreakBeforeMarker
          ? nextForcedBreak - offsetY
          : defaultSliceHeightPx;
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = fullCanvas.width;
        pageCanvas.height = sliceHeightPx;

        const ctx = pageCanvas.getContext('2d');
        if (!ctx) {
          throw new Error('Kon PDF-canvas niet voorbereiden');
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          fullCanvas,
          0,
          offsetY,
          fullCanvas.width,
          sliceHeightPx,
          0,
          0,
          fullCanvas.width,
          sliceHeightPx,
        );

        const sliceHeightMm = sliceHeightPx / pxPerMm;
        const imgData = pageCanvas.toDataURL('image/jpeg', 0.97);

        if (pageIndex > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, sliceHeightMm);
        offsetY += sliceHeightPx;
        pageIndex += 1;
      }

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
      if (clone && clone.parentNode) {
        clone.parentNode.removeChild(clone);
      }

      setIsGeneratingPdf(false);
    }
  };

  const handleOpenEmailDialog = () => {
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
      await invoicesApi.sendEmail(id, {
        recipientEmail: emailTo,
        recipientName: emailName || undefined,
        customMessage: emailMessage || undefined,
      });

      toast({
        title: 'E-mail verzonden',
        description: `Factuur is succesvol verzonden naar ${emailTo}`,
      });

      setEmailDialogOpen(false);

      if (invoice?.status === 'draft') {
        updateInvoiceStatus({ id: invoice.id, status: 'sent' });
      }
    } catch (error: unknown) {
      console.error('Error sending email:', error);
      toast({
        title: 'Fout bij verzenden',
        description: getErrorMessage(error, 'Er is een fout opgetreden bij het verzenden van de e-mail'),
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
          invoice_number: '',
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
          discount_type: item.discount_type,
          discount_value: Number(item.discount_value || 0),
        })) || [],
      });

      toast({
        title: 'Factuur gedupliceerd',
        description: 'Een nieuwe conceptfactuur is aangemaakt',
      });

      navigate(`/invoices/${newInvoice.id}/edit`);
    } catch (error: unknown) {
      toast({
        title: 'Fout bij dupliceren',
        description: getErrorMessage(error, 'Er is een fout opgetreden bij dupliceren'),
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

  // Prepare invoice data for templates
  const invoiceData: InvoiceData = {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.invoice_date,
    due_date: invoice.due_date,
    client_company_name: invoice.client_company_name,
    client_contact_name: invoice.client_contact_name,
    client_address: invoice.client_address,
    client_postal_code: invoice.client_postal_code,
    client_city: invoice.client_city,
    client_country: invoice.client_country,
    client_kvk_number: invoice.client_kvk_number,
    client_btw_number: invoice.client_btw_number,
    subtotal: Number(invoice.subtotal),
    total_btw: Number(invoice.total_btw),
    total: Number(invoice.total),
    discount_type: invoice.discount_type,
    discount_value: Number(invoice.discount_value || 0),
    discount_amount: Number(invoice.discount_amount || 0),
    notes: invoice.notes,
    notes_title: invoice.notes_title || 'Opmerkingen',
    items: invoice.items?.map(item => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      btw_percentage: item.btw_percentage,
      subtotal: Number(item.subtotal),
      btw_amount: Number(item.btw_amount),
      total: Number(item.total),
      discount_type: item.discount_type,
      discount_value: Number(item.discount_value || 0),
    })) || [],
  };

  const renderTemplate = () => {
    switch (selectedDesign) {
      case 'original':
        return <OriginalTemplate invoice={invoiceData} profile={profile} />;
      case 'modern':
        return <ModernTemplate invoice={invoiceData} profile={profile} />;
      case 'minimal':
        return <MinimalTemplate invoice={invoiceData} profile={profile} />;
      case 'bold':
        return <BoldTemplate invoice={invoiceData} profile={profile} />;
      case 'classic':
      default:
        return <ClassicTemplate invoice={invoiceData} profile={profile} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Factuur {invoice.invoice_number}</h1>
            <div className="flex items-center gap-2 mt-1">
              {invoice.attachment_url && (
                <Badge variant="outline">Extern</Badge>
              )}
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
          {/* Design Selector */}
          <Select value={selectedDesign} onValueChange={(v) => setSelectedDesign(v as InvoiceDesign)}>
            <SelectTrigger className="w-44">
              <Palette className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVOICE_DESIGNS.map((design) => (
                <SelectItem key={design.id} value={design.id}>
                  <div>
                    <p className="font-medium">{design.name}</p>
                    <p className="text-xs text-muted-foreground">{design.description}</p>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
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
            <Button onClick={() => updateInvoiceStatus({ id: invoice.id, status: 'sent' })}>
              <Send className="h-4 w-4 mr-2" />
              Markeer als verzonden
            </Button>
          )}
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <Button onClick={() => updateInvoiceStatus({ 
              id: invoice.id, 
              status: 'paid',
              paid_at: new Date().toISOString(),
            })}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Markeer als betaald
            </Button>
          )}
        </div>
      </div>

      {/* External Invoice Attachment */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">
                  {invoice.attachment_url ? 'Externe factuur bijlage' : 'Factuur bijlage toevoegen'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {invoice.attachment_url 
                    ? 'Dit is een extern aangemaakte factuur met bijlage' 
                    : 'Upload de originele factuur (PDF of afbeelding)'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {invoice.attachment_url && (
                <Button variant="outline" asChild>
                  <a href={invoice.attachment_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Bekijk origineel
                  </a>
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file && id) {
                    setSelectedFile(file);
                    await updateAttachment({ invoiceId: id, file });
                    setSelectedFile(null);
                  }
                }}
                className="hidden"
              />
              <Button 
                variant={invoice.attachment_url ? "outline" : "default"}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUpdatingAttachment}
              >
                {isUpdatingAttachment ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {invoice.attachment_url ? 'Vervangen' : 'Uploaden'}
              </Button>
              {invoice.attachment_url && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={async () => {
                    if (id) {
                      await updateAttachment({ invoiceId: id, file: null });
                    }
                  }}
                  disabled={isUpdatingAttachment}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          {invoice.attachment_url && (
            <>
              {/* Preview for images */}
              {invoice.attachment_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                <div className="mt-4 border rounded-lg overflow-hidden">
                  <img 
                    src={invoice.attachment_url} 
                    alt="Factuur bijlage" 
                    className="max-w-full h-auto"
                  />
                </div>
              )}
              
              {/* Preview for PDFs */}
              {invoice.attachment_url.match(/\.pdf$/i) && (
                <div className="mt-4 border rounded-lg overflow-hidden">
                  <iframe 
                    src={invoice.attachment_url} 
                    className="w-full h-[600px]"
                    title="Factuur PDF"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Invoice Preview - only show for non-external invoices */}
      {!invoice.attachment_url && (
        <Card className="print:shadow-none print:border-none overflow-hidden">
          <CardContent className="p-0 bg-slate-100/70">
            <div className="p-3 md:p-6 lg:p-8 overflow-x-auto">
              <div className="mx-auto w-[794px] max-w-full shadow-sm ring-1 ring-slate-200">
                <div ref={invoiceRef}>
                  {renderTemplate()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
