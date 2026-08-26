import { Link } from 'react-router-dom';
import { useInvoices } from '@/hooks/useInvoices';
import { useExpenses } from '@/hooks/useExpenses';
import { useOtherIncome } from '@/hooks/useOtherIncome';
import { useProfile } from '@/hooks/useProfile';
import { useClients } from '@/hooks/useClients';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMonthlySalaries } from '@/hooks/useMonthlySalaries';
import { useAnnualTaxData } from '@/hooks/useAnnualTaxData';
import { useProjects, useTimeEntries } from '@/hooks/useProjects';
import { 
  FileText, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Euro,
  Calculator,
  Clock,
  CheckCircle2,
  Settings,
  Users,
  Receipt,
  Wallet,
  Timer,
  Activity,
  Loader2,
  BarChart3,
  Car,
} from 'lucide-react';
import { addDays, differenceInDays, format, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { nl } from 'date-fns/locale';
import { getExpensePaidAmount } from '@/lib/expense-vat';
import { calculateBtwFilingAmounts } from '@/lib/btw-filing';

const FIXED_EXPENSE_CATEGORIES = new Set(['software', 'telefoon', 'verzekeringen']);

const toNumber = (value: number | string | null | undefined) => Number(value || 0);

const normalizeName = (value: string | null | undefined) => value?.trim().toLowerCase() || '';

const isBillableInvoiceStatus = (status: string) => status !== 'draft' && status !== 'cancelled';

const calculateProgressiveTax = (income: number) => {
  const brackets = [
    { limit: 38883, rate: 0.3575 },
    { limit: 78426, rate: 0.3756 },
    { limit: Infinity, rate: 0.495 },
  ];
  let previousLimit = 0;
  let total = 0;

  brackets.forEach((bracket) => {
    if (income <= previousLimit) return;
    const taxableInBracket = Math.min(income, bracket.limit) - previousLimit;
    total += taxableInBracket * bracket.rate;
    previousLimit = bracket.limit;
  });

  return total;
};

export default function Dashboard() {
  const { invoices, overdueInvoices, isLoading: loadingInvoices } = useInvoices();
  const { expenses, isLoading: loadingExpenses } = useExpenses();
  const { otherIncome, isLoading: loadingOtherIncome } = useOtherIncome();
  const { profile, isLoading: loadingProfile } = useProfile();
  const { clients, isLoading: loadingClients } = useClients();
  const { projects, isLoading: loadingProjects } = useProjects();
  const { timeEntries, isLoading: loadingTimeEntries } = useTimeEntries();
  const currentYear = new Date().getFullYear();
  const { salaries, isLoading: loadingSalaries } = useMonthlySalaries(currentYear);
  const { taxData, isLoading: loadingTaxData, getTaxConstants } = useAnnualTaxData(currentYear);
  const annualSalary = salaries.reduce((sum, salary) => sum + Number(salary.gross_amount || 0), 0);

  const now = new Date();
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  // Calculate stats for current year
  const yearInvoices = invoices.filter(inv => {
    const date = new Date(inv.invoice_date);
    return isWithinInterval(date, { start: yearStart, end: yearEnd });
  });

  const yearExpenses = expenses.filter(exp => {
    const date = new Date(exp.expense_date);
    return isWithinInterval(date, { start: yearStart, end: yearEnd });
  });

  const yearOtherIncome = otherIncome.filter(income => {
    const date = new Date(income.income_date);
    return isWithinInterval(date, { start: yearStart, end: yearEnd });
  });

  const paidInvoices = yearInvoices.filter((invoice) => invoice.status === 'paid');
  const openInvoices = yearInvoices.filter((invoice) => isBillableInvoiceStatus(invoice.status) && invoice.status !== 'paid');
  const billableInvoices = yearInvoices.filter((invoice) => isBillableInvoiceStatus(invoice.status));
  const invoiceRevenue = paidInvoices.reduce((sum, inv) => sum + toNumber(inv.total), 0);
  const invoiceRevenueExclBtw = paidInvoices.reduce((sum, invoice) => sum + toNumber(invoice.subtotal), 0);
  const otherIncomeRevenue = yearOtherIncome
    .reduce((sum, income) => sum + toNumber(income.amount), 0);
  const totalRevenue = invoiceRevenueExclBtw + otherIncomeRevenue;

  const totalPendingRevenue = openInvoices.reduce((sum, inv) => sum + toNumber(inv.total), 0);

  const totalExpenses = yearExpenses
    .reduce((sum, exp) => sum + getExpensePaidAmount(exp), 0);

  const totalExpensesExclBtw = yearExpenses.reduce((sum, expense) => sum + toNumber(expense.amount_excl_btw), 0);
  const profit = totalRevenue - totalExpensesExclBtw;
  const invoiceExpenseRatio = totalRevenue > 0 ? Math.min(1, totalExpensesExclBtw / totalRevenue) : 0;
  const estimatedBusinessProfit = Math.max(0, profit);
  const elapsedMonths = Math.max(1, now.getMonth() + 1);
  const remainingMonths = Math.max(1, 12 - now.getMonth());
  const annualRevenueForecast = totalRevenue / elapsedMonths * 12;
  const annualExpenseForecast = totalExpensesExclBtw / elapsedMonths * 12;
  const annualProfitForecast = annualRevenueForecast - annualExpenseForecast;
  const taxConstants = getTaxConstants(currentYear);
  const meetsHoursRequirement = Number(taxData?.hours_worked || 0) >= 1225;
  const zelfstandigenaftrek = meetsHoursRequirement ? taxConstants.zelfstandigenaftrek : 0;
  const startersaftrek = meetsHoursRequirement && taxData?.is_starter ? taxConstants.startersaftrek : 0;
  const projectedProfitAfterAftrek = Math.max(0, annualProfitForecast - zelfstandigenaftrek - startersaftrek);
  const projectedMkbVrijstelling = projectedProfitAfterAftrek * (taxConstants.mkbVrijstellingPercentage / 100);
  const projectedBusinessTaxableIncome = Math.max(0, projectedProfitAfterAftrek - projectedMkbVrijstelling);
  const projectedBox1Income = annualSalary + projectedBusinessTaxableIncome;
  const incomeTaxReserve = Math.max(0, calculateProgressiveTax(projectedBox1Income) - calculateProgressiveTax(annualSalary));
  const zvwReserve = Math.min(projectedBusinessTaxableIncome, 79409) * 0.0485;
  const taxReserve = incomeTaxReserve + zvwReserve;
  const monthlyTaxReserve = taxReserve / 12;
  const remainingMonthlyTaxReserve = taxReserve / remainingMonths;
  const profitAfterAftrek = Math.max(0, estimatedBusinessProfit - zelfstandigenaftrek - startersaftrek);
  const mkbVrijstelling = profitAfterAftrek * (taxConstants.mkbVrijstellingPercentage / 100);
  const estimatedBusinessTaxableIncome = profitAfterAftrek - mkbVrijstelling;
  const estimatedBox1Income = annualSalary + estimatedBusinessTaxableIncome;
  const box1FirstBracket = 38883;
  const remainingBox1Space = Math.max(0, box1FirstBracket - estimatedBox1Income);
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const currentBtwAmounts = calculateBtwFilingAmounts(currentYear, currentQuarter, invoices, expenses);
  const vatReserve = Math.max(0, currentBtwAmounts.field_5c);
  const monthlyVatReserve = vatReserve / Math.max(1, 3 - (now.getMonth() % 3));
  const vatBreakdown = [
    { label: 'Hoog tarief', turnover: currentBtwAmounts.turnover_1a, vat: currentBtwAmounts.field_1a },
    { label: 'Laag tarief', turnover: currentBtwAmounts.turnover_1b, vat: currentBtwAmounts.field_1b },
    { label: '0% / niet belast', turnover: currentBtwAmounts.turnover_1e, vat: 0 },
    {
      label: 'Verlegde BTW',
      turnover: currentBtwAmounts.turnover_2a + currentBtwAmounts.turnover_4a + currentBtwAmounts.turnover_4b,
      vat: currentBtwAmounts.field_2a + currentBtwAmounts.field_4a + currentBtwAmounts.field_4b,
    },
  ];
  const averageMonthlyExpenses = totalExpenses / elapsedMonths;
  const fixedMonthlyExpenses = yearExpenses
    .filter((expense) => FIXED_EXPENSE_CATEGORIES.has(expense.category))
    .reduce((sum, expense) => sum + getExpensePaidAmount(expense), 0) / elapsedMonths;
  const upcomingCashflow = [30, 60, 90].map((days) => {
    const monthsAhead = days / 30;
    const deadline = addDays(now, days);
    const expectedIncome = openInvoices
      .filter((invoice) => new Date(invoice.due_date) <= deadline)
      .reduce((sum, invoice) => sum + toNumber(invoice.total), 0);
    const expectedExpenses = averageMonthlyExpenses * monthsAhead;
    const expectedReserves = (monthlyTaxReserve + monthlyVatReserve) * monthsAhead;

    return {
      days,
      expectedIncome,
      expectedExpenses,
      expectedReserves,
      balance: expectedIncome - expectedExpenses - expectedReserves,
    };
  });
  const yearTimeEntries = timeEntries.filter((entry) => {
    const date = new Date(entry.work_date);
    return isWithinInterval(date, { start: yearStart, end: yearEnd });
  });
  const trackedHours = yearTimeEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  const averageHourlyRevenue = trackedHours > 0 ? totalRevenue / trackedHours : 0;
  const activeProjects = projects.filter((project) => project.status === 'active').length;
  const collectionRate = invoiceRevenue + totalPendingRevenue > 0 ? invoiceRevenue / (invoiceRevenue + totalPendingRevenue) * 100 : 0;
  const revenueByClient = paidInvoices.reduce<Record<string, number>>((totals, invoice) => {
    const client = invoice.client_company_name || 'Onbekende klant';
    totals[client] = (totals[client] || 0) + toNumber(invoice.subtotal);
    return totals;
  }, {});
  const largestClient = Object.entries(revenueByClient).sort(([, first], [, second]) => second - first)[0];
  const largestClientShare = totalRevenue > 0 && largestClient
    ? largestClient[1] / totalRevenue * 100
    : 0;
  const projectMatchesInvoice = (project: typeof projects[number], invoice: typeof yearInvoices[number]) => {
    const projectClientNames = [
      normalizeName(project.client?.company_name),
      normalizeName(project.client_name),
    ].filter(Boolean);
    const invoiceClientName = normalizeName(invoice.client_company_name);

    return Boolean(
      (project.client_id && invoice.client_id && project.client_id === invoice.client_id) ||
      (invoiceClientName && projectClientNames.includes(invoiceClientName))
    );
  };
  const projectPerformance = projects
    .map((project) => {
      const hours = yearTimeEntries
        .filter((entry) => entry.project_id === project.id)
        .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
      const rate = Number(project.hourly_rate || profile?.default_hourly_rate || 0);
      const billableValue = hours * rate;
      const invoicedRevenue = billableInvoices
        .filter((invoice) => projectMatchesInvoice(project, invoice))
        .reduce((sum, invoice) => sum + toNumber(invoice.subtotal), 0);
      const actualHourlyRate = hours > 0 ? invoicedRevenue / hours : 0;
      const hourlyRateAfterCosts = actualHourlyRate * (1 - invoiceExpenseRatio);
      const unbilledValue = Math.max(0, billableValue - invoicedRevenue);

      return {
        name: project.name,
        hours,
        rate,
        value: billableValue,
        invoicedRevenue,
        actualHourlyRate,
        hourlyRateAfterCosts,
        unbilledValue,
        unbilledHours: rate > 0 ? unbilledValue / rate : 0,
      };
    })
    .filter((project) => project.hours > 0)
    .sort((first, second) => second.value - first.value)
    .slice(0, 5);
  const unbilledProjects = projectPerformance.filter((project) => project.unbilledValue > 1);
  const clientProfitability = Object.entries(revenueByClient)
    .map(([client, revenue]) => {
      const allocatedCosts = revenue * invoiceExpenseRatio;
      const netProfit = revenue - allocatedCosts;

      return {
        client,
        revenue,
        netProfit,
        profitPercentage: revenue > 0 ? (netProfit / revenue) * 100 : 0,
      };
    })
    .sort((first, second) => second.revenue - first.revenue)
    .slice(0, 5);
  const invoiceProfitability = paidInvoices
    .map((invoice) => {
      const revenue = toNumber(invoice.subtotal);
      const allocatedCosts = revenue * invoiceExpenseRatio;
      const netProfit = revenue - allocatedCosts;
      const matchingProjects = projects.filter((project) => projectMatchesInvoice(project, invoice));
      const clientRevenue = paidInvoices
        .filter((paidInvoice) => normalizeName(paidInvoice.client_company_name) === normalizeName(invoice.client_company_name))
        .reduce((sum, paidInvoice) => sum + toNumber(paidInvoice.subtotal), 0);
      const matchingHours = matchingProjects.reduce((sum, project) => {
        return sum + yearTimeEntries
          .filter((entry) => entry.project_id === project.id)
          .reduce((entrySum, entry) => entrySum + Number(entry.hours || 0), 0);
      }, 0);
      const allocatedHours = clientRevenue > 0 ? matchingHours * (revenue / clientRevenue) : 0;

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        client: invoice.client_company_name || 'Onbekende klant',
        revenue,
        allocatedCosts,
        netProfit,
        profitPercentage: revenue > 0 ? (netProfit / revenue) * 100 : 0,
        hourlyRateAfterCosts: allocatedHours > 0 ? netProfit / allocatedHours : 0,
      };
    })
    .sort((first, second) => second.revenue - first.revenue)
    .slice(0, 6);
  const previousYearStart = startOfYear(new Date(currentYear - 1, 0, 1));
  const previousYearEnd = endOfYear(new Date(currentYear - 1, 0, 1));
  const previousYearInvoices = invoices.filter((invoice) => {
    const date = new Date(invoice.invoice_date);
    return invoice.status === 'paid' && isWithinInterval(date, { start: previousYearStart, end: previousYearEnd });
  });
  const previousYearExpenses = expenses.filter((expense) => {
    const date = new Date(expense.expense_date);
    return isWithinInterval(date, { start: previousYearStart, end: previousYearEnd });
  });
  const previousYearOtherIncome = otherIncome.filter((income) => {
    const date = new Date(income.income_date);
    return isWithinInterval(date, { start: previousYearStart, end: previousYearEnd });
  });
  const previousYearRevenue = previousYearInvoices.reduce((sum, invoice) => sum + toNumber(invoice.subtotal), 0)
    + previousYearOtherIncome.reduce((sum, income) => sum + toNumber(income.amount), 0);
  const previousYearProfit = previousYearRevenue
    - previousYearExpenses.reduce((sum, expense) => sum + toNumber(expense.amount_excl_btw), 0);
  const annualScenarios = [
    { label: 'Huidig tempo', revenue: annualRevenueForecast, profit: annualProfitForecast },
    { label: 'Groei', revenue: annualRevenueForecast * 1.2, profit: annualRevenueForecast * 1.2 - annualExpenseForecast * 1.1 },
    { label: 'Minder werk', revenue: annualRevenueForecast * 0.8, profit: annualRevenueForecast * 0.8 - annualExpenseForecast * 0.95 },
  ];
  const monthlyRevenue = Array.from({ length: now.getMonth() + 1 }, (_, monthIndex) => {
    const monthStart = new Date(currentYear, monthIndex, 1);
    const monthEnd = new Date(currentYear, monthIndex + 1, 0);
    const invoiceRevenueForMonth = paidInvoices
      .filter((invoice) => isWithinInterval(new Date(invoice.invoice_date), { start: monthStart, end: monthEnd }))
      .reduce((sum, invoice) => sum + toNumber(invoice.subtotal), 0);
    const otherIncomeForMonth = yearOtherIncome
      .filter((income) => isWithinInterval(new Date(income.income_date), { start: monthStart, end: monthEnd }))
      .reduce((sum, income) => sum + toNumber(income.amount), 0);

    return {
      label: format(monthStart, 'MMM', { locale: nl }),
      revenue: invoiceRevenueForMonth + otherIncomeForMonth,
    };
  });
  const desiredMonthlyRevenue = Number(profile?.default_hourly_rate || 0) > 0
    ? Number(profile?.default_hourly_rate || 0) * 120
    : totalRevenue / elapsedMonths;
  const monthsBelowTarget = monthlyRevenue.filter((month) => month.revenue < desiredMonthlyRevenue);
  const paidInvoicesWithPaymentDate = paidInvoices.filter((invoice) => invoice.paid_at);
  const averagePaymentTerm = paidInvoicesWithPaymentDate.length > 0
    ? paidInvoicesWithPaymentDate.reduce((sum, invoice) => {
      return sum + differenceInDays(new Date(invoice.paid_at as string), new Date(invoice.invoice_date));
    }, 0) / paidInvoicesWithPaymentDate.length
    : null;
  const vehicleTotalKm = toNumber(taxData?.vehicle_total_km);
  const vehicleBusinessKm = toNumber(taxData?.vehicle_business_km);
  const vehicleCosts = toNumber(taxData?.vehicle_costs);
  const vehicleBusinessPercentage = vehicleTotalKm > 0 ? Math.min(100, (vehicleBusinessKm / vehicleTotalKm) * 100) : 0;
  const deductibleVehicleCosts = vehicleCosts * (vehicleBusinessPercentage / 100);
  const privateKm = Math.max(0, vehicleTotalKm - vehicleBusinessKm);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const isLoading = loadingInvoices || loadingExpenses || loadingOtherIncome || loadingProfile || loadingClients
    || loadingProjects || loadingTimeEntries || loadingSalaries || loadingTaxData;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check if profile is incomplete
  const profileIncomplete = !profile?.company_name || !profile?.kvk_number;
  const onboardingItems = [
    {
      title: 'Bedrijfsgegevens invullen',
      description: 'Bedrijfsnaam, KVK, BTW en betaalgegevens maken je facturen compleet.',
      complete: !profileIncomplete,
      url: '/settings',
      icon: Settings,
    },
    {
      title: 'Eerste klant toevoegen',
      description: 'Sla klantgegevens op zodat je facturen sneller kunt maken.',
      complete: clients.length > 0,
      url: '/clients?new=1',
      icon: Users,
    },
    {
      title: 'Eerste factuur maken',
      description: 'Maak een conceptfactuur en controleer je template.',
      complete: invoices.length > 0,
      url: '/invoices/new',
      icon: FileText,
    },
    {
      title: 'Eerste uitgave vastleggen',
      description: 'Voeg een bon toe zodat kosten en BTW direct meetellen.',
      complete: expenses.length > 0,
      url: '/expenses?new=1',
      icon: TrendingDown,
    },
  ];
  const showOnboarding = onboardingItems.some((item) => !item.complete);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Welkom terug{profile?.company_name ? `, ${profile.company_name}` : ''}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link to="/income">
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe inkomst
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/invoices/new">
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe factuur
            </Link>
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {(profileIncomplete || overdueInvoices.length > 0) && (
        <div className="space-y-2">
          {profileIncomplete && (
            <Card className="border-warning bg-warning/10">
              <CardContent className="flex items-center gap-4 py-4">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div className="flex-1">
                  <p className="font-medium">Vul je bedrijfsgegevens in</p>
                  <p className="text-sm text-muted-foreground">
                    Ga naar instellingen om je KVK-nummer en andere gegevens in te vullen.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/settings">Instellingen</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {overdueInvoices.length > 0 && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="flex items-center gap-4 py-4">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div className="flex-1">
                  <p className="font-medium">
                    {overdueInvoices.length} factuur{overdueInvoices.length > 1 ? 'en' : ''} verlopen
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Bekijk welke facturen nog niet betaald zijn.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/invoices">Bekijk facturen</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {showOnboarding && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Startklaar maken</CardTitle>
            <CardDescription>Rond deze stappen af voor een bruikbare administratiebasis.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {onboardingItems.map((item) => (
              <Link
                key={item.title}
                to={item.url}
                className="flex items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="mt-0.5">
                  {item.complete ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <item.icon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Omzet dit jaar</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(invoiceRevenueExclBtw)} facturen excl. BTW · {formatCurrency(otherIncomeRevenue)} zonder factuur
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Openstaand</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{formatCurrency(totalPendingRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Nog te ontvangen incl. BTW
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uitgaven dit jaar</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">
              Betaalde kosten incl. BTW in {now.getFullYear()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Winst</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(profit)}
            </div>
            <p className="text-xs text-muted-foreground">
              Omzet en kosten excl. BTW
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Euro className="h-5 w-5" />
              Loon uit vast werk
            </CardTitle>
            <CardDescription>
              Je ingevoerde bruto loon voor {currentYear}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-bold">{formatCurrency(annualSalary)}</p>
            <p className="text-sm text-muted-foreground">{salaries.length} van 12 maanden ingevuld</p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/income">Loon bijwerken</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Box 1 in beeld
            </CardTitle>
            <CardDescription>Indicatie op basis van je ingevoerde loon en onderneming.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Ondernemingswinst</span>
              <span className="font-medium">{formatCurrency(estimatedBusinessProfit)}</span>
            </div>
            <div className="flex justify-between gap-4 text-sm text-muted-foreground">
              <span>Ondernemersaftrek</span>
              <span>- {formatCurrency(zelfstandigenaftrek + startersaftrek)}</span>
            </div>
            <div className="flex justify-between gap-4 text-sm text-muted-foreground">
              <span>MKB-winstvrijstelling ({taxConstants.mkbVrijstellingPercentage}%)</span>
              <span>- {formatCurrency(mkbVrijstelling)}</span>
            </div>
            <div className="flex justify-between gap-4 border-t pt-3 text-sm">
              <span className="text-muted-foreground">Belastbare winst + loon</span>
              <span className="font-medium">{formatCurrency(estimatedBox1Income)}</span>
            </div>
            <div className="flex justify-between gap-4 border-t pt-3">
              <span className="font-medium">Resterend in eerste schijf</span>
              <span className={`font-bold ${remainingBox1Space > 0 ? 'text-success' : 'text-warning'}`}>
                {formatCurrency(remainingBox1Space)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              MKB-vrijstelling: {taxConstants.mkbVrijstellingPercentage}%. Rekent met een indicatieve grens van {formatCurrency(box1FirstBracket)}; heffingskortingen en exacte tarieven zijn niet verwerkt.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Zakelijke kilometers
            </CardTitle>
            <CardDescription>Kilometerregistratie en aftrekbare autokosten.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Zakelijk / totaal</span>
              <span className="font-medium">
                {vehicleBusinessKm.toLocaleString('nl-NL')} / {vehicleTotalKm.toLocaleString('nl-NL')} km
              </span>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Privégebruik</span>
              <span className="font-medium">{privateKm.toLocaleString('nl-NL')} km</span>
            </div>
            <div className="flex justify-between gap-4 border-t pt-3 text-sm">
              <span className="text-muted-foreground">Aftrekbare autokosten</span>
              <span className="font-bold text-success">{formatCurrency(deductibleVehicleCosts)}</span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/tax-filings">Kilometers bijwerken</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Winstgevendheid per factuur</CardTitle>
            <CardDescription>
              Omzet, toegewezen kosten, nettowinst, marge en uurtarief na kosten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoiceProfitability.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nog geen betaalde facturen dit jaar.</p>
            ) : (
              invoiceProfitability.map((invoice) => (
                <div key={invoice.id} className="grid gap-3 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[1.2fr_1fr]">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{invoice.invoiceNumber}</p>
                    <p className="truncate text-sm text-muted-foreground">{invoice.client}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:text-right">
                    <span className="text-muted-foreground sm:text-left">Omzet</span>
                    <span className="font-medium">{formatCurrency(invoice.revenue)}</span>
                    <span className="text-muted-foreground sm:text-left">Kosten</span>
                    <span className="text-destructive">- {formatCurrency(invoice.allocatedCosts)}</span>
                    <span className="text-muted-foreground sm:text-left">Netto</span>
                    <span className="font-bold text-success">{formatCurrency(invoice.netProfit)}</span>
                    <span className="text-muted-foreground sm:text-left">Marge</span>
                    <span>{invoice.profitPercentage.toFixed(0)}%</span>
                    <span className="text-muted-foreground sm:text-left">Uur na kosten</span>
                    <span>{invoice.hourlyRateAfterCosts > 0 ? formatCurrency(invoice.hourlyRateAfterCosts) : '-'}</span>
                  </div>
                </div>
              ))
            )}
            <p className="pt-1 text-xs text-muted-foreground">
              Kosten worden naar rato van omzet toegerekend. Het uurtarief gebruikt gekoppelde projecturen wanneer klant/project overeenkomt.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Winst per klant</CardTitle>
            <CardDescription>Winstpercentage per klant op basis van betaalde omzet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {clientProfitability.length > 0 ? clientProfitability.map((client) => (
              <div key={client.client} className="flex items-center justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-medium">{client.client}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(client.revenue)} omzet excl. BTW</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold text-success">{formatCurrency(client.netProfit)}</p>
                  <p className="text-xs text-muted-foreground">{client.profitPercentage.toFixed(0)}% winst</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">Nog geen betaalde klantomzet om te vergelijken.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              Belastingreserve <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold text-warning">{formatCurrency(Math.max(0, taxReserve))}</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between gap-2"><span>Inkomstenbelasting</span><span>{formatCurrency(incomeTaxReserve)}</span></div>
              <div className="flex justify-between gap-2"><span>Zvw</span><span>{formatCurrency(zvwReserve)}</span></div>
              <div className="flex justify-between gap-2 border-t pt-1 font-medium text-foreground">
                <span>Per maand apart</span><span>{formatCurrency(monthlyTaxReserve)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              BTW-reserve <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold text-warning">{formatCurrency(vatReserve)}</p>
            <p className="text-xs text-muted-foreground">
              BTW-periode Q{currentQuarter}; los van je IB/Zvw-reserve.
            </p>
            <div className="flex justify-between gap-2 border-t pt-2 text-xs">
              <span className="text-muted-foreground">Automatisch reserveren p/m</span>
              <span className="font-medium">{formatCurrency(monthlyVatReserve)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              Jaarprognose <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold text-success">{formatCurrency(annualRevenueForecast)}</p>
            <p className="text-xs text-muted-foreground">Omzet bij huidig gemiddeld tempo</p>
            <div className="flex justify-between gap-2 border-t pt-2 text-xs">
              <span className="text-muted-foreground">Vorig jaar</span>
              <span className="font-medium">{formatCurrency(previousYearRevenue)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              Betalingsgraad <Activity className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold">{collectionRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Betaalde omzet versus betaald + openstaand</p>
            <div className="flex justify-between gap-2 border-t pt-2 text-xs">
              <span className="text-muted-foreground">Gem. betaaltermijn</span>
              <span className="font-medium">{averagePaymentTerm === null ? '-' : `${averagePaymentTerm.toFixed(0)} dagen`}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Cashflow komende periode</CardTitle>
            <CardDescription>Verwachte inkomsten, vaste lasten en reserves.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/50 p-3 text-sm">
              <div>
                <p className="text-muted-foreground">Vaste lasten p/m</p>
                <p className="font-medium">{formatCurrency(fixedMonthlyExpenses)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Gem. uitgaven p/m</p>
                <p className="font-medium">{formatCurrency(averageMonthlyExpenses)}</p>
              </div>
            </div>
            {upcomingCashflow.map((item) => (
              <div key={item.days} className="space-y-1 border-b pb-3 last:border-0 last:pb-0">
                <div className="flex justify-between gap-4">
                  <span className="font-medium">Over {item.days} dagen</span>
                  <span className={`font-bold ${item.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(item.balance)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <span>In: {formatCurrency(item.expectedIncome)}</span>
                  <span>Lasten: {formatCurrency(item.expectedExpenses)}</span>
                  <span>Reserve: {formatCurrency(item.expectedReserves)}</span>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Vaste/komende lasten zijn geschat uit je gemiddelde maandkosten; bekende openstaande facturen tellen mee op vervaldatum.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Timer className="h-5 w-5" /> Urenproductiviteit</CardTitle>
            <CardDescription>Urenregistratie en gemiddelde omzet per uur.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Geregistreerde uren</span><span className="font-medium">{trackedHours.toFixed(1)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Omzet per uur</span><span className="font-medium">{formatCurrency(averageHourlyRevenue)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Actieve projecten</span><span className="font-medium">{activeProjects}</span></div>
            {unbilledProjects.length > 0 && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                {unbilledProjects.length} project{unbilledProjects.length > 1 ? 'en hebben' : ' heeft'} mogelijk niet-gefactureerde uren.
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Prognose winst</CardTitle>
            <CardDescription>Doorgetrokken vanaf het gemiddelde van dit jaar.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${annualProfitForecast >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(annualProfitForecast)}
            </p>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between gap-2"><span>Vorig jaar winst</span><span>{formatCurrency(previousYearProfit)}</span></div>
              <div className="flex justify-between gap-2"><span>IB/Zvw nog p/m</span><span>{formatCurrency(remainingMonthlyTaxReserve)}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> BTW-inzichten</CardTitle>
            <CardDescription>Verwachte aangifte voor Q{currentQuarter} {currentYear}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between gap-4 border-b pb-3">
              <span className="font-medium">Te betalen / ontvangen</span>
              <span className={`font-bold ${currentBtwAmounts.field_5c >= 0 ? 'text-warning' : 'text-success'}`}>
                {formatCurrency(currentBtwAmounts.field_5c)}
              </span>
            </div>
            {vatBreakdown.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
                <span className="truncate text-muted-foreground">{item.label}</span>
                <span className="shrink-0 font-medium">
                  {formatCurrency(item.turnover)} · {formatCurrency(item.vat)}
                </span>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t pt-3 text-sm">
              <span className="text-muted-foreground">Voorbelasting</span>
              <span className="font-medium text-success">- {formatCurrency(currentBtwAmounts.field_5b)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Jaarprognose</CardTitle>
            <CardDescription>Omzet en winst bij drie scenario's.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {annualScenarios.map((scenario) => (
              <div key={scenario.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b pb-2 text-sm last:border-0 last:pb-0">
                <span className="font-medium">{scenario.label}</span>
                <span className="text-right text-muted-foreground">{formatCurrency(scenario.revenue)}</span>
                <span className={`text-right font-bold ${scenario.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(scenario.profit)}
                </span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Vergelijking: vorig jaar {formatCurrency(previousYearRevenue)} omzet en {formatCurrency(previousYearProfit)} winst.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Gezondheidsindicatoren</CardTitle>
            <CardDescription>Signalen voor debiteuren, klantenmix en omzetdoel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Openstaande facturen</span>
              <span className="font-medium">{openInvoices.length} · {formatCurrency(totalPendingRevenue)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Gem. betaaltermijn</span>
              <span className="font-medium">{averagePaymentTerm === null ? '-' : `${averagePaymentTerm.toFixed(0)} dagen`}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Grootste klant</span>
              <span className={`font-medium ${largestClientShare > 50 ? 'text-warning' : ''}`}>{largestClientShare.toFixed(0)}%</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Onder omzetdoel</span>
              <span className="font-medium">{monthsBelowTarget.length} maand{monthsBelowTarget.length === 1 ? '' : 'en'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Omzetdoel p/m</span>
              <span className="font-medium">{formatCurrency(desiredMonthlyRevenue)}</span>
            </div>
            {monthsBelowTarget.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {monthsBelowTarget.map((month) => (
                  <Badge key={month.label} variant="secondary">{month.label}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Klantafhankelijkheid</CardTitle>
            <CardDescription>Omzetconcentratie van betaalde facturen dit jaar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {largestClient ? (
              <>
                <div className="flex justify-between gap-4">
                  <span className="font-medium truncate">{largestClient[0]}</span>
                  <span className="font-bold">{largestClientShare.toFixed(0)}%</span>
                </div>
                <p className="text-sm text-muted-foreground">{formatCurrency(largestClient[1])} van je betaalde omzet komt van je grootste klant.</p>
                {largestClientShare > 50 && <p className="text-sm text-warning">Let op: meer dan de helft van je omzet komt van één klant.</p>}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nog geen betaalde omzet om te vergelijken.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Timer className="h-5 w-5" /> Rendement per project</CardTitle>
            <CardDescription>Werkelijk uurtarief versus gefactureerde waarde.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {projectPerformance.length > 0 ? projectPerformance.map((project) => (
              <div key={project.name} className="space-y-2 border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-4">
                  <span className="truncate font-medium">{project.name}</span>
                  {project.unbilledValue > 1 && <Badge variant="secondary">Nog te factureren</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Gewerkte uren</span>
                  <span className="text-right font-medium">{project.hours.toFixed(1)}</span>
                  <span className="text-muted-foreground">Waarde uren</span>
                  <span className="text-right font-medium">{formatCurrency(project.value)}</span>
                  <span className="text-muted-foreground">Gefactureerd</span>
                  <span className="text-right font-medium">{formatCurrency(project.invoicedRevenue)}</span>
                  <span className="text-muted-foreground">Werkelijk uurtarief</span>
                  <span className="text-right font-medium">{formatCurrency(project.actualHourlyRate)}</span>
                  <span className="text-muted-foreground">Na kosten</span>
                  <span className="text-right font-medium">{formatCurrency(project.hourlyRateAfterCosts)}</span>
                  {project.unbilledValue > 1 && (
                    <>
                      <span className="text-warning">Niet gefactureerd</span>
                      <span className="text-right font-bold text-warning">
                        {formatCurrency(project.unbilledValue)} · {project.unbilledHours.toFixed(1)} uur
                      </span>
                    </>
                  )}
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">Registreer uren bij een project om rendement te zien.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recente facturen
            </CardTitle>
            <CardDescription>
              Je laatste 5 facturen
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nog geen facturen</p>
                <Button variant="link" asChild className="mt-2">
                  <Link to="/invoices/new">Maak je eerste factuur</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {invoices.slice(0, 5).map((invoice) => (
                  <div 
                    key={invoice.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{invoice.invoice_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.client_company_name || 'Onbekende klant'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(Number(invoice.total))}</p>
                      <Badge 
                        variant={
                          invoice.status === 'paid' ? 'default' : 
                          invoice.status === 'overdue' ? 'destructive' : 
                          'secondary'
                        }
                        className="mt-1"
                      >
                        {invoice.status === 'paid' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {invoice.status === 'draft' && 'Concept'}
                        {invoice.status === 'sent' && 'Verzonden'}
                        {invoice.status === 'paid' && 'Betaald'}
                        {invoice.status === 'overdue' && 'Verlopen'}
                        {invoice.status === 'cancelled' && 'Geannuleerd'}
                      </Badge>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/invoices">Alle facturen bekijken</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Recente uitgaven
            </CardTitle>
            <CardDescription>
              Je laatste 5 uitgaven
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingDown className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nog geen uitgaven</p>
                <Button variant="link" asChild className="mt-2">
                  <Link to="/expenses">Voeg een uitgave toe</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {expenses.slice(0, 5).map((expense) => (
                  <div 
                    key={expense.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{expense.vendor_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(expense.expense_date), 'd MMM yyyy', { locale: nl })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-destructive">
                        -{formatCurrency(getExpensePaidAmount(expense))}
                      </p>
                      <Badge variant="outline" className="mt-1">
                        {expense.category}
                      </Badge>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/expenses">Alle uitgaven bekijken</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
