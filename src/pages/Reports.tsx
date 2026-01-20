import { useState, useMemo } from "react";
import { useInvoices } from "@/hooks/useInvoices";
import { useExpenses, EXPENSE_CATEGORIES } from "@/hooks/useExpenses";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, TrendingUp, TrendingDown, FileText, AlertCircle } from "lucide-react";
import {
  startOfYear,
  endOfYear,
  startOfQuarter,
  endOfQuarter,
  isAfter,
  isBefore,
  format,
  differenceInDays,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { nl } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type Period = "year" | "q1" | "q2" | "q3" | "q4";

export default function Reports() {
  const { invoices, isLoading: loadingInvoices } = useInvoices();
  const { expenses, isLoading: loadingExpenses } = useExpenses();
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [period, setPeriod] = useState<Period>("year");

  const selectedYear = parseInt(year);

  // Calculate date range based on period
  const getDateRange = () => {
    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(new Date(selectedYear, 0, 1));

    if (period === "year") {
      return { start: yearStart, end: yearEnd };
    }

    const quarterIndex = parseInt(period.slice(1)) - 1;
    const quarterStart = startOfQuarter(new Date(selectedYear, quarterIndex * 3, 1));
    const quarterEnd = endOfQuarter(new Date(selectedYear, quarterIndex * 3, 1));

    return { start: quarterStart, end: quarterEnd };
  };

  const { start, end } = getDateRange();

  // Filter data by period
  const periodInvoices = invoices.filter((inv) => {
    const date = new Date(inv.invoice_date);
    return isAfter(date, start) && isBefore(date, end);
  });

  // Filter expenses by btw_period if available, otherwise by expense_date
  const periodExpenses = expenses.filter((exp) => {
    // If expense has a btw_period assigned, use that for filtering
    if (exp.btw_period) {
      const [yearStr, quarterStr] = exp.btw_period.split('-Q');
      const expYear = parseInt(yearStr);
      const expQuarter = parseInt(quarterStr);
      
      if (period === 'year') {
        return expYear === selectedYear;
      } else {
        const selectedQuarter = parseInt(period.slice(1));
        return expYear === selectedYear && expQuarter === selectedQuarter;
      }
    }
    
    // Fallback to expense_date for expenses without btw_period
    const date = new Date(exp.expense_date);
    return isAfter(date, start) && isBefore(date, end);
  });

  // Calculate invoice stats
  const paidInvoices = periodInvoices.filter((inv) => inv.status === "paid");
  const unpaidInvoices = periodInvoices.filter((inv) => inv.status !== "paid" && inv.status !== "draft");
  const totalRevenue = paidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
  const totalRevenueExclBtw = paidInvoices.reduce((sum, inv) => sum + Number(inv.subtotal), 0);
  const totalRevenueVat = paidInvoices.reduce((sum, inv) => sum + Number(inv.total_btw), 0);
  const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);

  // Calculate expense stats
  const totalExpenses = periodExpenses.reduce((sum, exp) => sum + Number(exp.amount_incl_btw), 0);
  const totalExpensesExclBtw = periodExpenses.reduce((sum, exp) => sum + Number(exp.amount_excl_btw || 0), 0);
  const totalExpensesVat = periodExpenses.reduce((sum, exp) => sum + Number(exp.btw_amount || 0), 0);

  // Calculate expenses by category
  const expensesByCategory = EXPENSE_CATEGORIES.map((cat) => {
    const categoryExpenses = periodExpenses.filter((exp) => exp.category === cat.value);
    const total = categoryExpenses.reduce((sum, exp) => sum + Number(exp.amount_incl_btw), 0);
    return { ...cat, total, count: categoryExpenses.length };
  }).filter((cat) => cat.total > 0);

  // Profit/Loss
  const profit = totalRevenueExclBtw - totalExpensesExclBtw;
  const vatToPay = totalRevenueVat - totalExpensesVat;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  // Monthly revenue data for chart
  const monthlyRevenueData = useMemo(() => {
    const months =
      period === "year"
        ? Array.from({ length: 12 }, (_, i) => i)
        : Array.from({ length: 3 }, (_, i) => (parseInt(period.slice(1)) - 1) * 3 + i);

    return months.map((monthIndex) => {
      const monthStart = startOfMonth(new Date(selectedYear, monthIndex, 1));
      const monthEnd = endOfMonth(new Date(selectedYear, monthIndex, 1));

      const monthInvoices = paidInvoices.filter((inv) => {
        const date = new Date(inv.invoice_date);
        return isAfter(date, monthStart) && isBefore(date, monthEnd);
      });

      const monthExpenses = periodExpenses.filter((exp) => {
        const date = new Date(exp.expense_date);
        return isAfter(date, monthStart) && isBefore(date, monthEnd);
      });

      const revenue = monthInvoices.reduce((sum, inv) => sum + Number(inv.subtotal), 0);
      const expenses = monthExpenses.reduce((sum, exp) => sum + Number(exp.amount_excl_btw || 0), 0);

      return {
        month: format(monthStart, "MMM", { locale: nl }),
        omzet: revenue,
        kosten: expenses,
      };
    });
  }, [paidInvoices, periodExpenses, selectedYear, period]);

  const isLoading = loadingInvoices || loadingExpenses;

  // Available years
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Rapporten</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Financieel overzicht voor de belastingaangifte</p>
        </div>
        <div className="flex gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px] sm:w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[120px] sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="year">Alles</SelectItem>
              <SelectItem value="q1">Q1 (jan-mrt)</SelectItem>
              <SelectItem value="q2">Q2 (apr-jun)</SelectItem>
              <SelectItem value="q3">Q3 (jul-sep)</SelectItem>
              <SelectItem value="q4">Q4 (okt-dec)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Omzet (excl. BTW)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCurrency(totalRevenueExclBtw)}</div>
            <p className="text-xs text-muted-foreground mt-1">{paidInvoices.length} betaalde facturen</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Kosten (excl. BTW)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalExpensesExclBtw)}</div>
            <p className="text-xs text-muted-foreground mt-1">{periodExpenses.length} uitgaven</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Winst / Verlies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profit >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(profit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Omzet min kosten</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">BTW af te dragen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${vatToPay >= 0 ? "text-warning" : "text-success"}`}>
              {formatCurrency(vatToPay)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{vatToPay >= 0 ? "Te betalen" : "Terug te vorderen"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Omzet & Kosten per maand
          </CardTitle>
          <CardDescription>Maandelijks overzicht (excl. BTW)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  className="text-xs fill-muted-foreground"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  className="text-xs fill-muted-foreground"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend />
                <Bar dataKey="omzet" name="Omzet" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="kosten" name="Kosten" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* BTW Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              BTW Overzicht
            </CardTitle>
            <CardDescription>Voor de BTW-aangifte</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Omzet excl. BTW</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalRevenueExclBtw)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">BTW over omzet</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalRevenueVat)}</TableCell>
                </TableRow>
                <TableRow className="border-t">
                  <TableCell className="font-medium">Kosten excl. BTW</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalExpensesExclBtw)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Voorbelasting (BTW kosten)</TableCell>
                  <TableCell className="text-right text-success">{formatCurrency(totalExpensesVat)}</TableCell>
                </TableRow>
                <TableRow className="border-t-2 font-bold">
                  <TableCell>Per saldo te betalen</TableCell>
                  <TableCell className={`text-right ${vatToPay >= 0 ? "" : "text-success"}`}>
                    {formatCurrency(vatToPay)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Kosten per categorie
            </CardTitle>
            <CardDescription>Overzicht van je uitgaven</CardDescription>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Geen uitgaven in deze periode</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categorie</TableHead>
                    <TableHead className="text-right">Aantal</TableHead>
                    <TableHead className="text-right">Totaal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensesByCategory.map((cat) => (
                    <TableRow key={cat.value}>
                      <TableCell className="font-medium">{cat.label}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{cat.count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(cat.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-bold">
                    <TableCell>Totaal</TableCell>
                    <TableCell className="text-right">{periodExpenses.length}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalExpenses)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unpaid Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Onbetaalde facturen
          </CardTitle>
          <CardDescription>
            Openstaande facturen in deze periode ({unpaidInvoices.length} facturen, totaal {formatCurrency(totalUnpaid)}
            )
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unpaidInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Geen onbetaalde facturen in deze periode</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factuurnummer</TableHead>
                  <TableHead>Klant</TableHead>
                  <TableHead>Factuurdatum</TableHead>
                  <TableHead>Vervaldatum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Bedrag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unpaidInvoices.map((invoice) => {
                  const dueDate = new Date(invoice.due_date);
                  const today = new Date();
                  const daysOverdue = differenceInDays(today, dueDate);
                  const isOverdue = daysOverdue > 0;

                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>{invoice.client_company_name || "-"}</TableCell>
                      <TableCell>{format(new Date(invoice.invoice_date), "d MMM yyyy", { locale: nl })}</TableCell>
                      <TableCell className={isOverdue ? "text-destructive" : ""}>
                        {format(dueDate, "d MMM yyyy", { locale: nl })}
                        {isOverdue && <span className="text-xs ml-1">({daysOverdue} dagen te laat)</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isOverdue ? "destructive" : "secondary"}>
                          {isOverdue ? "Vervallen" : "Openstaand"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(invoice.total))}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 font-bold">
                  <TableCell colSpan={5}>Totaal openstaand</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalUnpaid)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
