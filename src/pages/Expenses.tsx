import { useState, useRef, useMemo, useEffect } from 'react';
import { useExpenses, Expense, ExpenseInsert, EXPENSE_CATEGORIES } from '@/hooks/useExpenses';
import { useBtwPeriods } from '@/hooks/useBtwPeriods';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Plus, Receipt, Trash2, FileText, Upload, Eye, Download, X, Search, AlertTriangle, Pencil } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { nl } from 'date-fns/locale';
export default function Expenses() {
  const { expenses, isLoading, createExpense, deleteExpense, isCreating, getSignedReceiptUrl } = useExpenses();
  const { isPeriodClosed, getBtwPeriodForDate, getNextAvailablePeriod } = useBtwPeriods();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);
  const [viewReceiptOpen, setViewReceiptOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteConfirmExpense, setDeleteConfirmExpense] = useState<Expense | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  
  // Form state
  const [amountInputMode, setAmountInputMode] = useState<'incl' | 'excl'>('incl');
  const [amountInput, setAmountInput] = useState<string>('');
  
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());
  const [selectedBtwPeriod, setSelectedBtwPeriod] = useState<string>('');
  const [periodWarning, setPeriodWarning] = useState<{ isClosedPeriod: boolean; suggestedPeriod: string } | null>(null);
  
  const [formData, setFormData] = useState<Partial<ExpenseInsert>>({
    vendor_name: '',
    description: '',
    category: 'overig',
    amount_incl_btw: 0,
    btw_percentage: 21,
  });

  // Check if selected date falls in a closed BTW period
  useEffect(() => {
    const period = getBtwPeriodForDate(expenseDate);
    const [yearStr, quarterStr] = period.split('-Q');
    const year = parseInt(yearStr);
    const quarter = parseInt(quarterStr);
    
    if (isPeriodClosed(year, quarter)) {
      const nextAvailable = getNextAvailablePeriod(expenseDate);
      setPeriodWarning({
        isClosedPeriod: true,
        suggestedPeriod: nextAvailable.period,
      });
      setSelectedBtwPeriod(nextAvailable.period);
    } else {
      setPeriodWarning(null);
      setSelectedBtwPeriod(period);
    }
  }, [expenseDate, isPeriodClosed, getBtwPeriodForDate, getNextAvailablePeriod]);

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        expense.vendor_name.toLowerCase().includes(searchLower) ||
        (expense.description?.toLowerCase().includes(searchLower));
      
      // Category filter
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
      
      // Date filter
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const expenseDate = parseISO(expense.expense_date);
        const now = new Date();
        
        if (dateFilter === 'this_month') {
          matchesDate = expenseDate >= startOfMonth(now) && expenseDate <= endOfMonth(now);
        } else if (dateFilter === 'last_month') {
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          matchesDate = expenseDate >= startOfMonth(lastMonth) && expenseDate <= endOfMonth(lastMonth);
        } else if (dateFilter === 'this_year') {
          matchesDate = expenseDate >= startOfYear(now) && expenseDate <= endOfYear(now);
        }
      }
      
      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [expenses, searchQuery, categoryFilter, dateFilter]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'number' ? parseFloat(value) || 0 : value 
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Calculate amounts based on input mode
  const calculateAmounts = () => {
    const inputAmount = parseFloat(amountInput) || 0;
    const btwPercentage = formData.btw_percentage || 21;
    
    let amountInclBtw: number;
    let amountExclBtw: number;
    let btwAmount: number;
    
    if (amountInputMode === 'incl') {
      amountInclBtw = inputAmount;
      amountExclBtw = inputAmount / (1 + btwPercentage / 100);
      btwAmount = amountInclBtw - amountExclBtw;
    } else {
      amountExclBtw = inputAmount;
      btwAmount = amountExclBtw * (btwPercentage / 100);
      amountInclBtw = amountExclBtw + btwAmount;
    }
    
    return { amountInclBtw, amountExclBtw, btwAmount };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { amountInclBtw, amountExclBtw, btwAmount } = calculateAmounts();

    await createExpense({
      expense: {
        vendor_name: formData.vendor_name || '',
        description: formData.description || null,
        category: formData.category || 'overig',
        expense_date: format(expenseDate, 'yyyy-MM-dd'),
        amount_incl_btw: amountInclBtw,
        amount_excl_btw: amountExclBtw,
        btw_amount: btwAmount,
        btw_percentage: formData.btw_percentage || 21,
        btw_period: selectedBtwPeriod || null,
        receipt_url: null,
        notes: null,
      },
      file: selectedFile || undefined,
    });
    
    setDialogOpen(false);
    setSelectedFile(null);
    setAmountInput('');
    setAmountInputMode('incl');
    setExpenseDate(new Date());
    setPeriodWarning(null);
    setSelectedBtwPeriod('');
    setFormData({
      vendor_name: '',
      description: '',
      category: 'overig',
      amount_incl_btw: 0,
      btw_percentage: 21,
    });
  };

  const handleViewReceipt = async (receiptPath: string) => {
    const signedUrl = await getSignedReceiptUrl(receiptPath);
    if (signedUrl) {
      setViewReceiptUrl(signedUrl);
      setViewReceiptOpen(true);
    }
  };

  const handleDownloadReceipt = async (receiptPath: string, vendorName: string) => {
    const signedUrl = await getSignedReceiptUrl(receiptPath);
    if (signedUrl) {
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = `bon-${vendorName}-${Date.now()}.${receiptPath.split('.').pop()}`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getCategoryLabel = (value: string) => {
    return EXPENSE_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount_incl_btw), 0);
  const totalBtw = expenses.reduce((sum, exp) => sum + Number(exp.btw_amount || 0), 0);
  const expensesWithReceipts = expenses.filter(exp => exp.receipt_url).length;

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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Uitgaven</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Houd je zakelijke uitgaven en bonnen bij
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedFile(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe uitgave
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nieuwe uitgave</DialogTitle>
              <DialogDescription>
                Voeg een nieuwe zakelijke uitgave toe met bijbehorende bon
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="vendor_name">Leverancier *</Label>
                <Input
                  id="vendor_name"
                  name="vendor_name"
                  value={formData.vendor_name}
                  onChange={handleChange}
                  placeholder="Bijv. Bol.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Omschrijving</Label>
                <Input
                  id="description"
                  name="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  placeholder="Wat heb je gekocht?"
                />
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expense_date">Datum</Label>
                  <DatePicker
                    id="expense_date"
                    value={expenseDate}
                    onChange={(date) => date && setExpenseDate(date)}
                    showClearButton={false}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categorie</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* BTW Period Warning */}
              {periodWarning?.isClosedPeriod && (
                <Alert className="border-warning bg-warning/10">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <AlertDescription className="text-foreground">
                    <strong>Let op:</strong> De gekozen datum valt in een afgesloten BTW-kwartaal ({getBtwPeriodForDate(expenseDate)}). 
                    De uitgave wordt automatisch geboekt in <strong>{periodWarning.suggestedPeriod}</strong>.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="amount">
                      Bedrag {amountInputMode === 'incl' ? 'incl.' : 'excl.'} BTW (€) *
                    </Label>
                    <button
                      type="button"
                      onClick={() => setAmountInputMode(prev => prev === 'incl' ? 'excl' : 'incl')}
                      className="text-xs text-primary hover:underline"
                    >
                      Wissel naar {amountInputMode === 'incl' ? 'excl.' : 'incl.'} BTW
                    </button>
                  </div>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="0,00"
                    required
                  />
                  {amountInput && (
                    <p className="text-xs text-muted-foreground">
                      {amountInputMode === 'incl' 
                        ? `Excl. BTW: ${formatCurrency(calculateAmounts().amountExclBtw)}`
                        : `Incl. BTW: ${formatCurrency(calculateAmounts().amountInclBtw)}`
                      }
                      {' · '}BTW: {formatCurrency(calculateAmounts().btwAmount)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="btw_percentage">BTW-tarief</Label>
                  <Select 
                    value={formData.btw_percentage?.toString()} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, btw_percentage: parseInt(value) }))}
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
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Bon/Factuur uploaden</Label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer hover:border-primary/50 ${
                    selectedFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
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
                        Klik om een bon of factuur te uploaden
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF of afbeelding (max 10MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuleren
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Toevoegen
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Totale uitgaven</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(totalExpenses)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Te vorderen BTW</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(totalBtw)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Bonnen geüpload</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {expensesWithReceipts} / {expenses.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Uitgavenoverzicht
          </CardTitle>
          <CardDescription>
            {filteredExpenses.length} van {expenses.length} uitgave{expenses.length !== 1 ? 'n' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek op leverancier of omschrijving..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Categorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle categorieën</SelectItem>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle periodes</SelectItem>
                <SelectItem value="this_month">Deze maand</SelectItem>
                <SelectItem value="last_month">Vorige maand</SelectItem>
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

          {expenses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nog geen uitgaven</p>
              <p className="text-sm">Voeg je eerste uitgave toe met bijbehorende bon</p>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Geen resultaten gevonden</p>
              <p className="text-sm">Pas je filters aan om uitgaven te zien</p>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="block md:hidden space-y-3">
                {filteredExpenses.map((expense) => (
                  <div key={expense.id} className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{expense.vendor_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(expense.expense_date), 'd MMM yyyy', { locale: nl })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {expense.receipt_url && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewReceipt(expense.receipt_url!)}
                              title="Bekijk bon"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmExpense(expense)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {expense.description && (
                      <p className="text-sm text-muted-foreground">{expense.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{getCategoryLabel(expense.category)}</Badge>
                      <div className="text-right">
                        <div className="font-bold">{formatCurrency(Number(expense.amount_incl_btw))}</div>
                        <div className="text-xs text-muted-foreground">
                          BTW: {formatCurrency(Number(expense.btw_amount || 0))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Leverancier</TableHead>
                      <TableHead>Omschrijving</TableHead>
                      <TableHead>Categorie</TableHead>
                      <TableHead className="text-right">Bedrag</TableHead>
                      <TableHead className="text-center">Bon</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>
                          {format(new Date(expense.expense_date), 'd MMM yyyy', { locale: nl })}
                        </TableCell>
                        <TableCell className="font-medium">{expense.vendor_name}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {expense.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getCategoryLabel(expense.category)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>{formatCurrency(Number(expense.amount_incl_btw))}</div>
                          <div className="text-xs text-muted-foreground">
                            BTW: {formatCurrency(Number(expense.btw_amount || 0))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {expense.receipt_url ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewReceipt(expense.receipt_url!)}
                                title="Bekijk bon"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownloadReceipt(expense.receipt_url!, expense.vendor_name)}
                                title="Download bon"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirmExpense(expense)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Receipt Viewer Dialog */}
      <Dialog open={viewReceiptOpen} onOpenChange={setViewReceiptOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Bon bekijken</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4 bg-muted rounded-lg max-h-[70vh] overflow-auto">
            {viewReceiptUrl && (
              viewReceiptUrl.includes('.pdf') ? (
                <iframe
                  src={viewReceiptUrl}
                  className="w-full h-[60vh]"
                  title="Bon PDF"
                />
              ) : (
                <img
                  src={viewReceiptUrl}
                  alt="Bon"
                  className="max-w-full max-h-[60vh] object-contain"
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmExpense} onOpenChange={(open) => !open && setDeleteConfirmExpense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uitgave verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je de uitgave van <strong>{deleteConfirmExpense?.vendor_name}</strong> wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmExpense) {
                  deleteExpense(deleteConfirmExpense.id);
                  setDeleteConfirmExpense(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
