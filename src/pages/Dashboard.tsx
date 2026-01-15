import { Link } from 'react-router-dom';
import { useInvoices } from '@/hooks/useInvoices';
import { useExpenses } from '@/hooks/useExpenses';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Euro,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { format, startOfYear, endOfYear, isAfter, isBefore } from 'date-fns';
import { nl } from 'date-fns/locale';

export default function Dashboard() {
  const { invoices, overdueInvoices, isLoading: loadingInvoices } = useInvoices();
  const { expenses, isLoading: loadingExpenses } = useExpenses();
  const { profile, isLoading: loadingProfile } = useProfile();

  const now = new Date();
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  // Calculate stats for current year
  const yearInvoices = invoices.filter(inv => {
    const date = new Date(inv.invoice_date);
    return isAfter(date, yearStart) && isBefore(date, yearEnd);
  });

  const yearExpenses = expenses.filter(exp => {
    const date = new Date(exp.expense_date);
    return isAfter(date, yearStart) && isBefore(date, yearEnd);
  });

  const totalRevenue = yearInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + Number(inv.total), 0);

  const totalPendingRevenue = yearInvoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + Number(inv.total), 0);

  const totalExpenses = yearExpenses
    .reduce((sum, exp) => sum + Number(exp.amount_incl_btw), 0);

  const profit = totalRevenue - totalExpenses;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const isLoading = loadingInvoices || loadingExpenses || loadingProfile;

  // Check if profile is incomplete
  const profileIncomplete = !profile?.company_name || !profile?.kvk_number;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welkom terug{profile?.company_name ? `, ${profile.company_name}` : ''}
          </p>
        </div>
        <Button asChild>
          <Link to="/invoices/new">
            <Plus className="h-4 w-4 mr-2" />
            Nieuwe factuur
          </Link>
        </Button>
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
              Betaalde facturen in {now.getFullYear()}
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
              Nog te ontvangen
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
              Totale kosten in {now.getFullYear()}
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
              Omzet min uitgaven
            </p>
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
                        -{formatCurrency(Number(expense.amount_incl_btw))}
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
