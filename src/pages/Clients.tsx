import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClients, Client, ClientInsert } from '@/hooks/useClients';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, Plus, Users, MoreHorizontal, Pencil, Trash2, Search, X, MapPin, Download, Upload } from 'lucide-react';
import { parseCsv } from '@/lib/csv';
import { downloadExcelWorkbook } from '@/lib/excel';

const emptyClient: ClientInsert = {
  company_name: '',
  contact_name: null,
  email: null,
  phone: null,
  address: null,
  postal_code: null,
  city: null,
  country: 'Nederland',
  kvk_number: null,
  btw_number: null,
  notes: null,
  is_saved: true,
};

const clientExportColumns = [
  { key: 'company_name', header: 'Bedrijfsnaam', width: 180 },
  { key: 'contact_name', header: 'Contactpersoon', width: 150 },
  { key: 'email', header: 'E-mail', width: 190 },
  { key: 'phone', header: 'Telefoon', width: 110 },
  { key: 'address', header: 'Adres', width: 180 },
  { key: 'postal_code', header: 'Postcode', width: 90 },
  { key: 'city', header: 'Plaats', width: 120 },
  { key: 'country', header: 'Land', width: 110 },
  { key: 'kvk_number', header: 'KVK-nummer', width: 110 },
  { key: 'btw_number', header: 'BTW-nummer', width: 130 },
  { key: 'notes', header: 'Notities', width: 220 },
];

