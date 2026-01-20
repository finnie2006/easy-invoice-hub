import { useState, useRef } from 'react';
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
import { Loader2, Plus, ChevronLeft, Upload, FileText, X } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface ExternalInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExternalInvoiceDialog({ open, onOpenChange }: ExternalInvoiceDialogProps) {
  const { createExternalInvoice, isCreatingExternal } = useInvoices();
  const { clients, createClient, isCreating: isCreatingClient } = useClients();
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const defaultDueDate = format(addDays(new Date(), 14), 'yyyy-MM-dd');

  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  const [newClientData, setNewClientData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    address: '',
    postal_code: '',
    city: '',
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

    if (clientId === 'new') {
      setShowNewClientForm(true);
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

  const handleCreateClient = async () => {
    if (!newClientData.company_name.trim()) return;
    
    const newClient = await createClient({
      company_name: newClientData.company_name,
      contact_name: newClientData.contact_name || null,
      email: newClientData.email || null,
      address: newClientData.address || null,
      postal_code: newClientData.postal_code || null,
      city: newClientData.city || null,
      country: 'Nederland',
      phone: null,
      kvk_number: null,
      btw_number: null,
      notes: null,
      is_saved: true,
    });

    // Select the new client
    setFormData(prev => ({
      ...prev,
      client_id: newClient.id,
      client_company_name: newClient.company_name,
    }));

    // Reset and close new client form
    setNewClientData({
      company_name: '',
      contact_name: '',
      email: '',
      address: '',
      postal_code: '',
      city: '',
    });
    setShowNewClientForm(false);
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
      invoice: {
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
      },
      file: selectedFile || undefined,
    });

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
    setSelectedFile(null);
    setShowNewClientForm(false);
    
    onOpenChange(false);
  };

  // New Client Form view
  if (showNewClientForm) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => setShowNewClientForm(false)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              Nieuwe klant aanmaken
            </DialogTitle>
            <DialogDescription>
              Maak een nieuwe klant aan en gebruik deze direct voor je factuur.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_company_name">Bedrijfsnaam *</Label>
              <Input
                id="new_company_name"
                value={newClientData.company_name}
                onChange={(e) => setNewClientData(prev => ({ ...prev, company_name: e.target.value }))}
                placeholder="Naam van het bedrijf"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new_contact_name">Contactpersoon</Label>
                <Input
                  id="new_contact_name"
                  value={newClientData.contact_name}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, contact_name: e.target.value }))}
                  placeholder="Naam contactpersoon"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_email">E-mailadres</Label>
                <Input
                  id="new_email"
                  type="email"
                  value={newClientData.email}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@bedrijf.nl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_address">Adres</Label>
              <Input
                id="new_address"
                value={newClientData.address}
                onChange={(e) => setNewClientData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Straat en huisnummer"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new_postal_code">Postcode</Label>
                <Input
                  id="new_postal_code"
                  value={newClientData.postal_code}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, postal_code: e.target.value }))}
                  placeholder="1234 AB"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_city">Plaats</Label>
                <Input
                  id="new_city"
                  value={newClientData.city}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Amsterdam"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowNewClientForm(false)}>
              Annuleren
            </Button>
            <Button 
              type="button" 
              onClick={handleCreateClient}
              disabled={isCreatingClient || !newClientData.company_name.trim()}
            >
              {isCreatingClient && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Aanmaken & selecteren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

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
                <SelectItem value="new">
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Nieuwe klant aanmaken
                  </span>
                </SelectItem>
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

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Factuur PDF uploaden</Label>
            <div 
              className={`border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer hover:border-primary/50 ${
                selectedFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSelectedFile(file);
                }}
                className="hidden"
              />
              {selectedFile ? (
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Klik om de originele factuur te uploaden
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF of afbeelding (max 10MB)
                  </p>
                </div>
              )}
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