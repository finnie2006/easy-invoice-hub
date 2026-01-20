import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInvoices } from '@/hooks/useInvoices';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

export default function Invoices() {
  const { invoices, isLoading, updateInvoiceStatus, deleteInvoice } = useInvoices();
  const [externalDialogOpen, setExternalDialogOpen] = useState(false);

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
            {invoices.length} factuu{invoices.length !== 1 ? 'r' : 'ren'} in totaal
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nog geen facturen</p>
              <Button variant="link" asChild className="mt-2">
                <Link to="/invoices/new">Maak je eerste factuur</Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="block md:hidden space-y-3">
                {invoices.map((invoice) => {
                  const isOverdue = 
                    invoice.status !== 'paid' && 
                    invoice.status !== 'cancelled' && 
                    new Date(invoice.due_date) < new Date();

                  return (
                    <div key={invoice.id} className="p-4 rounded-lg bg-muted/50 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{invoice.invoice_number}</p>
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
                            <DropdownMenuItem onClick={() => deleteInvoice(invoice.id)} className="text-destructive">
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
                    {invoices.map((invoice) => {
                      const isOverdue = 
                        invoice.status !== 'paid' && 
                        invoice.status !== 'cancelled' && 
                        new Date(invoice.due_date) < new Date();

                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
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
                                <DropdownMenuItem onClick={() => deleteInvoice(invoice.id)} className="text-destructive">
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
    </div>
  );
}
