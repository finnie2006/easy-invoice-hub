import { useState } from 'react';
import { useExpenses, ExpenseInsert, EXPENSE_CATEGORIES } from '@/hooks/useExpenses';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Receipt, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

export default function Expenses() {
  const { expenses, isLoading, createExpense, deleteExpense, isCreating } = useExpenses();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<ExpenseInsert>>({
    vendor_name: '',
    description: '',
    category: 'overig',
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    amount_incl_btw: 0,
    btw_percentage: 21,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'number' ? parseFloat(value) || 0 : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountInclBtw = formData.amount_incl_btw || 0;
    const btwPercentage = formData.btw_percentage || 21;
    const amountExclBtw = amountInclBtw / (1 + btwPercentage / 100);
    const btwAmount = amountInclBtw - amountExclBtw;

    await createExpense({
      vendor_name: formData.vendor_name || '',
      description: formData.description || null,
      category: formData.category || 'overig',
      expense_date: formData.expense_date || format(new Date(), 'yyyy-MM-dd'),
      amount_incl_btw: amountInclBtw,
      amount_excl_btw: amountExclBtw,
      btw_amount: btwAmount,
      btw_percentage: btwPercentage,
      receipt_url: null,
      notes: null,
    });
    
    setDialogOpen(false);
    setFormData({
      vendor_name: '',
      description: '',
      category: 'overig',
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      amount_incl_btw: 0,
      btw_percentage: 21,
    });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Uitgaven</h1>
          <p className="text-muted-foreground">
            Houd je zakelijke uitgaven bij
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe uitgave
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nieuwe uitgave</DialogTitle>
              <DialogDescription>
                Voeg een nieuwe zakelijke uitgave toe
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
                  <Input
                    id="expense_date"
                    name="expense_date"
                    type="date"
                    value={formData.expense_date}
                    onChange={handleChange}
                    required
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

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="amount_incl_btw">Bedrag incl. BTW (€) *</Label>
                  <Input
                    id="amount_incl_btw"
                    name="amount_incl_btw"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount_incl_btw || ''}
                    onChange={handleChange}
                    required
                  />
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
      <div className="grid gap-4 md:grid-cols-2">
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Uitgavenoverzicht
          </CardTitle>
          <CardDescription>
            {expenses.length} uitgave{expenses.length !== 1 ? 'n' : ''} geregistreerd
          </CardDescription>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nog geen uitgaven</p>
              <p className="text-sm">Voeg je eerste uitgave toe</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Leverancier</TableHead>
                  <TableHead>Omschrijving</TableHead>
                  <TableHead>Categorie</TableHead>
                  <TableHead className="text-right">Bedrag</TableHead>
                  <TableHead className="text-right">BTW</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      {format(new Date(expense.expense_date), 'd MMM yyyy', { locale: nl })}
                    </TableCell>
                    <TableCell className="font-medium">{expense.vendor_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {expense.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(expense.category)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(expense.amount_incl_btw))}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(Number(expense.btw_amount || 0))}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteExpense(expense.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
