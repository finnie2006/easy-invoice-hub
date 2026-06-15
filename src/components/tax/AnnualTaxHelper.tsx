import { useState, useEffect } from 'react';
import { useInvoices } from '@/hooks/useInvoices';
import { useExpenses } from '@/hooks/useExpenses';
import { useOtherIncome } from '@/hooks/useOtherIncome';
import { useBusinessAssets, BusinessAssetInsert, ASSET_CATEGORIES } from '@/hooks/useBusinessAssets';
import { useAnnualTaxData, TAX_CONSTANTS } from '@/hooks/useAnnualTaxData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  Building2,
  Car,
  Package,
  Plus,
  Trash2,
  Save,
  Info,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { format, startOfYear, endOfYear, isAfter, isBefore } from 'date-fns';

interface AnnualTaxHelperProps {
  selectedYear: number;
}

export default function AnnualTaxHelper({ selectedYear }: AnnualTaxHelperProps) {
  const { invoices } = useInvoices();
  const { expenses } = useExpenses();
  const { otherIncome } = useOtherIncome();
  const { assets, createAsset, deleteAsset, isCreating, getDepreciationForYear, getBookValueEndOfYear } = useBusinessAssets();
  const { taxData, upsertTaxData, isSaving, getTaxConstants } = useAnnualTaxData(selectedYear);

  const [hoursWorked, setHoursWorked] = useState(0);
  const [isStarter, setIsStarter] = useState(false);
  const [vehicleTotalKm, setVehicleTotalKm] = useState(0);
  const [vehicleBusinessKm, setVehicleBusinessKm] = useState(0);
  const [vehicleCosts, setVehicleCosts] = useState(0);
  const [vehiclePrivatePercentage, setVehiclePrivatePercentage] = useState(0);

  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null);
  const [newAsset, setNewAsset] = useState<BusinessAssetInsert>({
    name: '',
    purchase_date: format(new Date(), 'yyyy-MM-dd'),
    purchase_price: 0,
    residual_value: 0,
    useful_life_years: 5,
    category: 'overig',
  });
  const [assetPurchaseDate, setAssetPurchaseDate] = useState<Date>(new Date());

  // Load saved data
  useEffect(() => {
    if (taxData) {
      setHoursWorked(taxData.hours_worked || 0);
      setIsStarter(taxData.is_starter || false);
      setVehicleTotalKm(Number(taxData.vehicle_total_km) || 0);
      setVehicleBusinessKm(Number(taxData.vehicle_business_km) || 0);
      setVehicleCosts(Number(taxData.vehicle_costs) || 0);
      setVehiclePrivatePercentage(Number(taxData.vehicle_private_percentage) || 0);
    }
  }, [taxData]);

  const handleSaveSettings = () => {
    upsertTaxData({
      year: selectedYear,
      hours_worked: hoursWorked,
      is_starter: isStarter,
      vehicle_total_km: vehicleTotalKm,
      vehicle_business_km: vehicleBusinessKm,
      vehicle_costs: vehicleCosts,
      vehicle_private_percentage: vehiclePrivatePercentage,
    });
  };

  const handleAddAsset = () => {
    createAsset({
      ...newAsset,
      purchase_date: format(assetPurchaseDate, 'yyyy-MM-dd'),
    });
    setAddAssetOpen(false);
    setNewAsset({
      name: '',
      purchase_date: format(new Date(), 'yyyy-MM-dd'),
      purchase_price: 0,
      residual_value: 0,
      useful_life_years: 5,
      category: 'overig',
    });
    setAssetPurchaseDate(new Date());
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);

  // ---- Calculations ----
  const yearStart = startOfYear(new Date(selectedYear, 0, 1));
  const yearEnd = endOfYear(new Date(selectedYear, 0, 1));

  const paidInvoices = invoices.filter((inv) => {
    const date = new Date(inv.invoice_date);
    return inv.status === 'paid' && isAfter(date, yearStart) && isBefore(date, yearEnd);
  });

  const yearExpenses = expenses.filter((exp) => {
    if (exp.btw_period) {
      const [yearStr] = exp.btw_period.split('-Q');
      return parseInt(yearStr) === selectedYear;
    }
    const date = new Date(exp.expense_date);
    return isAfter(date, yearStart) && isBefore(date, yearEnd);
  });

  const yearOtherIncome = otherIncome.filter((income) => {
    const date = new Date(income.income_date);
    return isAfter(date, yearStart) && isBefore(date, yearEnd);
  });

  const invoiceRevenueExclBtw = paidInvoices.reduce((sum, inv) => sum + Number(inv.subtotal), 0);
  const otherIncomeRevenue = yearOtherIncome.reduce((sum, income) => sum + Number(income.amount), 0);
  const totalRevenueExclBtw = invoiceRevenueExclBtw + otherIncomeRevenue;
  const totalExpensesExclBtw = yearExpenses.reduce((sum, exp) => sum + Number(exp.amount_excl_btw || 0), 0);

  // Depreciation
  const totalDepreciation = assets.reduce((sum, asset) => sum + getDepreciationForYear(asset, selectedYear), 0);

  // Vehicle deduction
  const vehicleBusinessPercentage = vehicleTotalKm > 0 ? (vehicleBusinessKm / vehicleTotalKm) * 100 : 0;
  const vehicleDeduction = vehicleCosts * (vehicleBusinessPercentage / 100);

  // Profit
  const grossProfit = totalRevenueExclBtw - totalExpensesExclBtw - totalDepreciation;
  const profitAfterVehicle = grossProfit - vehicleDeduction;

  // Ondernemersaftrek
  const constants = getTaxConstants(selectedYear);
  const meetsHoursRequirement = hoursWorked >= 1225;
  const zelfstandigenaftrek = meetsHoursRequirement ? constants.zelfstandigenaftrek : 0;
  const startersaftrek = meetsHoursRequirement && isStarter ? constants.startersaftrek : 0;
  const totalOndernemersaftrek = zelfstandigenaftrek + startersaftrek;

  const profitAfterAftrek = Math.max(0, profitAfterVehicle - totalOndernemersaftrek);
  const mkbVrijstelling = profitAfterAftrek * (constants.mkbVrijstellingPercentage / 100);
  const taxableProfit = profitAfterAftrek - mkbVrijstelling;

  // Active assets for this year
  const activeAssets = assets.filter((asset) => {
    const purchaseYear = new Date(asset.purchase_date).getFullYear();
    const endYear = purchaseYear + asset.useful_life_years - 1;
    return purchaseYear <= selectedYear && endYear >= selectedYear;
  });

  return (
    <div className="space-y-6">
      {/* 1. Winst uit onderneming */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Winst uit onderneming
          </CardTitle>
          <CardDescription>
            Automatisch berekend op basis van je facturen en uitgaven in {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Omzet uit facturen (excl. BTW)</TableCell>
                <TableCell className="text-right text-success font-medium">
                  {formatCurrency(invoiceRevenueExclBtw)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Inkomsten zonder factuur</TableCell>
                <TableCell className="text-right text-success font-medium">
                  {formatCurrency(otherIncomeRevenue)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Bedrijfskosten (excl. BTW)</TableCell>
                <TableCell className="text-right text-destructive font-medium">
                  - {formatCurrency(totalExpensesExclBtw)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Afschrijvingen</TableCell>
                <TableCell className="text-right text-destructive font-medium">
                  - {formatCurrency(totalDepreciation)}
                </TableCell>
              </TableRow>
              {vehicleDeduction > 0 && (
                <TableRow>
                  <TableCell className="font-medium">Zakelijke autokosten</TableCell>
                  <TableCell className="text-right text-destructive font-medium">
                    - {formatCurrency(vehicleDeduction)}
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="border-t-2">
                <TableCell className="font-bold text-base">Bruto winst</TableCell>
                <TableCell className={`text-right font-bold text-base ${profitAfterVehicle >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(profitAfterVehicle)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground flex gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Gebaseerd op {paidInvoices.length} betaalde facturen, {yearOtherIncome.length} inkomsten zonder factuur en {yearExpenses.length} uitgaven in {selectedYear}.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Ondernemersaftrek */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Ondernemersaftrek & MKB-winstvrijstelling
          </CardTitle>
          <CardDescription>
            Vul je uren en starterstatus in om de aftrekposten te berekenen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hours_worked">Gewerkte uren in {selectedYear}</Label>
              <Input
                id="hours_worked"
                type="number"
                min="0"
                value={hoursWorked || ''}
                onChange={(e) => setHoursWorked(parseInt(e.target.value) || 0)}
                placeholder="Minimaal 1225 uur"
              />
              <p className="text-xs text-muted-foreground">
                {meetsHoursRequirement ? (
                  <span className="text-success flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Voldoet aan het urencriterium
                  </span>
                ) : (
                  `Nog ${1225 - hoursWorked} uur nodig voor het urencriterium`
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Startersaftrek</Label>
              <div className="flex items-center gap-3 pt-2">
                <Switch checked={isStarter} onCheckedChange={setIsStarter} />
                <span className="text-sm">
                  {isStarter ? 'Ja, ik ben starter' : 'Nee, geen starter'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Eerste 3 jaar als ondernemer? Dan heb je recht op startersaftrek.
              </p>
            </div>
          </div>

          <Button onClick={handleSaveSettings} disabled={isSaving} variant="outline" size="sm">
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Instellingen opslaan
          </Button>

          <Separator />

          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Bruto winst</TableCell>
                <TableCell className="text-right">{formatCurrency(profitAfterVehicle)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  Zelfstandigenaftrek
                  {!meetsHoursRequirement && (
                    <Badge variant="secondary" className="ml-2 text-xs">Niet van toepassing</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right text-destructive">
                  {zelfstandigenaftrek > 0 ? `- ${formatCurrency(zelfstandigenaftrek)}` : formatCurrency(0)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  Startersaftrek
                  {(!meetsHoursRequirement || !isStarter) && (
                    <Badge variant="secondary" className="ml-2 text-xs">Niet van toepassing</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right text-destructive">
                  {startersaftrek > 0 ? `- ${formatCurrency(startersaftrek)}` : formatCurrency(0)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  MKB-winstvrijstelling ({constants.mkbVrijstellingPercentage}%)
                </TableCell>
                <TableCell className="text-right text-destructive">
                  - {formatCurrency(mkbVrijstelling)}
                </TableCell>
              </TableRow>
              <TableRow className="border-t-2">
                <TableCell className="font-bold text-base">Belastbare winst</TableCell>
                <TableCell className={`text-right font-bold text-base ${taxableProfit >= 0 ? '' : 'text-success'}`}>
                  {formatCurrency(taxableProfit)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-muted-foreground flex gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <span>
              De belastbare winst is het bedrag dat je opgeeft bij "Winst uit onderneming" in je aangifte inkomstenbelasting.
              De zelfstandigenaftrek voor {selectedYear} is {formatCurrency(constants.zelfstandigenaftrek)}.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Afschrijvingen */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Afschrijvingen
              </CardTitle>
              <CardDescription>
                Bedrijfsmiddelen en hun afschrijving in {selectedYear}
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setAddAssetOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Toevoegen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeAssets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Geen actieve bedrijfsmiddelen in {selectedYear}</p>
              <p className="text-sm">Voeg een bedrijfsmiddel toe om afschrijvingen te berekenen</p>
            </div>
          ) : (
            <>
              {/* Mobile view */}
              <div className="block md:hidden space-y-3">
                {activeAssets.map((asset) => {
                  const depreciation = getDepreciationForYear(asset, selectedYear);
                  const bookValue = getBookValueEndOfYear(asset, selectedYear);
                  return (
                    <div key={asset.id} className="p-4 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{asset.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {ASSET_CATEGORIES.find(c => c.value === asset.category)?.label} · {asset.useful_life_years} jaar
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteAssetId(asset.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs">Aanschaf</span>
                          <p className="font-medium">{formatCurrency(Number(asset.purchase_price))}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Afschrijving</span>
                          <p className="font-medium text-destructive">{formatCurrency(depreciation)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Boekwaarde</span>
                          <p className="font-medium">{formatCurrency(bookValue)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bedrijfsmiddel</TableHead>
                      <TableHead>Categorie</TableHead>
                      <TableHead className="text-right">Aanschafprijs</TableHead>
                      <TableHead className="text-right">Restwaarde</TableHead>
                      <TableHead className="text-center">Looptijd</TableHead>
                      <TableHead className="text-right">Afschrijving {selectedYear}</TableHead>
                      <TableHead className="text-right">Boekwaarde</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeAssets.map((asset) => {
                      const depreciation = getDepreciationForYear(asset, selectedYear);
                      const bookValue = getBookValueEndOfYear(asset, selectedYear);
                      return (
                        <TableRow key={asset.id}>
                          <TableCell className="font-medium">{asset.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {ASSET_CATEGORIES.find(c => c.value === asset.category)?.label}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(asset.purchase_price))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(asset.residual_value))}</TableCell>
                          <TableCell className="text-center">{asset.useful_life_years} jr</TableCell>
                          <TableCell className="text-right text-destructive font-medium">{formatCurrency(depreciation)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(bookValue)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteAssetId(asset.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="border-t-2 font-bold">
                      <TableCell colSpan={5}>Totaal afschrijvingen {selectedYear}</TableCell>
                      <TableCell className="text-right text-destructive">{formatCurrency(totalDepreciation)}</TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Add Asset Dialog */}
          <Dialog open={addAssetOpen} onOpenChange={setAddAssetOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bedrijfsmiddel toevoegen</DialogTitle>
                <DialogDescription>
                  Voeg een nieuw bedrijfsmiddel toe voor afschrijving
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Naam *</Label>
                  <Input
                    value={newAsset.name}
                    onChange={(e) => setNewAsset(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Bijv. MacBook Pro"
                  />
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label>Aankoopdatum</Label>
                    <DatePicker
                      value={assetPurchaseDate}
                      onChange={(date) => date && setAssetPurchaseDate(date)}
                      showClearButton={false}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categorie</Label>
                    <Select
                      value={newAsset.category}
                      onValueChange={(value) => setNewAsset(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSET_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 grid-cols-3">
                  <div className="space-y-2">
                    <Label>Aanschafprijs (€) *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newAsset.purchase_price || ''}
                      onChange={(e) => setNewAsset(prev => ({ ...prev, purchase_price: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Restwaarde (€)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newAsset.residual_value || ''}
                      onChange={(e) => setNewAsset(prev => ({ ...prev, residual_value: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Afschrijving (jaren)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={newAsset.useful_life_years || ''}
                      onChange={(e) => setNewAsset(prev => ({ ...prev, useful_life_years: parseInt(e.target.value) || 5 }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setAddAssetOpen(false)}>Annuleren</Button>
                  <Button onClick={handleAddAsset} disabled={isCreating || !newAsset.name || !newAsset.purchase_price}>
                    {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Toevoegen
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete confirmation */}
          <AlertDialog open={!!deleteAssetId} onOpenChange={(open) => !open && setDeleteAssetId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bedrijfsmiddel verwijderen</AlertDialogTitle>
                <AlertDialogDescription>
                  Weet je zeker dat je dit bedrijfsmiddel wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { if (deleteAssetId) { deleteAsset(deleteAssetId); setDeleteAssetId(null); } }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Verwijderen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* 4. Autokosten */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Autokosten / privégebruik
          </CardTitle>
          <CardDescription>
            Bereken het zakelijke deel van je autokosten
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Totaal km in {selectedYear}</Label>
              <Input
                type="number"
                min="0"
                value={vehicleTotalKm || ''}
                onChange={(e) => setVehicleTotalKm(parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Zakelijke km</Label>
              <Input
                type="number"
                min="0"
                value={vehicleBusinessKm || ''}
                onChange={(e) => setVehicleBusinessKm(parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Totale autokosten (€)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={vehicleCosts || ''}
                onChange={(e) => setVehicleCosts(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Brandstof, verzekering, onderhoud, wegenbelasting, etc.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Privégebruik (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={vehiclePrivatePercentage || ''}
                onChange={(e) => setVehiclePrivatePercentage(parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>

          <Button onClick={handleSaveSettings} disabled={isSaving} variant="outline" size="sm">
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Opslaan
          </Button>

          {vehicleTotalKm > 0 && (
            <>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Zakelijk percentage</p>
                  <p className="text-xl font-bold">{vehicleBusinessPercentage.toFixed(1)}%</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Aftrekbare autokosten</p>
                  <p className="text-xl font-bold text-success">{formatCurrency(vehicleDeduction)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Privé km</p>
                  <p className="text-xl font-bold">{(vehicleTotalKm - vehicleBusinessKm).toLocaleString('nl-NL')} km</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Samenvatting jaaraangifte {selectedYear}
          </CardTitle>
          <CardDescription>
            Gebruik deze bedragen voor je aangifte inkomstenbelasting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Omzet (excl. BTW)</TableCell>
                <TableCell className="text-right">{formatCurrency(totalRevenueExclBtw)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Bedrijfskosten (excl. BTW)</TableCell>
                <TableCell className="text-right">- {formatCurrency(totalExpensesExclBtw)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Afschrijvingen</TableCell>
                <TableCell className="text-right">- {formatCurrency(totalDepreciation)}</TableCell>
              </TableRow>
              {vehicleDeduction > 0 && (
                <TableRow>
                  <TableCell className="font-medium">Zakelijke autokosten</TableCell>
                  <TableCell className="text-right">- {formatCurrency(vehicleDeduction)}</TableCell>
                </TableRow>
              )}
              <TableRow className="border-t">
                <TableCell className="font-bold">Bruto winst</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(profitAfterVehicle)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Zelfstandigenaftrek</TableCell>
                <TableCell className="text-right">- {formatCurrency(zelfstandigenaftrek)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Startersaftrek</TableCell>
                <TableCell className="text-right">- {formatCurrency(startersaftrek)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">MKB-winstvrijstelling ({constants.mkbVrijstellingPercentage}%)</TableCell>
                <TableCell className="text-right">- {formatCurrency(mkbVrijstelling)}</TableCell>
              </TableRow>
              <TableRow className="border-t-2">
                <TableCell className="font-bold text-lg">Belastbare winst uit onderneming</TableCell>
                <TableCell className={`text-right font-bold text-lg ${taxableProfit >= 0 ? '' : 'text-success'}`}>
                  {formatCurrency(taxableProfit)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
