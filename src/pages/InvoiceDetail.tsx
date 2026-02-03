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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleDownloadPdf = async () => {
    if (!invoiceRef.current || !invoice) return;

    setIsGeneratingPdf(true);
    try {
      const element = invoiceRef.current;
      
      // A4 dimensions at 96 DPI: width 794px
      const a4WidthPx = 794;
      
      // Clone element for PDF generation to avoid visual flickering
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.width = `${a4WidthPx}px`;
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.backgroundColor = '#ffffff';
      document.body.appendChild(clone);
      
      // Wait for styles to apply
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Create canvas with high quality
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: a4WidthPx,
        windowWidth: a4WidthPx,
      });
      
      // Remove clone
      document.body.removeChild(clone);

      // Use JPEG format to avoid PNG signature issues
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      // Create PDF with A4 dimensions (210 x 297 mm)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = 210;
      const pdfHeight = 297;
      
      // Calculate image dimensions
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // Handle multi-page content
      if (imgHeight <= pdfHeight) {
        // Single page - add image directly
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight);
      } else {
        // Multi-page: split canvas into pages
        const pageHeightInPx = (pdfHeight / pdfWidth) * canvas.width;
        const totalPages = Math.ceil(canvas.height / pageHeightInPx);
        
        for (let page = 0; page < totalPages; page++) {
          if (page > 0) {
            pdf.addPage();
          }
          
          const yOffset = page * pageHeightInPx;
          const remainingHeight = Math.min(pageHeightInPx, canvas.height - yOffset);
          
          // Skip if remaining height is too small (less than 50px = essentially empty)
          if (remainingHeight < 50) {
            if (page > 0) {
              // Remove the empty page we just added
              pdf.deletePage(pdf.getNumberOfPages());
            }
            continue;
          }
          
          // Create page canvas
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = remainingHeight;
          
          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(
              canvas,
              0, yOffset,
              canvas.width, remainingHeight,
              0, 0,
              canvas.width, remainingHeight
            );
            
            const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
            const pageImgHeight = (remainingHeight * pdfWidth) / canvas.width;
            pdf.addImage(pageImgData, 'JPEG', 0, 0, pdfWidth, pageImgHeight);
          }
        }
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
          <CardContent className="p-0">
            <div ref={invoiceRef}>
              {renderTemplate()}
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
