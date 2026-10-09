import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Car, CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';
import { useMileage, type MileageEntryInsert } from '@/hooks/useMileage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DEFAULT_RATE = 0.25;

const emptyForm = (): MileageEntryInsert => ({
  travel_date: format(new Date(), 'yyyy-MM-dd'),
  destination: '',
  purpose: '',
  kilometers: 0,
  rate: DEFAULT_RATE,
  notes: null,
});

export default function Mileage() {
  const { entries, isLoading, createEntry, deleteEntry, isCreating, finalizeYear, isFinalizing } = useMileage();
  const [form, setForm] = useState<MileageEntryInsert>(emptyForm);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [finalizeYearValue, setFinalizeYearValue] = useState(new Date().getFullYear());

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
  const formatCurrency = (value: number) => new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createEntry(form);
    setForm(emptyForm());
    setSelectedDate(new Date());
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Kilometerregistratie</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Leg zakelijke ritten met je privéauto vast voor je administratie</p>
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
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2"><Label htmlFor="travel_date">Datum</Label><DatePicker id="travel_date" value={selectedDate} onChange={(date) => { if (date) { setSelectedDate(date); setForm({ ...form, travel_date: format(date, 'yyyy-MM-dd') }); } }} showClearButton={false} /></div>
            <div className="space-y-2"><Label htmlFor="destination">Bestemming *</Label><Input id="destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Klant of plaats" required /></div>
            <div className="space-y-2"><Label htmlFor="purpose">Zakelijk doel *</Label><Input id="purpose" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Overleg, demo..." required /></div>
            <div className="space-y-2"><Label htmlFor="kilometers">Kilometers *</Label><Input id="kilometers" type="number" min="0.1" step="0.1" value={form.kilometers || ''} onChange={(e) => setForm({ ...form, kilometers: Number(e.target.value) })} placeholder="80" required /></div>
            <div className="flex items-end"><Button type="submit" disabled={isCreating} className="w-full"><Plus className="h-4 w-4 mr-2" />Rit toevoegen</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ritten</CardTitle><CardDescription>{entries.length} geregistreerde {entries.length === 1 ? 'rit' : 'ritten'}</CardDescription></CardHeader>
        <CardContent>
          {entries.length === 0 ? <p className="py-6 text-center text-muted-foreground">Nog geen ritten geregistreerd.</p> : (
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Datum</TableHead><TableHead>Bestemming</TableHead><TableHead>Doel</TableHead><TableHead className="text-right">Km</TableHead><TableHead className="text-right">Aftrek</TableHead><TableHead className="w-12" /></TableRow></TableHeader><TableBody>
              {entries.map((entry) => <TableRow key={entry.id}><TableCell>{format(parseISO(entry.travel_date), 'd MMM yyyy', { locale: nl })}</TableCell><TableCell>{entry.destination}</TableCell><TableCell>{entry.purpose}</TableCell><TableCell className="text-right">{Number(entry.kilometers).toLocaleString('nl-NL')} km</TableCell><TableCell className="text-right">{formatCurrency(Number(entry.kilometers) * Number(entry.rate))}</TableCell><TableCell>{entry.is_finalized ? <span className="text-xs text-success">Definitief</span> : <Button variant="ghost" size="icon" aria-label={`Rit naar ${entry.destination} verwijderen`} onClick={() => deleteEntry(entry.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</TableCell></TableRow>)}
            </TableBody></Table></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
