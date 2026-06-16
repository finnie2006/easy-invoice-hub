import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInvoices, Invoice } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ExternalInvoiceDialog } from '@/components/invoices/ExternalInvoiceDialog';
import { 
  Loader2, 
  Plus, 
  FileText, 
  MoreHorizontal, 
  Eye,
  CheckCircle2,
  Send,
  Trash2,
  AlertTriangle,
  Upload,
  Search,
  X,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, isWithinInterval } from 'date-fns';
import { nl } from 'date-fns/locale';

type StatusFilter = 'all' | 'draft' | 'sent' | 'paid' | 'overdue';
type PeriodFilter = 'all' | 'this-month' | 'last-month' | 'this-year';

const statusFilters: StatusFilter[] = ['all', 'draft', 'sent', 'paid', 'overdue'];

const getStatusFilterFromParam = (status: string | null): StatusFilter => {
  return statusFilters.includes(status as StatusFilter) ? (status as StatusFilter) : 'all';
};

export default function Invoices() {
  const { invoices, isLoading, updateInvoiceStatus, deleteInvoice } = useInvoices();
  const { clients } = useClients();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatusFilter = getStatusFilterFromParam(searchParams.get('status'));
  const [externalDialogOpen, setExternalDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(urlStatusFilter);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');

  useEffect(() => {
    setStatusFilter(urlStatusFilter);
  }, [urlStatusFilter]);

  const handleDeleteClick = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (invoiceToDelete) {
      deleteInvoice(invoiceToDelete.id);
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    }
  };

  // Get unique clients from invoices for filter dropdown
  const invoiceClients = useMemo(() => {
    const uniqueClients = new Map<string, string>();
    invoices.forEach(inv => {
      if (inv.client_id && inv.client_company_name) {
        uniqueClients.set(inv.client_id, inv.client_company_name);
      }
    });
    return Array.from(uniqueClients.entries()).map(([id, name]) => ({ id, name }));
  }, [invoices]);

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      // Check if overdue
      const isOverdue = 
        invoice.status !== 'paid' && 
        invoice.status !== 'cancelled' && 
        new Date(invoice.due_date) < new Date();
      const effectiveStatus = isOverdue ? 'overdue' : invoice.status;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          invoice.invoice_number.toLowerCase().includes(query) ||
          (invoice.client_company_name?.toLowerCase().includes(query) ?? false);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && effectiveStatus !== statusFilter) {
        return false;
      }

      // Client filter
      if (clientFilter !== 'all' && invoice.client_id !== clientFilter) {
        return false;
      }

      // Period filter
      if (periodFilter !== 'all') {
        const invoiceDate = new Date(invoice.invoice_date);
        const now = new Date();
        let start: Date, end: Date;

        switch (periodFilter) {
          case 'this-month':
            start = startOfMonth(now);
            end = endOfMonth(now);
            break;
          case 'last-month':
            start = startOfMonth(subMonths(now, 1));
            end = endOfMonth(subMonths(now, 1));
            break;
          case 'this-year':
            start = startOfYear(now);
            end = endOfYear(now);
            break;
          default:
            return true;
        }

        if (!isWithinInterval(invoiceDate, { start, end })) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, searchQuery, statusFilter, clientFilter, periodFilter]);

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || clientFilter !== 'all' || periodFilter !== 'all';

  const handleStatusFilterChange = (value: StatusFilter) => {
    setStatusFilter(value);

    const nextParams = new URLSearchParams(searchParams);
    if (value === 'all') {
      nextParams.delete('status');
    } else {
      nextParams.set('status', value);
    }

    setSearchParams(nextParams, { replace: true });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setClientFilter('all');
    setPeriodFilter('all');

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('status');
    setSearchParams(nextParams, { replace: true });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Concept</Badge>;
      case 'sent':
        return <Badge variant="outline">Verzonden</Badge>;
      case 'paid':
        return <Badge className="bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Betaald</Badge>;
      case 'overdue':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Verlopen</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Geannuleerd</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Facturen</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Beheer en maak nieuwe facturen
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setExternalDialogOpen(true)} className="w-full sm:w-auto">
            <Upload className="h-4 w-4 mr-2" />
            Externe factuur
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/invoices/new">
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe factuur
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Factuuroverzicht
          </CardTitle>
          <CardDescription>
            {filteredInvoices.length} van {invoices.length} factuu{invoices.length !== 1 ? 'r' : 'ren'}
            {hasActiveFilters && ' (gefilterd)'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek op factuurnummer of klant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Filter dropdowns */}
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={(v) => handleStatusFilterChange(v as StatusFilter)}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle statussen</SelectItem>
                  <SelectItem value="draft">Concept</SelectItem>
                  <SelectItem value="sent">Verzonden</SelectItem>
                  <SelectItem value="paid">Betaald</SelectItem>
                  <SelectItem value="overdue">Verlopen</SelectItem>
                </SelectContent>
              </Select>

              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Klant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle klanten</SelectItem>
                  {invoiceClients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Periode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle periodes</SelectItem>
                  <SelectItem value="this-month">Deze maand</SelectItem>
                  <SelectItem value="last-month">Vorige maand</SelectItem>
                  <SelectItem value="this-year">Dit jaar</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
                  <X className="h-4 w-4 mr-1" />
                  Wissen
                </Button>
              )}
            </div>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              {invoices.length === 0 ? (
                <>
                  <p>Nog geen facturen</p>
                  <Button variant="link" asChild className="mt-2">
                    <Link to="/invoices/new">Maak je eerste factuur</Link>
                  </Button>
                </>
              ) : (
                <>
                  <p>Geen facturen gevonden</p>
                  <Button variant="link" onClick={clearFilters} className="mt-2">
                    Filters wissen
                  </Button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="block md:hidden space-y-3">
                {filteredInvoices.map((invoice) => {
                  const isOverdue = 
                    invoice.status !== 'paid' && 
                    invoice.status !== 'cancelled' && 
                    new Date(invoice.due_date) < new Date();

                  return (
                    <div key={invoice.id} className="p-4 rounded-lg bg-muted/50 space-y-3">
                        <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{invoice.invoice_number}</p>
                            {invoice.attachment_url && (
                              <Badge variant="outline" className="text-xs">Extern</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{invoice.client_company_name || '-'}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/invoices/${invoice.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                Bekijken
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {invoice.status === 'draft' && (
                              <DropdownMenuItem
                                onClick={() => updateInvoiceStatus({ id: invoice.id, status: 'sent' })}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Markeer als verzonden
                              </DropdownMenuItem>
                            )}
                            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                              <DropdownMenuItem
                                onClick={() => updateInvoiceStatus({ id: invoice.id, status: 'paid', paid_at: new Date().toISOString() })}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Markeer als betaald
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteClick(invoice)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Verwijderen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {format(new Date(invoice.invoice_date), 'd MMM', { locale: nl })}
                          {' → '}
                          <span className={isOverdue ? 'text-destructive' : ''}>
                            {format(new Date(invoice.due_date), 'd MMM', { locale: nl })}
                          </span>
                        </span>
                        {isOverdue && invoice.status !== 'overdue' 
                          ? <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Verlopen</Badge>
                          : getStatusBadge(invoice.status)
                        }
                      </div>
                      <div className="text-lg font-bold">{formatCurrency(Number(invoice.total))}</div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nummer</TableHead>
                      <TableHead>Klant</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Vervaldatum</TableHead>
                      <TableHead>Bedrag</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => {
                      const isOverdue = 
                        invoice.status !== 'paid' && 
                        invoice.status !== 'cancelled' && 
                        new Date(invoice.due_date) < new Date();

                      return (
                        <TableRow key={invoice.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{invoice.invoice_number}</span>
                              {invoice.attachment_url && (
                                <Badge variant="outline" className="text-xs">Extern</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{invoice.client_company_name || '-'}</TableCell>
                          <TableCell>
                            {format(new Date(invoice.invoice_date), 'd MMM yyyy', { locale: nl })}
                          </TableCell>
                          <TableCell className={isOverdue ? 'text-destructive' : ''}>
                            {format(new Date(invoice.due_date), 'd MMM yyyy', { locale: nl })}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(Number(invoice.total))}
                          </TableCell>
                          <TableCell>
                            {isOverdue && invoice.status !== 'overdue' 
                              ? <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Verlopen</Badge>
                              : getStatusBadge(invoice.status)
                            }
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link to={`/invoices/${invoice.id}`}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Bekijken
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {invoice.status === 'draft' && (
                                  <DropdownMenuItem
                                    onClick={() => updateInvoiceStatus({ id: invoice.id, status: 'sent' })}
                                  >
                                    <Send className="h-4 w-4 mr-2" />
                                    Markeer als verzonden
                                  </DropdownMenuItem>
                                )}
                                {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                                  <DropdownMenuItem
                                    onClick={() => updateInvoiceStatus({ id: invoice.id, status: 'paid', paid_at: new Date().toISOString() })}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Markeer als betaald
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDeleteClick(invoice)} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Verwijderen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ExternalInvoiceDialog 
        open={externalDialogOpen} 
        onOpenChange={setExternalDialogOpen} 
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Factuur verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je factuur {invoiceToDelete?.invoice_number} wilt verwijderen?
              {invoiceToDelete?.client_company_name && (
                <> ({invoiceToDelete.client_company_name})</>
              )}
              <br /><br />
              <strong>Let op:</strong> Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
