import { useState } from 'react';
import { useBtwPeriods } from '@/hooks/useBtwPeriods';
import { useExpenses } from '@/hooks/useExpenses';
import { useInvoices } from '@/hooks/useInvoices';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileCheck, 
  Plus, 
  Lock, 
  Unlock, 
  CalendarCheck, 
  Loader2,
  TrendingUp,
  TrendingDown,
  Euro,
  AlertCircle,
  Calculator,
  FileEdit,
} from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  calculateBtwFilingAmounts,
  isDateInBtwQuarter,
  isExpenseInBtwPeriod,
  isInvoiceRelevantForBtw,
} from '@/lib/btw-filing';
import AnnualTaxHelper from '@/components/tax/AnnualTaxHelper';
import BtwFilingWizard from '@/components/tax/BtwFilingWizard';

const quarterLabels: Record<number, string> = {
  1: 'Q1 (jan - mrt)',
  2: 'Q2 (apr - jun)',
  3: 'Q3 (jul - sep)',
  4: 'Q4 (okt - dec)',
};

export default function TaxFilings() {
  const { btwPeriods, isLoading, createPeriod, togglePeriodClosed, isCreating } = useBtwPeriods();
  const { expenses } = useExpenses();
  const { invoices } = useInvoices();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedQuarter, setSelectedQuarter] = useState('1');
  const [activeTab, setActiveTab] = useState('btw');
  const [annualYear, setAnnualYear] = useState(new Date().getFullYear());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedWizardPeriod, setSelectedWizardPeriod] = useState<{
    period: string;
    year: number;
    quarter: number;
  } | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleAddPeriod = () => {
    const year = parseInt(selectedYear);
    const quarter = parseInt(selectedQuarter);
    const period = `${year}-Q${quarter}`;
    
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

  // Calculate stats for each period
  const getQuarterStats = (year: number, quarter: number) => {
    const periodInvoices = invoices.filter((inv) => {
      return isInvoiceRelevantForBtw(inv.status) && isDateInBtwQuarter(inv.invoice_date, year, quarter);
    });

    const periodExpenses = expenses.filter((exp) => isExpenseInBtwPeriod(exp, year, quarter));
    const filingAmounts = calculateBtwFilingAmounts(year, quarter, invoices, expenses);
    const salesVat =
      filingAmounts.field_1a +
      filingAmounts.field_1b +
      filingAmounts.field_1c;
    const reverseChargeVat =
      filingAmounts.field_2a +
      filingAmounts.field_4a +
      filingAmounts.field_4b;
    const otherVat =
      filingAmounts.field_1d;

    return {
      invoiceCount: periodInvoices.length,
      expenseCount: periodExpenses.length,
      revenueVat: filingAmounts.field_5a,
      expenseVat: filingAmounts.field_5b,
      vatToPay: filingAmounts.field_5c,
      salesVat,
      reverseChargeVat,
      otherVat,
    };
  };

  const existingPeriods = new Set(btwPeriods.map(p => p.period));

  // Get current quarter info
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
  const currentPeriodStats = getQuarterStats(currentYear, currentQuarter);
  const currentPeriodClosed = btwPeriods.some(
    p => p.year === currentYear && p.quarter === currentQuarter && p.is_closed
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Aangiftes</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Beheer je BTW-aangiftes en bereken je jaaraangifte
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="btw" className="flex items-center gap-2">
            <Euro className="h-4 w-4" />
            BTW-aangifte
          </TabsTrigger>
          <TabsTrigger value="annual" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Jaaraangifte
          </TabsTrigger>
        </TabsList>

        <TabsContent value="btw" className="space-y-6 mt-6">
          {/* Add period button */}
          <div className="flex justify-end">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
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
          </div>

          {/* Current Quarter Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Euro className="h-5 w-5" />
                Huidig kwartaal: {currentYear} {quarterLabels[currentQuarter]}
              </CardTitle>
              <CardDescription>
                Overzicht van de BTW voor het huidige kwartaal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <TrendingUp className="h-4 w-4" />
                    Verschuldigde btw
                  </div>
                  <div className="text-xl font-bold">{formatCurrency(currentPeriodStats.revenueVat)}</div>
                  <div className="text-xs text-muted-foreground">
                    {currentPeriodStats.invoiceCount} facturen · {formatCurrency(currentPeriodStats.salesVat)} verkoop
                  </div>
                  {currentPeriodStats.reverseChargeVat > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(currentPeriodStats.reverseChargeVat)} verlegd
                    </div>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <TrendingDown className="h-4 w-4" />
                    Voorbelasting
                  </div>
                  <div className="text-xl font-bold text-success">{formatCurrency(currentPeriodStats.expenseVat)}</div>
                  <div className="text-xs text-muted-foreground">
                    {currentPeriodStats.expenseCount} uitgaven
                  </div>
                  {currentPeriodStats.reverseChargeVat > 0 && (
                    <div className="text-xs text-muted-foreground">
                      incl. {formatCurrency(currentPeriodStats.reverseChargeVat)} verlegd
                    </div>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Euro className="h-4 w-4" />
                    Per saldo
                  </div>
                  <div className={`text-xl font-bold ${currentPeriodStats.vatToPay >= 0 ? 'text-warning' : 'text-success'}`}>
                    {formatCurrency(currentPeriodStats.vatToPay)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {currentPeriodStats.vatToPay >= 0 ? 'Te betalen' : 'Terug te vorderen'}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <FileCheck className="h-4 w-4" />
                    Status
                  </div>
                  <div className="mt-1">
                    <Badge variant={currentPeriodClosed ? 'default' : 'secondary'}>
                      {currentPeriodClosed ? 'Ingediend' : 'Open'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Period List */}
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
            <CardContent>
              {btwPeriods.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nog geen BTW-periodes toegevoegd</p>
                  <p className="text-sm">Voeg een periode toe om je aangiftes bij te houden</p>
                </div>
              ) : (
                <>
                  {/* Mobile card view */}
                  <div className="block md:hidden space-y-3">
                    {btwPeriods.map((period) => {
                      const stats = getQuarterStats(period.year, period.quarter);
                      return (
                        <div 
                          key={period.id} 
                          className="p-4 rounded-lg bg-muted/50 space-y-3"
                        >
                          <div className="flex items-start justify-between">
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
                            <Badge variant={period.is_closed ? 'default' : 'secondary'}>
                              {period.is_closed ? 'Afgesloten' : 'Open'}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Verschuldigde btw:</span>
                              <span className="ml-2 font-medium">{formatCurrency(stats.revenueVat)}</span>
                              <p className="text-xs text-muted-foreground mt-1">
                                Verkoop {formatCurrency(stats.salesVat)}
                                {stats.reverseChargeVat > 0 && ` · verlegd ${formatCurrency(stats.reverseChargeVat)}`}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Voorbelasting:</span>
                              <span className="ml-2 font-medium text-success">{formatCurrency(stats.expenseVat)}</span>
                              {stats.reverseChargeVat > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  incl. verlegd {formatCurrency(stats.reverseChargeVat)}
                                </p>
                              )}
                            </div>
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Per saldo:</span>
                              <span className={`ml-2 font-bold ${stats.vatToPay >= 0 ? 'text-warning' : 'text-success'}`}>
                                {formatCurrency(stats.vatToPay)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-2 border-t">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedWizardPeriod({
                                  period: period.period,
                                  year: period.year,
                                  quarter: period.quarter,
                                });
                                setWizardOpen(true);
                              }}
                            >
                              <FileEdit className="h-4 w-4 mr-1" />
                              Aangifte
                            </Button>
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
                      );
                    })}
                  </div>

                  {/* Desktop table view */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Periode</TableHead>
                          <TableHead className="text-right">Verschuldigde btw</TableHead>
                          <TableHead className="text-right">Voorbelasting</TableHead>
                          <TableHead className="text-right">Per saldo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Aangifte</TableHead>
                          <TableHead className="text-right">Ingediend</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {btwPeriods.map((period) => {
                          const stats = getQuarterStats(period.year, period.quarter);
                          return (
                            <TableRow key={period.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {period.is_closed ? (
                                    <Lock className="h-4 w-4 text-success" />
                                  ) : (
                                    <Unlock className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <div>
                                    <p className="font-medium">{period.year} - {quarterLabels[period.quarter]}</p>
                                    {period.submitted_at && (
                                      <p className="text-xs text-muted-foreground">
                                        Ingediend {format(new Date(period.submitted_at), 'd MMM yyyy', { locale: nl })}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div>{formatCurrency(stats.revenueVat)}</div>
                                <div className="text-xs text-muted-foreground">
                                  Verkoop {formatCurrency(stats.salesVat)}
                                  {stats.reverseChargeVat > 0 && ` · verlegd ${formatCurrency(stats.reverseChargeVat)}`}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-success">
                                <div>{formatCurrency(stats.expenseVat)}</div>
                                {stats.reverseChargeVat > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    incl. verlegd {formatCurrency(stats.reverseChargeVat)}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className={`text-right font-bold ${stats.vatToPay >= 0 ? 'text-warning' : 'text-success'}`}>
                                {formatCurrency(stats.vatToPay)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={period.is_closed ? 'default' : 'secondary'}>
                                  {period.is_closed ? 'Afgesloten' : 'Open'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedWizardPeriod({
                                      period: period.period,
                                      year: period.year,
                                      quarter: period.quarter,
                                    });
                                    setWizardOpen(true);
                                  }}
                                >
                                  <FileEdit className="h-4 w-4" />
                                </Button>
                              </TableCell>
                              <TableCell className="text-right">
                                <Switch
                                  checked={period.is_closed}
                                  onCheckedChange={(checked) => togglePeriodClosed({ id: period.id, is_closed: checked })}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              <div className="flex items-start gap-2 mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Wanneer je een uitgave toevoegt met een datum in een afgesloten periode, 
                  wordt deze automatisch in de eerstvolgende open periode geboekt.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="annual" className="space-y-6 mt-6">
          <div className="flex justify-end">
            <Select value={annualYear.toString()} onValueChange={(v) => setAnnualYear(parseInt(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AnnualTaxHelper selectedYear={annualYear} />
        </TabsContent>
      </Tabs>

      {selectedWizardPeriod && (
        <BtwFilingWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          year={selectedWizardPeriod.year}
          quarter={selectedWizardPeriod.quarter}
          period={selectedWizardPeriod.period}
        />
      )}
    </div>
  );
}
