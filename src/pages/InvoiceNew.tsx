import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvoices, InvoiceItemInsert, calculateItemTotals } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { DatePicker } from '@/components/ui/date-picker';
import { DiscountInput } from '@/components/invoices/DiscountInput';
import { Loader2, Plus, Trash2, FileText, ArrowLeft } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface InvoiceItemForm extends InvoiceItemInsert {
  id: string;
}

export default function InvoiceNew() {
  const navigate = useNavigate();
  const { getNextInvoiceNumber, createInvoice, isCreating } = useInvoices();
  const { clients } = useClients();
  const { profile } = useProfile();

  const today = new Date();
  const defaultPaymentTerms = profile?.default_payment_terms || 14;

  const [invoiceNumber] = useState(getNextInvoiceNumber());
  const [invoiceDate, setInvoiceDate] = useState<Date>(today);
  const [dueDate, setDueDate] = useState<Date>(addDays(today, defaultPaymentTerms));

  useEffect(() => {
    if (invoiceDate) {
      const terms = profile?.default_payment_terms || 14;
      setDueDate(addDays(invoiceDate, terms));
    }
  }, [invoiceDate, profile?.default_payment_terms]);

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [notesTitle, setNotesTitle] = useState('Opmerkingen');
  const [paymentReference, setPaymentReference] = useState('');

  // Invoice-level discount
  const [invoiceDiscountType, setInvoiceDiscountType] = useState<string | null>(null);
  const [invoiceDiscountValue, setInvoiceDiscountValue] = useState<number>(0);

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

  const [items, setItems] = useState<InvoiceItemForm[]>([
    {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      unit: 'uur',
      unit_price: profile?.default_hourly_rate || 0,
      btw_percentage: 21,
      discount_type: null,
      discount_value: 0,
    },
  ]);

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
    } else {
      setClientData({
        company_name: '',
        contact_name: '',
        address: '',
        postal_code: '',
        city: '',
        country: 'Nederland',
        kvk_number: '',
        btw_number: '',
      });
    }
  };

  const handleClientDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setClientData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (id: string, field: keyof InvoiceItemForm, value: any) => {
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
      discount_type: null,
      discount_value: 0,
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const getItemCalc = (item: InvoiceItemForm) => {
    return calculateItemTotals(item);
  };

  const itemTotals = items.map(item => getItemCalc(item));
  const rawSubtotal = itemTotals.reduce((sum, t) => sum + t.subtotal, 0);
  const rawBtw = itemTotals.reduce((sum, t) => sum + t.btw_amount, 0);

  let invoiceDiscountAmount = 0;
  if (invoiceDiscountType === 'percentage' && invoiceDiscountValue) {
    invoiceDiscountAmount = rawSubtotal * (invoiceDiscountValue / 100);
  } else if (invoiceDiscountType === 'amount' && invoiceDiscountValue) {
    invoiceDiscountAmount = invoiceDiscountValue;
  }

  const discountedSubtotal = rawSubtotal - invoiceDiscountAmount;
  const adjustedBtw = invoiceDiscountAmount > 0 && rawSubtotal > 0 
    ? rawBtw * (discountedSubtotal / rawSubtotal) 
    : rawBtw;
  const grandTotal = discountedSubtotal + adjustedBtw;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientData.company_name) return;
    if (items.some(item => !item.description)) return;

    try {
      await createInvoice({
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
          notes_title: notesTitle || 'Opmerkingen',
          payment_reference: paymentReference || invoiceNumber,
          status: 'draft',
          discount_type: invoiceDiscountType,
          discount_value: invoiceDiscountValue,
        },
        items: items.map(({ id, ...item }) => item),
      });

      navigate('/invoices');
    } catch (error) {
      // Error is handled by the hook
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nieuwe factuur</h1>
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
                    disabled
                    className="bg-muted"
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
                <Label htmlFor="notes_title">Titel opmerkingen</Label>
                <Input
                  id="notes_title"
                  value={notesTitle}
                  onChange={(e) => setNotesTitle(e.target.value)}
                  placeholder="Opmerkingen"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Opmerkingen</Label>
                <RichTextEditor
                  id="notes"
                  value={notes}
                  onChange={setNotes}
                  placeholder="Optionele opmerkingen voor op de factuur..."
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
              {items.map((item, index) => {
                const calc = getItemCalc(item);
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
                            value={item.unit || 'none'} 
                            onValueChange={(value) => handleItemChange(item.id, 'unit', value === 'none' ? null : value)}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
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
                          <p className="font-medium">{formatCurrency(calc.subtotal)}</p>
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
                    {/* Item-level discount */}
                    <div className="flex items-end gap-4">
                      <DiscountInput
                        discountType={item.discount_type || null}
                        discountValue={item.discount_value || 0}
                        onTypeChange={(type) => handleItemChange(item.id, 'discount_type', type)}
                        onValueChange={(value) => handleItemChange(item.id, 'discount_value', value)}
                        label="Regelkorting"
                      />
                      {calc.discountAmount > 0 && (
                        <p className="text-sm text-muted-foreground pb-2">
                          -{formatCurrency(calc.discountAmount)}
                        </p>
                      )}
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

            {/* Invoice-level Discount */}
            <div className="flex justify-between items-end mb-6">
              <DiscountInput
                discountType={invoiceDiscountType}
                discountValue={invoiceDiscountValue}
                onTypeChange={setInvoiceDiscountType}
                onValueChange={setInvoiceDiscountValue}
                label="Factuurkorting (op totaal)"
              />
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotaal</span>
                  <span>{formatCurrency(rawSubtotal)}</span>
                </div>
                {invoiceDiscountAmount > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Factuurkorting</span>
                    <span>-{formatCurrency(invoiceDiscountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">BTW</span>
                  <span>{formatCurrency(adjustedBtw)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Totaal</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>
            Annuleren
          </Button>
          <Button type="submit" disabled={isCreating}>
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Factuur aanmaken
          </Button>
        </div>
      </form>
    </div>
  );
}
