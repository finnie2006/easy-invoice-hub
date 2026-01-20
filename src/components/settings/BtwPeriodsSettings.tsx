import { useState } from 'react';
import { useBtwPeriods } from '@/hooks/useBtwPeriods';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { FileCheck, Plus, Lock, Unlock, CalendarCheck } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

const quarterLabels: Record<number, string> = {
  1: 'Q1 (jan - mrt)',
  2: 'Q2 (apr - jun)',
  3: 'Q3 (jul - sep)',
  4: 'Q4 (okt - dec)',
};

export function BtwPeriodsSettings() {
  const { btwPeriods, isLoading, createPeriod, togglePeriodClosed, isCreating } = useBtwPeriods();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedQuarter, setSelectedQuarter] = useState('1');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const handleAddPeriod = () => {
    const year = parseInt(selectedYear);
    const quarter = parseInt(selectedQuarter);
    const period = `${year}-Q${quarter}`;
    
    // Check if already exists
    if (btwPeriods.some(p => p.period === period)) {
      return;
    }
    
    createPeriod({
      period,
      year,
      quarter,
      is_closed: false,
    });
    setDialogOpen(false);
  };

  const existingPeriods = new Set(btwPeriods.map(p => p.period));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5" />
          BTW-periodes
        </CardTitle>
        <CardDescription>
          Markeer kwartalen als ingediend om te voorkomen dat nieuwe uitgaven in afgesloten periodes terechtkomen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new period button */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Periode toevoegen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>BTW-periode toevoegen</DialogTitle>
              <DialogDescription>
                Voeg een kwartaal toe om bij te houden of de aangifte is gedaan
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="year">Jaar</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quarter">Kwartaal</Label>
                <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map(q => (
                      <SelectItem 
                        key={q} 
                        value={q.toString()}
                        disabled={existingPeriods.has(`${selectedYear}-Q${q}`)}
                      >
                        {quarterLabels[q]}
                        {existingPeriods.has(`${selectedYear}-Q${q}`) && ' (bestaat al)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuleren
              </Button>
              <Button onClick={handleAddPeriod} disabled={isCreating}>
                Toevoegen
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* List of periods */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden...</p>
        ) : btwPeriods.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nog geen BTW-periodes toegevoegd. Voeg een periode toe om bij te houden welke aangiftes je hebt gedaan.
          </p>
        ) : (
          <div className="space-y-2">
            {btwPeriods.map((period) => (
              <div 
                key={period.id} 
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-muted/50 gap-3"
              >
                <div className="flex items-center gap-3">
                  {period.is_closed ? (
                    <Lock className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <Unlock className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div>
                    <p className="font-medium">
                      {period.year} - {quarterLabels[period.quarter]}
                    </p>
                    {period.submitted_at && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarCheck className="h-3 w-3" />
                        Ingediend op {format(new Date(period.submitted_at), 'd MMM yyyy', { locale: nl })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-7 sm:ml-0">
                  <Badge variant={period.is_closed ? 'default' : 'secondary'}>
                    {period.is_closed ? 'Afgesloten' : 'Open'}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`toggle-${period.id}`} className="text-sm cursor-pointer">
                      Ingediend
                    </Label>
                    <Switch
                      id={`toggle-${period.id}`}
                      checked={period.is_closed}
                      onCheckedChange={(checked) => togglePeriodClosed({ id: period.id, is_closed: checked })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4">
          💡 Wanneer je een uitgave toevoegt met een datum in een afgesloten periode, 
          wordt deze automatisch in de eerstvolgende open periode geboekt.
        </p>
      </CardContent>
    </Card>
  );
}
