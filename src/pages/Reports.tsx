import { useState, useMemo } from "react";
import { useInvoices } from "@/hooks/useInvoices";
import { useExpenses, EXPENSE_CATEGORIES } from "@/hooks/useExpenses";
import { useOtherIncome } from "@/hooks/useOtherIncome";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, TrendingUp, TrendingDown, FileText, AlertCircle, Download } from "lucide-react";
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
import { getExpenseDeductibleVat, getExpensePaidAmount, getExpenseReverseChargeVat } from "@/lib/expense-vat";
import { downloadExcelWorkbook } from "@/lib/excel";

type Period = "year" | "q1" | "q2" | "q3" | "q4";

export default function Reports() {
  const { invoices, isLoading: loadingInvoices } = useInvoices();
  const { expenses, isLoading: loadingExpenses } = useExpenses();
  const { otherIncome, isLoading: loadingOtherIncome } = useOtherIncome();
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

  const periodOtherIncome = otherIncome.filter((income) => {
    const date = new Date(income.income_date);
    return isAfter(date, start) && isBefore(date, end);
  });

  // Calculate invoice stats
  const paidInvoices = periodInvoices.filter((inv) => inv.status === "paid");
  const unpaidInvoices = periodInvoices.filter((inv) => inv.status !== "paid" && inv.status !== "draft");
  const invoiceRevenueExclBtw = paidInvoices.reduce((sum, inv) => sum + Number(inv.subtotal), 0);
  const otherIncomeRevenue = periodOtherIncome.reduce((sum, income) => sum + Number(income.amount), 0);
  const totalRevenueExclBtw = invoiceRevenueExclBtw + otherIncomeRevenue;
  const totalRevenueVat = paidInvoices.reduce((sum, inv) => sum + Number(inv.total_btw), 0);
  const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);

  // Calculate expense stats
  const totalExpenses = periodExpenses.reduce((sum, exp) => sum + getExpensePaidAmount(exp), 0);
  const totalExpensesExclBtw = periodExpenses.reduce((sum, exp) => sum + Number(exp.amount_excl_btw || 0), 0);
  const reverseChargeVat = periodExpenses.reduce((sum, exp) => sum + getExpenseReverseChargeVat(exp), 0);
  const totalExpensesVat = periodExpenses.reduce((sum, exp) => sum + getExpenseDeductibleVat(exp), 0);

  // Calculate expenses by category
  const expensesByCategory = EXPENSE_CATEGORIES.map((cat) => {
    const categoryExpenses = periodExpenses.filter((exp) => exp.category === cat.value);
    const total = categoryExpenses.reduce((sum, exp) => sum + getExpensePaidAmount(exp), 0);
    return { ...cat, total, count: categoryExpenses.length };
  }).filter((cat) => cat.total > 0);

  // Profit/Loss
  const profit = totalRevenueExclBtw - totalExpensesExclBtw;
  const vatToPay = (totalRevenueVat + reverseChargeVat) - totalExpensesVat;

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

      const monthOtherIncome = periodOtherIncome.filter((income) => {
        const date = new Date(income.income_date);
        return isAfter(date, monthStart) && isBefore(date, monthEnd);
      });

      const revenue = monthInvoices.reduce((sum, inv) => sum + Number(inv.subtotal), 0);
      const additionalIncome = monthOtherIncome.reduce((sum, income) => sum + Number(income.amount), 0);
      const expenses = monthExpenses.reduce((sum, exp) => sum + Number(exp.amount_excl_btw || 0), 0);

      return {
        month: format(monthStart, "MMM", { locale: nl }),
        omzet: revenue + additionalIncome,
        kosten: expenses,
      };
    });
  }, [paidInvoices, periodExpenses, periodOtherIncome, selectedYear, period]);

  const isLoading = loadingInvoices || loadingExpenses || loadingOtherIncome;

  // Available years
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const periodLabel = period === "year" ? year : `${year}-${period.toUpperCase()}`;
  const periodDescription = period === "year" ? `Boekjaar ${year}` : `${period.toUpperCase()} ${year}`;

  const handleExportSummary = () => {
    downloadExcelWorkbook(
      `rapport-samenvatting-${periodLabel}.xls`,
      [
        {
          name: "Samenvatting",
          title: `Financieel rapport - ${periodDescription}`,
          description: `Gegenereerd op ${new Date().toLocaleDateString("nl-NL")}`,
          columns: [
            { key: "veld", header: "Onderdeel", width: 230 },
            { key: "bedrag", header: "Bedrag", width: 120, type: "currency" as const },
          ],
          rows: [
            { veld: "Omzet facturen excl. BTW", bedrag: invoiceRevenueExclBtw },
            { veld: "Inkomsten zonder factuur", bedrag: otherIncomeRevenue },
            { veld: "Omzet totaal excl. BTW", bedrag: totalRevenueExclBtw, __style: "total" as const },
            { veld: "BTW over omzet", bedrag: totalRevenueVat },
            { veld: "Kosten excl. BTW", bedrag: totalExpensesExclBtw },
            { veld: "Voorbelasting", bedrag: totalExpensesVat },
            { veld: "Reverse-charge BTW", bedrag: reverseChargeVat },
            { veld: "Winst / verlies", bedrag: profit, __style: "total" as const },
            { veld: "BTW af te dragen", bedrag: vatToPay, __style: "total" as const },
            { veld: "Openstaand incl. BTW", bedrag: totalUnpaid },
          ],
        },
        {
          name: "Maanden",
          title: "Omzet en kosten per maand",
          description: periodDescription,
          columns: [
            { key: "month", header: "Maand", width: 90 },
            { key: "omzet", header: "Omzet excl. BTW", width: 130, type: "currency" as const },
            { key: "kosten", header: "Kosten excl. BTW", width: 130, type: "currency" as const },
            { key: "resultaat", header: "Resultaat", width: 120, type: "currency" as const },
          ],
          rows: [
            ...monthlyRevenueData.map((row) => ({
              ...row,
              resultaat: row.omzet - row.kosten,
            })),
            {
              month: "Totaal",
              omzet: monthlyRevenueData.reduce((sum, row) => sum + row.omzet, 0),
              kosten: monthlyRevenueData.reduce((sum, row) => sum + row.kosten, 0),
              resultaat: monthlyRevenueData.reduce((sum, row) => sum + row.omzet - row.kosten, 0),
              __style: "total" as const,
            },
          ],
        },
        {
          name: "Categorieen",
          title: "Kosten per categorie",
          description: periodDescription,
          columns: [
            { key: "label", header: "Categorie", width: 180 },
            { key: "count", header: "Aantal", width: 80, type: "number" as const },
            { key: "total", header: "Totaal", width: 120, type: "currency" as const },
          ],
          rows: [
            ...expensesByCategory.map((category) => ({
              label: category.label,
              count: category.count,
              total: category.total,
            })),
            {
              label: "Totaal",
              count: periodExpenses.length,
              total: totalExpenses,
              __style: "total" as const,
            },
          ],
        },
        {
          name: "Openstaand",
          title: "Openstaande facturen",
          description: periodDescription,
          columns: [
            { key: "invoice_number", header: "Factuurnummer", width: 120 },
            { key: "client", header: "Klant", width: 180 },
            { key: "invoice_date", header: "Factuurdatum", width: 105, type: "date" as const },
            { key: "due_date", header: "Vervaldatum", width: 105, type: "date" as const },
            { key: "status", header: "Status", width: 100 },
            { key: "total", header: "Bedrag incl. BTW", width: 130, type: "currency" as const },
          ],
          rows: [
            ...unpaidInvoices.map((invoice) => ({
              invoice_number: invoice.invoice_number,
              client: invoice.client_company_name || "",
              invoice_date: invoice.invoice_date,
              due_date: invoice.due_date,
              status: invoice.status,
              total: invoice.total,
            })),
            {
              invoice_number: "Totaal",
              client: "",
              invoice_date: "",
              due_date: "",
              status: "",
              total: totalUnpaid,
              __style: "total" as const,
            },
          ],
        },
      ],
    );
  };

  const handleExportDetails = () => {
    const invoiceRows = periodInvoices.map((invoice) => ({
      type: "factuur",
      datum: invoice.invoice_date,
      relatie: invoice.client_company_name || "",
      omschrijving: invoice.invoice_number,
      status: invoice.status,
      bedrag_excl_btw: invoice.subtotal,
      btw: invoice.total_btw,
      bedrag_incl_btw: invoice.total,
    }));
    const expenseRows = periodExpenses.map((expense) => ({
      type: "uitgave",
      datum: expense.expense_date,
      relatie: expense.vendor_name,
      omschrijving: expense.description || expense.category,
      status: expense.btw_period || "",
      bedrag_excl_btw: expense.amount_excl_btw || 0,
      btw: getExpenseDeductibleVat(expense),
      bedrag_incl_btw: getExpensePaidAmount(expense),
    }));
    const incomeRows = periodOtherIncome.map((income) => ({
      type: "inkomst",
      datum: income.income_date,
      relatie: income.source_name,
      omschrijving: income.description || income.category,
      status: "",
      bedrag_excl_btw: income.amount,
      btw: 0,
      bedrag_incl_btw: income.amount,
    }));

    const detailColumns = [
      { key: "type", header: "Type", width: 90 },
      { key: "datum", header: "Datum", width: 105, type: "date" as const },
      { key: "relatie", header: "Relatie", width: 180 },
      { key: "omschrijving", header: "Omschrijving", width: 220 },
      { key: "status", header: "Status / periode", width: 120 },
      { key: "bedrag_excl_btw", header: "Excl. BTW", width: 115, type: "currency" as const },
      { key: "btw", header: "BTW", width: 105, type: "currency" as const },
      { key: "bedrag_incl_btw", header: "Incl. BTW", width: 115, type: "currency" as const },
    ];
    const allRows = [...invoiceRows, ...expenseRows, ...incomeRows].sort((a, b) => a.datum.localeCompare(b.datum));

    downloadExcelWorkbook(
      `rapport-details-${periodLabel}.xls`,
      [
        {
          name: "Alle mutaties",
          title: `Mutaties - ${periodDescription}`,
          description: `Facturen, uitgaven en inkomsten zonder factuur`,
          columns: detailColumns,
          rows: allRows,
        },
        {
          name: "Facturen",
          title: "Facturen",
          description: periodDescription,
          columns: detailColumns,
          rows: invoiceRows,
        },
        {
          name: "Uitgaven",
          title: "Uitgaven",
          description: periodDescription,
          columns: detailColumns,
          rows: expenseRows,
        },
        {
          name: "Inkomsten",
          title: "Inkomsten zonder factuur",
          description: periodDescription,
          columns: detailColumns,
          rows: incomeRows,
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Rapporten</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Financieel overzicht voor de belastingaangifte</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-row">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-full sm:w-[120px]">
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
            <SelectTrigger className="w-full sm:w-[140px]">
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
          <Button variant="outline" onClick={handleExportSummary} className="min-w-0 px-3">
            <Download className="h-4 w-4 mr-2 shrink-0" />
            Samenvatting
          </Button>
          <Button variant="outline" onClick={handleExportDetails} className="min-w-0 px-3">
            <Download className="h-4 w-4 mr-2 shrink-0" />
            Details
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 leading-snug">
              <TrendingUp className="h-4 w-4 shrink-0" />
              Omzet (excl. BTW)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="break-words text-xl font-bold tabular-nums text-success sm:text-2xl">{formatCurrency(totalRevenueExclBtw)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(invoiceRevenueExclBtw)} facturen · {formatCurrency(otherIncomeRevenue)} zonder factuur
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 leading-snug">
              <TrendingDown className="h-4 w-4 shrink-0" />
              Kosten (excl. BTW)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="break-words text-xl font-bold tabular-nums text-destructive sm:text-2xl">{formatCurrency(totalExpensesExclBtw)}</div>
            <p className="text-xs text-muted-foreground mt-1">{periodExpenses.length} uitgaven</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
            <CardTitle className="text-sm font-medium leading-snug">Winst / Verlies</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className={`break-words text-xl font-bold tabular-nums sm:text-2xl ${profit >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(profit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Omzet min kosten</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
            <CardTitle className="text-sm font-medium leading-snug">BTW af te dragen</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className={`break-words text-xl font-bold tabular-nums sm:text-2xl ${vatToPay >= 0 ? "text-warning" : "text-success"}`}>
              {formatCurrency(vatToPay)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{vatToPay >= 0 ? "Te betalen" : "Terug te vorderen"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-2xl">
            <TrendingUp className="h-5 w-5 shrink-0" />
            Omzet & Kosten per maand
          </CardTitle>
          <CardDescription>Maandelijks overzicht (excl. BTW)</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="h-[260px] overflow-x-auto sm:h-[300px]">
            <div className="h-full min-w-[520px] sm:min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenueData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
                    width={48}
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
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* BTW Overview */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-2xl">
              <FileText className="h-5 w-5 shrink-0" />
              BTW Overzicht
            </CardTitle>
            <CardDescription>Voor de BTW-aangifte</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="py-3 pl-0 pr-3 font-medium">Omzet uit facturen excl. BTW</TableCell>
                  <TableCell className="py-3 pl-3 pr-0 text-right tabular-nums">{formatCurrency(invoiceRevenueExclBtw)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="py-3 pl-0 pr-3 font-medium">Inkomsten zonder factuur</TableCell>
                  <TableCell className="py-3 pl-3 pr-0 text-right tabular-nums text-muted-foreground">{formatCurrency(otherIncomeRevenue)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="py-3 pl-0 pr-3 font-medium">BTW over omzet</TableCell>
                  <TableCell className="py-3 pl-3 pr-0 text-right tabular-nums">{formatCurrency(totalRevenueVat)}</TableCell>
                </TableRow>
                <TableRow className="border-t">
                  <TableCell className="py-3 pl-0 pr-3 font-medium">Kosten excl. BTW</TableCell>
                  <TableCell className="py-3 pl-3 pr-0 text-right tabular-nums">{formatCurrency(totalExpensesExclBtw)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="py-3 pl-0 pr-3 font-medium">Voorbelasting (BTW kosten)</TableCell>
                  <TableCell className="py-3 pl-3 pr-0 text-right tabular-nums text-success">{formatCurrency(totalExpensesVat)}</TableCell>
                </TableRow>
                <TableRow className="border-t-2 font-bold">
                  <TableCell className="py-3 pl-0 pr-3">Per saldo te betalen</TableCell>
                  <TableCell className={`py-3 pl-3 pr-0 text-right tabular-nums ${vatToPay >= 0 ? "" : "text-success"}`}>
                    {formatCurrency(vatToPay)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-2xl">
              <BarChart3 className="h-5 w-5 shrink-0" />
              Kosten per categorie
            </CardTitle>
            <CardDescription>Overzicht van je uitgaven</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {expensesByCategory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Geen uitgaven in deze periode</p>
            ) : (
              <Table className="min-w-[360px]">
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
                      <TableCell className="text-right tabular-nums">{formatCurrency(cat.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-bold">
                    <TableCell>Totaal</TableCell>
                    <TableCell className="text-right">{periodExpenses.length}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(totalExpenses)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unpaid Invoices */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-2xl">
            <AlertCircle className="h-5 w-5 shrink-0" />
            Onbetaalde facturen
          </CardTitle>
          <CardDescription>
            Openstaande facturen in deze periode ({unpaidInvoices.length} facturen, totaal {formatCurrency(totalUnpaid)}
            )
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {unpaidInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Geen onbetaalde facturen in deze periode</p>
          ) : (
            <>
              <div className="divide-y md:hidden">
                {unpaidInvoices.map((invoice) => {
                  const dueDate = new Date(invoice.due_date);
                  const today = new Date();
                  const daysOverdue = differenceInDays(today, dueDate);
                  const isOverdue = daysOverdue > 0;

                  return (
                    <div key={invoice.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{invoice.invoice_number}</div>
                          <div className="mt-1 truncate text-sm text-muted-foreground">
                            {invoice.client_company_name || "-"}
                          </div>
                        </div>
                        <Badge variant={isOverdue ? "destructive" : "secondary"} className="shrink-0">
                          {isOverdue ? "Vervallen" : "Openstaand"}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Factuurdatum</div>
                          <div>{format(new Date(invoice.invoice_date), "d MMM yyyy", { locale: nl })}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Vervaldatum</div>
                          <div className={isOverdue ? "text-destructive" : ""}>
                            {format(dueDate, "d MMM yyyy", { locale: nl })}
                          </div>
                        </div>
                      </div>
                      {isOverdue && (
                        <div className="mt-2 text-xs text-destructive">{daysOverdue} dagen te laat</div>
                      )}
                      <div className="mt-3 text-right font-semibold tabular-nums">
                        {formatCurrency(Number(invoice.total))}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between gap-3 pt-4 font-bold">
                  <span>Totaal openstaand</span>
                  <span className="tabular-nums">{formatCurrency(totalUnpaid)}</span>
                </div>
              </div>

              <div className="hidden md:block">
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
                          <TableCell className="text-right font-medium tabular-nums">{formatCurrency(Number(invoice.total))}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="border-t-2 font-bold">
                      <TableCell colSpan={5}>Totaal openstaand</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(totalUnpaid)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
