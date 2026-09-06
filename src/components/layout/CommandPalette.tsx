import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  BarChart3,
  Calendar,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Receipt,
  Repeat2,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useClients } from '@/hooks/useClients';
import { useExpenses } from '@/hooks/useExpenses';
import { useInvoices } from '@/hooks/useInvoices';
import { useOtherIncome } from '@/hooks/useOtherIncome';
import { useProjects } from '@/hooks/useProjects';
import { useSubscriptions } from '@/hooks/useSubscriptions';

const navigationItems = [
  { label: 'Dashboard', url: '/', icon: LayoutDashboard },
  { label: 'Agenda', url: '/calendar', icon: Calendar },
  { label: 'Projecten', url: '/projects', icon: FolderKanban },
  { label: 'Facturen', url: '/invoices', icon: FileText },
  { label: 'Abonnementen', url: '/subscriptions', icon: Repeat2 },
  { label: 'Inkomsten', url: '/income', icon: Banknote },
  { label: 'Klanten', url: '/clients', icon: Users },
  { label: 'Uitgaven', url: '/expenses', icon: Receipt },
  { label: 'Rapporten', url: '/reports', icon: BarChart3 },
  { label: 'Instellingen', url: '/settings', icon: Settings },
];

const quickActions = [
  { label: 'Nieuwe factuur', url: '/invoices/new', icon: Plus },
  { label: 'Nieuwe klant', url: '/clients?new=1', icon: Users },
  { label: 'Nieuwe uitgave', url: '/expenses?new=1', icon: Receipt },
  { label: 'Nieuwe inkomst', url: '/income?new=1', icon: Banknote },
  { label: 'Nieuw abonnement', url: '/subscriptions?new=1', icon: Repeat2 },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { invoices } = useInvoices();
  const { clients } = useClients();
  const { expenses } = useExpenses();
  const { projects } = useProjects();
  const { otherIncome } = useOtherIncome();
  const { subscriptions } = useSubscriptions();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const searchableItems = useMemo(() => {
    return [
      ...invoices.slice(0, 20).map((invoice) => ({
        id: `invoice-${invoice.id}`,
        label: `${invoice.invoice_number} ${invoice.client_company_name || ''}`,
        description: invoice.client_company_name || 'Factuur',
        url: `/invoices/${invoice.id}`,
        icon: FileText,
      })),
      ...clients.slice(0, 20).map((client) => ({
        id: `client-${client.id}`,
        label: client.company_name,
        description: client.email || client.city || 'Klant',
        url: '/clients',
        icon: Users,
      })),
      ...projects.slice(0, 20).map((project) => ({
        id: `project-${project.id}`,
        label: project.name,
        description: project.client_name || project.client?.company_name || 'Project',
        url: `/projects/${project.id}`,
        icon: FolderKanban,
      })),
      ...expenses.slice(0, 20).map((expense) => ({
        id: `expense-${expense.id}`,
        label: expense.vendor_name,
        description: expense.description || expense.category,
        url: '/expenses',
        icon: Receipt,
      })),
      ...otherIncome.slice(0, 20).map((income) => ({
        id: `income-${income.id}`,
        label: income.source_name,
        description: income.description || income.category,
        url: '/income',
        icon: Banknote,
      })),
      ...subscriptions.slice(0, 20).map((subscription) => ({
        id: `subscription-${subscription.id}`,
        label: `${subscription.service_name} ${subscription.plan_name}`,
        description: subscription.client_name || 'Abonnement',
        url: '/subscriptions',
        icon: Repeat2,
      })),
    ];
  }, [clients, expenses, invoices, otherIncome, projects, subscriptions]);

  const runCommand = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-9 w-full justify-start gap-2 text-muted-foreground sm:w-72"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Zoeken...</span>
        <CommandShortcut className="hidden sm:inline">Ctrl K</CommandShortcut>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Zoek klanten, facturen, projecten..." />
        <CommandList>
          <CommandEmpty>Geen resultaten gevonden.</CommandEmpty>

          <CommandGroup heading="Snelle acties">
            {quickActions.map((item) => (
              <CommandItem key={item.url} value={item.label} onSelect={() => runCommand(item.url)}>
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Navigatie">
            {navigationItems.map((item) => (
              <CommandItem key={item.url} value={item.label} onSelect={() => runCommand(item.url)}>
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Resultaten">
            {searchableItems.map((item) => (
              <CommandItem key={item.id} value={`${item.label} ${item.description}`} onSelect={() => runCommand(item.url)}>
                <item.icon className="mr-2 h-4 w-4" />
                <span className="truncate">{item.label}</span>
                <span className="ml-auto max-w-32 truncate text-xs text-muted-foreground">{item.description}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
