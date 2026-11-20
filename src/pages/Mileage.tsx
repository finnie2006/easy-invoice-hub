import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Car, CheckCircle2, FileText, Loader2, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMileage, type MileageEntry, type MileageEntryInsert } from '@/hooks/useMileage';
import { useInvoices, type Invoice } from '@/hooks/useInvoices';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const DEFAULT_RATE = 0.25;
const NO_INVOICE = 'none';

const emptyForm = (): MileageEntryInsert => ({
  travel_date: format(new Date(), 'yyyy-MM-dd'),
  destination: '',
  purpose: '',
  kilometers: 0,
  rate: DEFAULT_RATE,
  notes: null,
  invoice_id: null,
});

const formatCurrency = (value: number) => new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
}).format(value);

const invoiceLabel = (invoice: Invoice) => [
  invoice.invoice_number,
  invoice.client_company_name || invoice.client_contact_name,
  format(parseISO(invoice.invoice_date), 'd MMM yyyy', { locale: nl }),
].filter(Boolean).join(' · ');

function InvoiceSelect({ id, invoices, value, onChange, disabled }: {
  id: string;
  invoices: Invoice[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value ?? NO_INVOICE} onValueChange={(next) => onChange(next === NO_INVOICE ? null : next)} disabled={disabled}>
      <SelectTrigger id={id}><SelectValue placeholder="Geen factuur" /></SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={NO_INVOICE}>Geen factuur</SelectItem>
        {invoices.map((invoice) => <SelectItem key={invoice.id} value={invoice.id}>{invoiceLabel(invoice)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function Mileage() {
  const { entries, isLoading, createEntry, updateEntry, isUpdating, deleteEntry, isCreating, finalizeYear, isFinalizing } = useMileage();
  const { invoices } = useInvoices();
  const [form, setForm] = useState<MileageEntryInsert>(emptyForm);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [finalizeYearValue, setFinalizeYearValue] = useState(new Date().getFullYear());
  const [editing, setEditing] = useState<MileageEntry | null>(null);
  const [editForm, setEditForm] = useState<MileageEntryInsert>(emptyForm);

  const sortedInvoices = useMemo(
    () => [...invoices].sort((a, b) => b.invoice_date.localeCompare(a.invoice_date)),
    [invoices],
  );
  const invoicesById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices]);

  const totals = useMemo(() => entries.reduce(
    (result, entry) => ({
      kilometers: result.kilometers + Number(entry.kilometers),
      deduction: result.deduction + Number(entry.kilometers) * Number(entry.rate),
    }),
    { kilometers: 0, deduction: 0 },
  ), [entries]);
  const finalizableEntries = entries.filter((entry) => (
    !entry.is_finalized && new Date(`${entry.travel_date}T00:00:00`).getFullYear() === finalizeYearValue
  ));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createEntry(form);
    setForm(emptyForm());
    setSelectedDate(new Date());
  };

  const openEdit = (entry: MileageEntry) => {
    setEditing(entry);
    setEditForm({
      travel_date: entry.travel_date,
      destination: entry.destination,
      purpose: entry.purpose,
      kilometers: Number(entry.kilometers),
      rate: Number(entry.rate),
      notes: entry.notes,
      invoice_id: entry.invoice_id,
    });
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const data: Partial<MileageEntryInsert> = editing.is_finalized
      ? { invoice_id: editForm.invoice_id }
      : editForm;
    await updateEntry({ id: editing.id, data });
    setEditing(null);
  };

  const handleFinalizeYear = async () => {
    if (finalizableEntries.length === 0) return;
    if (window.confirm(`Maak ${finalizableEntries.length} rit(ten) uit ${finalizeYearValue} definitief voor de inkomstenbelasting?`)) {
      await finalizeYear(finalizeYearValue);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const editLocked = !!editing?.is_finalized;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Kilometerregistratie</h1>
        <p className="text-sm text-muted-foreground sm:text-base">Leg zakelijke ritten met je privéauto vast voor je administratie</p>
      </div>

      <Alert>
        <Car className="h-4 w-4" />
        <AlertDescription>
          Voor 2026 staat het standaardtarief op <strong>€ 0,25 per kilometer</strong>.
          Noteer het zakelijke doel; een factuur is niet vereist. Dit overzicht is voor de inkomstenbelasting,
          niet voor btw-aftrek.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Ritten definitief maken</CardTitle>
          <CardDescription>Definitieve ritten worden automatisch meegenomen in de jaaraangifte inkomstenbelasting.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Label htmlFor="finalize-year">Jaar</Label>
            <Select value={String(finalizeYearValue)} onValueChange={(value) => setFinalizeYearValue(Number(value))}>
              <SelectTrigger id="finalize-year" className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>{[finalizeYearValue - 1, finalizeYearValue, finalizeYearValue + 1].map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleFinalizeYear} disabled={isFinalizing || finalizableEntries.length === 0}>
            {isFinalizing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            {finalizableEntries.length > 0 ? `Ritten ${finalizeYearValue} definitief maken (${finalizableEntries.length})` : `Geen open ritten in ${finalizeYearValue}`}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardDescription>Totaal zakelijke kilometers</CardDescription><CardTitle>{totals.kilometers.toLocaleString('nl-NL')} km</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Indicatieve aftrekbare kosten</CardDescription><CardTitle>{formatCurrency(totals.deduction)}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nieuwe rit</CardTitle>
          <CardDescription>Een retourrit mag als één totaal aantal kilometers worden ingevoerd.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-2"><Label htmlFor="travel_date">Datum</Label><DatePicker id="travel_date" value={selectedDate} onChange={(date) => { if (date) { setSelectedDate(date); setForm({ ...form, travel_date: format(date, 'yyyy-MM-dd') }); } }} showClearButton={false} /></div>
            <div className="space-y-2"><Label htmlFor="destination">Bestemming *</Label><Input id="destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Klant of plaats" required /></div>
            <div className="space-y-2"><Label htmlFor="purpose">Zakelijk doel *</Label><Input id="purpose" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Overleg, demo..." required /></div>
            <div className="space-y-2"><Label htmlFor="kilometers">Kilometers *</Label><Input id="kilometers" type="number" min="0.1" step="0.1" value={form.kilometers || ''} onChange={(e) => setForm({ ...form, kilometers: Number(e.target.value) })} placeholder="80" required /></div>
            <div className="space-y-2"><Label htmlFor="invoice_id">Factuur</Label><InvoiceSelect id="invoice_id" invoices={sortedInvoices} value={form.invoice_id} onChange={(invoice_id) => setForm({ ...form, invoice_id })} /></div>
            <div className="flex items-end"><Button type="submit" disabled={isCreating} className="w-full"><Plus className="h-4 w-4 mr-2" />Rit toevoegen</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ritten</CardTitle><CardDescription>{entries.length} geregistreerde {entries.length === 1 ? 'rit' : 'ritten'}</CardDescription></CardHeader>
        <CardContent>
          {entries.length === 0 ? <p className="py-6 text-center text-muted-foreground">Nog geen ritten geregistreerd.</p> : (
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Datum</TableHead><TableHead>Bestemming</TableHead><TableHead>Doel</TableHead><TableHead>Factuur</TableHead><TableHead className="text-right">Km</TableHead><TableHead className="text-right">Aftrek</TableHead><TableHead className="w-24" /></TableRow></TableHeader><TableBody>
              {entries.map((entry) => {
                const invoice = entry.invoice_id ? invoicesById.get(entry.invoice_id) : undefined;
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">{format(parseISO(entry.travel_date), 'd MMM yyyy', { locale: nl })}</TableCell>
                    <TableCell>{entry.destination}</TableCell>
                    <TableCell>{entry.purpose}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {invoice ? (
                        <Link to={`/invoices/${invoice.id}`} className="inline-flex items-center gap-1 text-primary hover:underline"><FileText className="h-3.5 w-3.5" />{invoice.invoice_number}</Link>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">{Number(entry.kilometers).toLocaleString('nl-NL')} km</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatCurrency(Number(entry.kilometers) * Number(entry.rate))}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {entry.is_finalized && <span className="mr-1 text-xs text-success">Definitief</span>}
                        <Button variant="ghost" size="icon" aria-label={`Rit naar ${entry.destination} bewerken`} onClick={() => openEdit(entry)}><Pencil className="h-4 w-4" /></Button>
                        {!entry.is_finalized && <Button variant="ghost" size="icon" aria-label={`Rit naar ${entry.destination} verwijderen`} onClick={() => deleteEntry(entry.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody></Table></div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rit bewerken</DialogTitle>
            <DialogDescription>Pas de gegevens van de rit aan of koppel een factuur ter referentie.</DialogDescription>
          </DialogHeader>
          {editLocked && (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>Deze rit is definitief en telt mee in de aangifte. Alleen de factuurkoppeling kan nog worden gewijzigd.</AlertDescription>
            </Alert>
          )}
          <form id="edit-mileage-form" onSubmit={handleEditSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit_travel_date">Datum</Label>
              <DatePicker id="edit_travel_date" value={parseISO(editForm.travel_date)} onChange={(date) => { if (date) setEditForm({ ...editForm, travel_date: format(date, 'yyyy-MM-dd') }); }} showClearButton={false} disabled={editLocked} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_kilometers">Kilometers *</Label>
              <Input id="edit_kilometers" type="number" min="0.1" step="0.1" value={editForm.kilometers || ''} onChange={(e) => setEditForm({ ...editForm, kilometers: Number(e.target.value) })} required disabled={editLocked} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit_destination">Bestemming *</Label>
              <Input id="edit_destination" value={editForm.destination} onChange={(e) => setEditForm({ ...editForm, destination: e.target.value })} required disabled={editLocked} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit_purpose">Zakelijk doel *</Label>
              <Input id="edit_purpose" value={editForm.purpose} onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })} required disabled={editLocked} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_rate">Tarief per km (€)</Label>
              <Input id="edit_rate" type="number" min="0" step="0.01" value={editForm.rate} onChange={(e) => setEditForm({ ...editForm, rate: Number(e.target.value) })} required disabled={editLocked} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_invoice_id">Factuur</Label>
              <InvoiceSelect id="edit_invoice_id" invoices={sortedInvoices} value={editForm.invoice_id} onChange={(invoice_id) => setEditForm({ ...editForm, invoice_id })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit_notes">Notities</Label>
              <Textarea id="edit_notes" value={editForm.notes ?? ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value || null })} rows={3} disabled={editLocked} />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Annuleren</Button>
            <Button type="submit" form="edit-mileage-form" disabled={isUpdating}>
              {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
