import { useState } from 'react';
import { useInvoices } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface ExternalInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExternalInvoiceDialog({ open, onOpenChange }: ExternalInvoiceDialogProps) {
  const { createExternalInvoice, isCreatingExternal } = useInvoices();
  const { clients } = useClients();
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const defaultDueDate = format(addDays(new Date(), 14), 'yyyy-MM-dd');

  const [formData, setFormData] = useState({
    invoice_number: '',
    invoice_date: today,
    due_date: defaultDueDate,
    client_id: '',
    client_company_name: '',
    subtotal: '',
    total_btw: '',
    total: '',
    status: 'sent',
    notes: '',
  });

  const handleClientChange = (clientId: string) => {
    if (clientId === 'manual') {
      setFormData(prev => ({
        ...prev,
        client_id: '',
        client_company_name: '',
      }));
      return;
    }

    const client = clients?.find(c => c.id === clientId);
    if (client) {
      setFormData(prev => ({
        ...prev,
        client_id: clientId,
        client_company_name: client.company_name,
      }));
    }
  };

  const handleAmountChange = (field: 'subtotal' | 'total_btw' | 'total', value: string) => {
    const newData = { ...formData, [field]: value };
    
    // Auto-calculate total if subtotal and btw are filled
    if (field === 'subtotal' || field === 'total_btw') {
      const subtotal = parseFloat(newData.subtotal) || 0;
      const btw = parseFloat(newData.total_btw) || 0;
      newData.total = (subtotal + btw).toFixed(2);
    }
    
    setFormData(newData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createExternalInvoice({
      invoice_number: formData.invoice_number,
      invoice_date: formData.invoice_date,
      due_date: formData.due_date,
      client_id: formData.client_id || null,
      client_company_name: formData.client_company_name,
      status: formData.status,
      notes: formData.notes,
      subtotal: parseFloat(formData.subtotal) || 0,
      total_btw: parseFloat(formData.total_btw) || 0,
      total: parseFloat(formData.total) || 0,
    });

    // Reset form
    setFormData({
      invoice_number: '',
      invoice_date: today,
      due_date: defaultDueDate,
      client_id: '',
      client_company_name: '',
      subtotal: '',
      total_btw: '',
      total: '',
      status: 'sent',
      notes: '',
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Externe factuur registreren</DialogTitle>
          <DialogDescription>
            Voeg een factuur toe die elders is aangemaakt. Alleen de basisgegevens worden opgeslagen.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_number">Factuurnummer *</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                placeholder="bijv. 2024001"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Concept</SelectItem>
                  <SelectItem value="sent">Verzonden</SelectItem>
                  <SelectItem value="paid">Betaald</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_date">Factuurdatum *</Label>
              <Input
                id="invoice_date"
                type="date"
                value={formData.invoice_date}
                onChange={(e) => setFormData(prev => ({ ...prev, invoice_date: e.target.value }))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="due_date">Vervaldatum *</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client">Klant</Label>
            <Select
              value={formData.client_id || 'manual'}
              onValueChange={handleClientChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer klant of voer handmatig in" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Handmatig invoeren</SelectItem>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!formData.client_id && (
            <div className="space-y-2">
              <Label htmlFor="client_company_name">Klantnaam</Label>
              <Input
                id="client_company_name"
                value={formData.client_company_name}
                onChange={(e) => setFormData(prev => ({ ...prev, client_company_name: e.target.value }))}
                placeholder="Naam van de klant"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subtotal">Subtotaal (excl. BTW)</Label>
              <Input
                id="subtotal"
                type="number"
                step="0.01"
                value={formData.subtotal}
                onChange={(e) => handleAmountChange('subtotal', e.target.value)}
                placeholder="0,00"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="total_btw">BTW bedrag</Label>
              <Input
                id="total_btw"
                type="number"
                step="0.01"
                value={formData.total_btw}
                onChange={(e) => handleAmountChange('total_btw', e.target.value)}
                placeholder="0,00"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="total">Totaal (incl. BTW) *</Label>
              <Input
                id="total"
                type="number"
                step="0.01"
                value={formData.total}
                onChange={(e) => setFormData(prev => ({ ...prev, total: e.target.value }))}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notities</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Optionele notities over deze factuur"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={isCreatingExternal}>
              {isCreatingExternal && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registreren
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}