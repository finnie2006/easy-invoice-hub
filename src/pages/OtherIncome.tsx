import { useMemo, useState } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Plus, Banknote, Pencil, Trash2, Search, X, Loader2, Info } from 'lucide-react';
import { useOtherIncome, OtherIncome, OtherIncomeInsert, OTHER_INCOME_CATEGORIES } from '@/hooks/useOtherIncome';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DatePicker } from '@/components/ui/date-picker';

export default function OtherIncomePage() {
  const {
    otherIncome,
    isLoading,
    createIncome,
    updateIncome,
    deleteIncome,
    isCreating,
    isUpdating,
  } = useOtherIncome();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<OtherIncome | null>(null);
  const [deleteConfirmIncome, setDeleteConfirmIncome] = useState<OtherIncome | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [incomeDate, setIncomeDate] = useState<Date>(new Date());
  const [formData, setFormData] = useState<OtherIncomeInsert>({
    source_name: '',
    description: '',
    category: 'contant',
    income_date: format(new Date(), 'yyyy-MM-dd'),
    amount: 0,
    notes: null,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getCategoryLabel = (value: string) => {
    return OTHER_INCOME_CATEGORIES.find((category) => category.value === value)?.label || value;
  };

  const resetForm = () => {
    setEditingIncome(null);
    setIncomeDate(new Date());
    setFormData({
      source_name: '',
      description: '',
      category: 'contant',
      income_date: format(new Date(), 'yyyy-MM-dd'),
      amount: 0,
      notes: null,
    });
  };

  const handleEdit = (income: OtherIncome) => {
    setEditingIncome(income);
    setIncomeDate(new Date(income.income_date));
    setFormData({
      source_name: income.source_name,
      description: income.description || '',
      category: income.category,
      income_date: income.income_date,
      amount: Number(income.amount),
      notes: income.notes,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      ...formData,
      description: formData.description || null,
      income_date: format(incomeDate, 'yyyy-MM-dd'),
      amount: Number(formData.amount) || 0,
      notes: formData.notes || null,
    };

    if (editingIncome) {
      await updateIncome({ id: editingIncome.id, updates: payload });
    } else {
      await createIncome(payload);
    }

    setDialogOpen(false);
    resetForm();
  };

  const filteredIncome = useMemo(() => {
    return otherIncome.filter((income) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        income.source_name.toLowerCase().includes(searchLower) ||
        (income.description?.toLowerCase().includes(searchLower) ?? false);

      const matchesCategory = categoryFilter === 'all' || income.category === categoryFilter;

      let matchesDate = true;
      if (dateFilter !== 'all') {
        const date = parseISO(income.income_date);
        const now = new Date();

        if (dateFilter === 'this_month') {
          matchesDate = date >= startOfMonth(now) && date <= endOfMonth(now);
        } else if (dateFilter === 'this_year') {
          matchesDate = date >= startOfYear(now) && date <= endOfYear(now);
        }
      }

      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [categoryFilter, dateFilter, otherIncome, searchQuery]);

  const totalIncome = otherIncome.reduce((sum, income) => sum + Number(income.amount), 0);
  const filteredTotal = filteredIncome.reduce((sum, income) => sum + Number(income.amount), 0);

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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Inkomsten</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Leg inkomsten zonder factuur vast voor je overzicht
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe inkomst
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingIncome ? 'Inkomst bewerken' : 'Nieuwe inkomst'}</DialogTitle>
              <DialogDescription>
                Voor betalingen zonder factuur, zoals contante klussen.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="source_name">Bron / opdrachtgever *</Label>
                <Input
                  id="source_name"
                  value={formData.source_name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, source_name: event.target.value }))}
                  placeholder="Bijv. contante klus"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Omschrijving</Label>
                <Input
                  id="description"
                  value={formData.description || ''}
                  onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Wat heb je gedaan?"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="income_date">Datum</Label>
                  <DatePicker
                    id="income_date"
                    value={incomeDate}
                    onChange={(date) => date && setIncomeDate(date)}
                    showClearButton={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categorie</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OTHER_INCOME_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Bedrag *</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount || ''}
                  onChange={(event) => setFormData((prev) => ({ ...prev, amount: parseFloat(event.target.value) || 0 }))}
                  required
                />
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Deze inkomst telt mee in dashboard, rapporten en winstoverzicht, maar wordt niet meegenomen in de btw-aangifte.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuleren
                </Button>
                <Button type="submit" disabled={isCreating || isUpdating}>
                  {(isCreating || isUpdating) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Opslaan
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Totaal overige inkomsten</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCurrency(totalIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gefilterd totaal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(filteredTotal)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Inkomstenoverzicht
          </CardTitle>
          <CardDescription>
            {filteredIncome.length} van {otherIncome.length} inkomsten
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek op bron of omschrijving..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle categorieen</SelectItem>
                {OTHER_INCOME_CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle periodes</SelectItem>
                <SelectItem value="this_month">Deze maand</SelectItem>
                <SelectItem value="this_year">Dit jaar</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || categoryFilter !== 'all' || dateFilter !== 'all') && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setDateFilter('all');
                }}
                title="Filters wissen"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {otherIncome.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Banknote className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nog geen inkomsten zonder factuur</p>
              <p className="text-sm">Voeg bijvoorbeeld een contante klus toe</p>
            </div>
          ) : filteredIncome.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Geen resultaten gevonden</p>
              <p className="text-sm">Pas je filters aan om inkomsten te zien</p>
            </div>
          ) : (
            <>
              <div className="block md:hidden space-y-3">
                {filteredIncome.map((income) => (
                  <div key={income.id} className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{income.source_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(income.income_date), 'd MMM yyyy', { locale: nl })}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(income)} title="Bewerken">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmIncome(income)}
                          title="Verwijderen"
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {income.description && (
                      <p className="text-sm text-muted-foreground">{income.description}</p>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline" className="min-w-0 max-w-[65%] truncate">
                        {getCategoryLabel(income.category)}
                      </Badge>
                      <span className="shrink-0 font-medium text-success">
                        {formatCurrency(Number(income.amount))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Bron</TableHead>
                      <TableHead>Omschrijving</TableHead>
                      <TableHead>Categorie</TableHead>
                      <TableHead className="text-right">Bedrag</TableHead>
                      <TableHead className="w-[96px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIncome.map((income) => (
                      <TableRow key={income.id}>
                        <TableCell>{format(new Date(income.income_date), 'd MMM yyyy', { locale: nl })}</TableCell>
                        <TableCell className="font-medium">{income.source_name}</TableCell>
                        <TableCell className="text-muted-foreground">{income.description || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getCategoryLabel(income.category)}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-success">
                          {formatCurrency(Number(income.amount))}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(income)} title="Bewerken">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirmIncome(income)}
                              title="Verwijderen"
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteConfirmIncome} onOpenChange={(open) => !open && setDeleteConfirmIncome(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inkomst verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmIncome) {
                  deleteIncome(deleteConfirmIncome.id);
                  setDeleteConfirmIncome(null);
                }
              }}
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