export default function Clients() {
  const { clients, isLoading, createClient, updateClient, deleteClient, isCreating } = useClients();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientInsert>(emptyClient);
  const [deleteConfirmClient, setDeleteConfirmClient] = useState<Client | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');

  // Get unique cities for filter dropdown
  const cities = useMemo(() => {
    const uniqueCities = new Set<string>();
    clients.forEach(client => {
      if (client.city) {
        uniqueCities.add(client.city);
      }
    });
    return Array.from(uniqueCities).sort();
  }, [clients]);

  // Filter clients
  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          client.company_name.toLowerCase().includes(query) ||
          (client.contact_name?.toLowerCase().includes(query) ?? false) ||
          (client.email?.toLowerCase().includes(query) ?? false) ||
          (client.notes?.toLowerCase().includes(query) ?? false);
        if (!matchesSearch) return false;
      }

      // City filter
      if (cityFilter !== 'all' && client.city !== cityFilter) {
        return false;
      }

      return true;
    });
  }, [clients, searchQuery, cityFilter]);

  const hasActiveFilters = searchQuery || cityFilter !== 'all';

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setDialogOpen(true);
    }
  }, [searchParams]);

  const clearFilters = () => {
    setSearchQuery('');
    setCityFilter('all');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value || null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingClient) {
      updateClient({ id: editingClient.id, ...formData });
    } else {
      await createClient(formData);
    }
    
    setDialogOpen(false);
    setEditingClient(null);
    setFormData(emptyClient);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      company_name: client.company_name,
      contact_name: client.contact_name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      postal_code: client.postal_code,
      city: client.city,
      country: client.country || 'Nederland',
      kvk_number: client.kvk_number,
      btw_number: client.btw_number,
      notes: client.notes,
      is_saved: true,
    });
    setDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingClient(null);
      setFormData(emptyClient);
      if (searchParams.has('new')) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('new');
        setSearchParams(nextParams, { replace: true });
      }
    }
  };

  const handleExportClients = () => {
    downloadExcelWorkbook(
      `klanten-${new Date().toISOString().slice(0, 10)}.xls`,
      [
        {
          name: 'Klanten',
          title: 'Klantenbestand',
          description: `${clients.length} klant${clients.length !== 1 ? 'en' : ''} geexporteerd op ${new Date().toLocaleDateString('nl-NL')}`,
          columns: clientExportColumns,
          rows: clients.map((client) => ({
            company_name: client.company_name,
            contact_name: client.contact_name,
            email: client.email,
            phone: client.phone,
            address: client.address,
            postal_code: client.postal_code,
            city: client.city,
            country: client.country,
            kvk_number: client.kvk_number,
            btw_number: client.btw_number,
            notes: client.notes,
          })),
        },
      ],
    );
  };

  const handleImportClients = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const csv = await file.text();
    const rows = parseCsv(csv);
    const importableRows = rows.filter((row) => row.company_name?.trim());

    for (const row of importableRows) {
      await createClient({
        company_name: row.company_name.trim(),
        contact_name: row.contact_name || null,
        email: row.email || null,
        phone: row.phone || null,
        address: row.address || null,
        postal_code: row.postal_code || null,
        city: row.city || null,
        country: row.country || 'Nederland',
        kvk_number: row.kvk_number || null,
        btw_number: row.btw_number || null,
        notes: row.notes || null,
        is_saved: true,
      });
    }

    event.target.value = '';
    toast({
      title: 'Import afgerond',
      description: `${importableRows.length} klant${importableRows.length !== 1 ? 'en' : ''} geimporteerd.`,
    });
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Klanten</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Beheer je klantenbestand
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportClients}
          />
          <Button variant="outline" className="w-full sm:w-auto" onClick={handleExportClients}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => importInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe klant
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? 'Klant bewerken' : 'Nieuwe klant'}
              </DialogTitle>
              <DialogDescription>
                Vul de gegevens van de klant in
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="company_name">Bedrijfsnaam *</Label>
                  <Input
                    id="company_name"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact_name">Contactpersoon</Label>
                  <Input
                    id="contact_name"
                    name="contact_name"
                    value={formData.contact_name || ''}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefoon</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone || ''}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kvk_number">KVK-nummer</Label>
                  <Input
                    id="kvk_number"
                    name="kvk_number"
                    value={formData.kvk_number || ''}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="btw_number">BTW-nummer</Label>
                  <Input
                    id="btw_number"
                    name="btw_number"
                    value={formData.btw_number || ''}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Adres</Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address || ''}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postcode</Label>
                  <Input
                    id="postal_code"
                    name="postal_code"
                    value={formData.postal_code || ''}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">Plaats</Label>
                  <Input
                    id="city"
                    name="city"
                    value={formData.city || ''}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Annuleren
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingClient ? 'Opslaan' : 'Toevoegen'}
                </Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Klantenlijst
          </CardTitle>
          <CardDescription>
            {filteredClients.length} van {clients.length} klant{clients.length !== 1 ? 'en' : ''}
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
                placeholder="Zoek op naam, contact, e-mail of notities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Filter dropdowns */}
            <div className="flex flex-wrap gap-2">
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <MapPin className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Plaats" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle plaatsen</SelectItem>
                  {cities.map(city => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
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

          {filteredClients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              {clients.length === 0 ? (
                <>
                  <p>Nog geen klanten</p>
                  <p className="text-sm">Voeg je eerste klant toe om te beginnen</p>
                </>
              ) : (
                <>
                  <p>Geen klanten gevonden</p>
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
                {filteredClients.map((client) => (
                  <div key={client.id} className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{client.company_name}</p>
                        {client.contact_name && (
                          <p className="text-sm text-muted-foreground">{client.contact_name}</p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(client)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Bewerken
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteConfirmClient(client)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Verwijderen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {(client.email || client.city) && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        {client.email && <p>{client.email}</p>}
                        {client.city && <p>{client.city}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bedrijf</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Plaats</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.company_name}</TableCell>
                        <TableCell>{client.contact_name || '-'}</TableCell>
                        <TableCell>{client.email || '-'}</TableCell>
                        <TableCell>{client.city || '-'}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(client)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Bewerken
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeleteConfirmClient(client)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Verwijderen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      <AlertDialog open={!!deleteConfirmClient} onOpenChange={(open) => !open && setDeleteConfirmClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Klant verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je <strong>{deleteConfirmClient?.company_name}</strong> wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmClient) {
                  deleteClient(deleteConfirmClient.id);
                  setDeleteConfirmClient(null);
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
