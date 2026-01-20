import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInvoice, useInvoices, InvoiceItemInsert } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { DatePicker } from '@/components/ui/date-picker';
import { Loader2, Plus, Trash2, FileText, ArrowLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface InvoiceItemForm extends InvoiceItemInsert {
  id: string;
}

export default function InvoiceEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading: isLoadingInvoice } = useInvoice(id || '');
  const { updateInvoice, isUpdating } = useInvoices();
  const { clients } = useClients();
  const { profile } = useProfile();

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState<Date | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  const [clientData, setClientData] = useState({
    company_name: '',
    contact_name: '',
    address: '',
    postal_code: '',
    city: '',
    country: 'Nederland',
    kvk_number: '',
    btw_number: '',
  });

  const [items, setItems] = useState<InvoiceItemForm[]>([]);

  // Load invoice data
  useEffect(() => {
    if (invoice) {
      setInvoiceNumber(invoice.invoice_number);
      setInvoiceDate(parseISO(invoice.invoice_date));
      setDueDate(parseISO(invoice.due_date));
      setSelectedClientId(invoice.client_id || 'new');
      setNotes(invoice.notes || '');
      setPaymentReference(invoice.payment_reference || '');
      setClientData({
        company_name: invoice.client_company_name || '',
        contact_name: invoice.client_contact_name || '',
        address: invoice.client_address || '',
        postal_code: invoice.client_postal_code || '',
        city: invoice.client_city || '',
        country: invoice.client_country || 'Nederland',
        kvk_number: invoice.client_kvk_number || '',
        btw_number: invoice.client_btw_number || '',
      });
      setItems(invoice.items?.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        btw_percentage: item.btw_percentage,
      })) || []);
    }
  }, [invoice]);

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId && clientId !== 'new') {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        setClientData({
          company_name: client.company_name,
          contact_name: client.contact_name || '',
          address: client.address || '',
          postal_code: client.postal_code || '',
          city: client.city || '',
          country: client.country || 'Nederland',
          kvk_number: client.kvk_number || '',
          btw_number: client.btw_number || '',
        });
      }
    }
  };

  const handleClientDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setClientData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (id: string, field: keyof InvoiceItemForm, value: string | number) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      unit: 'uur',
      unit_price: profile?.default_hourly_rate || 0,
      btw_percentage: 21,
    }]);
  };

  const removeItem = (itemId: string) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(item => item.id !== itemId));
    }
  };

  const calculateItemTotal = (item: InvoiceItemForm) => {
    const subtotal = item.quantity * item.unit_price;
    const btw = subtotal * (item.btw_percentage / 100);
    return { subtotal, btw, total: subtotal + btw };
  };

  const totals = items.reduce(
    (acc, item) => {
      const { subtotal, btw, total } = calculateItemTotal(item);
      return {
        subtotal: acc.subtotal + subtotal,
        btw: acc.btw + btw,
        total: acc.total + total,
      };
    },
    { subtotal: 0, btw: 0, total: 0 }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientData.company_name || !id || !invoiceDate || !dueDate) {
      return;
    }

    if (items.some(item => !item.description)) {
      return;
    }

    try {
      await updateInvoice({
        id,
        invoice: {
          invoice_number: invoiceNumber,
          invoice_date: format(invoiceDate, 'yyyy-MM-dd'),
          due_date: format(dueDate, 'yyyy-MM-dd'),
          client_id: selectedClientId && selectedClientId !== 'new' ? selectedClientId : null,
          client_company_name: clientData.company_name,
          client_contact_name: clientData.contact_name || null,
          client_address: clientData.address || null,
          client_postal_code: clientData.postal_code || null,
          client_city: clientData.city || null,
          client_country: clientData.country || null,
          client_kvk_number: clientData.kvk_number || null,
          client_btw_number: clientData.btw_number || null,
          notes: notes || null,
          payment_reference: paymentReference || invoiceNumber,
        },
        items: items.map(({ id: itemId, ...item }) => item),
      });

      navigate(`/invoices/${id}`);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  if (isLoadingInvoice) {
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
        <Button variant="link" onClick={() => navigate('/invoices')} className="mt-2">
          Terug naar facturen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/invoices/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Factuur bewerken</h1>
          <p className="text-muted-foreground">
            Factuur {invoiceNumber}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Factuurgegevens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invoice_number">Factuurnummer</Label>
                  <Input
                    id="invoice_number"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_reference">Betalingskenmerk</Label>
                  <Input
                    id="payment_reference"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder={invoiceNumber}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice_date">Factuurdatum *</Label>
                  <DatePicker
                    id="invoice_date"
                    value={invoiceDate}
                    onChange={(date) => date && setInvoiceDate(date)}
                    showClearButton={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Vervaldatum *</Label>
                  <DatePicker
                    id="due_date"
                    value={dueDate}
                    onChange={(date) => date && setDueDate(date)}
                    showClearButton={false}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Opmerkingen</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optionele opmerkingen voor op de factuur..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Client Details */}
          <Card>
            <CardHeader>
              <CardTitle>Klantgegevens</CardTitle>
              <CardDescription>Selecteer een bestaande klant of vul de gegevens in</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Klant selecteren</Label>
                <Select value={selectedClientId} onValueChange={handleClientChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer een klant of voer in..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Nieuwe klant (eenmalig)</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="company_name">Bedrijfsnaam *</Label>
                  <Input
                    id="company_name"
                    name="company_name"
                    value={clientData.company_name}
                    onChange={handleClientDataChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Contactpersoon</Label>
                  <Input
                    id="contact_name"
                    name="contact_name"
                    value={clientData.contact_name}
                    onChange={handleClientDataChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="btw_number">BTW-nummer</Label>
                  <Input
                    id="btw_number"
                    name="btw_number"
                    value={clientData.btw_number}
                    onChange={handleClientDataChange}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Adres</Label>
                  <Input
                    id="address"
                    name="address"
                    value={clientData.address}
                    onChange={handleClientDataChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postcode</Label>
                  <Input
                    id="postal_code"
                    name="postal_code"
                    value={clientData.postal_code}
                    onChange={handleClientDataChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Plaats</Label>
                  <Input
                    id="city"
                    name="city"
                    value={clientData.city}
                    onChange={handleClientDataChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoice Items */}
        <Card>
          <CardHeader>
            <CardTitle>Factuurregels</CardTitle>
            <CardDescription>Voeg de producten of diensten toe</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {items.map((item) => {
                const { subtotal } = calculateItemTotal(item);
                return (
                  <div key={item.id} className="grid gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="grid gap-4 md:grid-cols-12">
                      <div className="md:col-span-5 space-y-2">
                        <Label>Omschrijving *</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                          placeholder="Bijv. Ontwikkelwerkzaamheden"
                          required
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <Label>Aantal</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-20"
                          />
                          <Select 
                            value={item.unit} 
                            onValueChange={(value) => handleItemChange(item.id, 'unit', value)}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="uur">uur</SelectItem>
                              <SelectItem value="dag">dag</SelectItem>
                              <SelectItem value="stuk">stuk</SelectItem>
                              <SelectItem value="project">project</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <Label>Prijs (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <Label>BTW</Label>
                        <Select 
                          value={item.btw_percentage.toString()} 
                          onValueChange={(value) => handleItemChange(item.id, 'btw_percentage', parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="21">21%</SelectItem>
                            <SelectItem value="9">9%</SelectItem>
                            <SelectItem value="0">0%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-1 flex items-end justify-between">
                        <div className="text-right">
                          <Label className="text-xs text-muted-foreground">Subtotaal</Label>
                          <p className="font-medium">{formatCurrency(subtotal)}</p>
                        </div>
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <Button type="button" variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4 mr-2" />
                Regel toevoegen
              </Button>
            </div>

            <Separator className="my-6" />

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotaal</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">BTW</span>
                  <span>{formatCurrency(totals.btw)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Totaal</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(`/invoices/${id}`)}>
            Annuleren
          </Button>
          <Button type="submit" disabled={isUpdating}>
            {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Wijzigingen opslaan
          </Button>
        </div>
      </form>
    </div>
  );
}
