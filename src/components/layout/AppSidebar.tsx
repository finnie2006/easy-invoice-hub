import { useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/hooks/useTheme';
import { useBtwPeriods } from '@/hooks/useBtwPeriods';
import { useInvoices } from '@/hooks/useInvoices';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { getSubscriptionBillingState } from '@/lib/subscriptions';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  FileText,
  Users,
  Receipt,
  Banknote,
  Landmark,
  BarChart3,
  Settings,
  LogOut,
  Calendar,
  Briefcase,
  FolderKanban,
  FileCheck,
  Moon,
  Sun,
  ChevronDown,
  Monitor,
  Repeat2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const quickActions = [
  { title: 'Nieuwe factuur', url: '/invoices/new', icon: FileText },
  { title: 'Nieuwe klant', url: '/clients?new=1', icon: Users },
  { title: 'Nieuwe uitgave', url: '/expenses?new=1', icon: Receipt },
];

const themeOptions: Array<{ value: Theme; label: string; icon: LucideIcon }> = [
  { value: 'light', label: 'Licht', icon: Sun },
  { value: 'dark', label: 'Donker', icon: Moon },
  { value: 'system', label: 'Systeem', icon: Monitor },
];

const menuGroups = [
  {
    label: 'Werk',
    items: [
      { title: 'Dashboard', url: '/', icon: LayoutDashboard },
      { title: 'Agenda', url: '/calendar', icon: Calendar },
      { title: 'Projecten', url: '/projects', icon: FolderKanban },
      { title: 'Klanten', url: '/clients', icon: Users },
    ],
  },
  {
    label: 'Administratie',
    items: [
      { title: 'Facturen', url: '/invoices', icon: FileText },
      { title: 'Concepten', url: '/invoices?status=draft', icon: FileText },
      { title: 'Abonnementen', url: '/subscriptions', icon: Repeat2 },
      { title: 'Inkomsten', url: '/income', icon: Banknote },
      { title: 'Betalingen', url: '/payments', icon: Landmark },
      { title: 'Uitgaven', url: '/expenses', icon: Receipt },
      { title: 'Aangiftes', url: '/tax-filings', icon: FileCheck },
    ],
  },
  {
    label: 'Rapportage',
    items: [
      { title: 'Rapporten', url: '/reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Beheer',
    items: [
      { title: 'Instellingen', url: '/settings', icon: Settings },
    ],
  },
];

const panelThemeStyles: Record<string, { bg: string; accent: string; border: string }> = {
  default: {
    bg: 'hsl(222, 47%, 11%)',
    accent: 'hsl(222, 47%, 18%)',
    border: 'hsl(222, 47%, 18%)',
  },
  slate: {
    bg: 'hsl(217, 33%, 17%)',
    accent: 'hsl(217, 33%, 24%)',
    border: 'hsl(217, 33%, 24%)',
  },
  zinc: {
    bg: 'hsl(240, 5%, 17%)',
    accent: 'hsl(240, 5%, 24%)',
    border: 'hsl(240, 5%, 24%)',
  },
  neutral: {
    bg: 'hsl(0, 0%, 17%)',
    accent: 'hsl(0, 0%, 24%)',
    border: 'hsl(0, 0%, 24%)',
  },
  blue: {
    bg: 'hsl(224, 71%, 15%)',
    accent: 'hsl(224, 71%, 22%)',
    border: 'hsl(224, 71%, 22%)',
  },
  indigo: {
    bg: 'hsl(243, 47%, 18%)',
    accent: 'hsl(243, 47%, 25%)',
    border: 'hsl(243, 47%, 25%)',
  },
};

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { appName, profile } = useProfile();
  const { theme, setTheme } = useTheme();
  const { invoices, overdueInvoices } = useInvoices();
  const { subscriptions } = useSubscriptions();
  const { btwPeriods } = useBtwPeriods();
  const { isMobile, setOpenMobile } = useSidebar();

  const themeKey = profile?.panel_color_theme || 'default';
  const themeStyles = panelThemeStyles[themeKey] || panelThemeStyles.default;
  const selectedTheme = themeOptions.find((option) => option.value === theme) ?? themeOptions[2];
  const SelectedThemeIcon = selectedTheme.icon;
  const draftInvoiceCount = invoices.filter((invoice) => invoice.status === 'draft').length;
  const dueSubscriptionCount = subscriptions.filter((subscription) => {
    const state = getSubscriptionBillingState(subscription);
    return state === 'overdue' || state === 'due_today';
  }).length;
  const openBtwPeriodCount = btwPeriods.filter((period) => !period.is_closed).length;
  const recentInvoices = useMemo(() => {
    return [...invoices]
      .sort((a, b) => {
        const aDate = new Date(a.updated_at || a.created_at).getTime();
        const bDate = new Date(b.updated_at || b.created_at).getTime();
        return bDate - aDate;
      })
      .slice(0, 3);
  }, [invoices]);

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleSignOut = () => {
    closeMobileSidebar();
    signOut();
  };

  const isActiveRoute = (url: string) => {
    const [path, queryString] = url.split('?');

    if (path === '/') {
      return location.pathname === '/';
    }

    const isPathActive = location.pathname === path || location.pathname.startsWith(`${path}/`);
    if (!isPathActive) {
      return false;
    }

    const currentParams = new URLSearchParams(location.search);

    if (!queryString) {
      return isPathActive && !(path === '/invoices' && currentParams.get('status') === 'draft');
    }

    const itemParams = new URLSearchParams(queryString);
    return Array.from(itemParams.entries()).every(
      ([key, value]) => currentParams.get(key) === value,
    );
  };

  const getMenuBadges = (title: string) => {
    if (title === 'Facturen' && overdueInvoices.length > 0) {
      return [{ label: `${overdueInvoices.length} verlopen`, variant: 'danger' as const }];
    }

    if (title === 'Concepten' && draftInvoiceCount > 0) {
      return [{ label: draftInvoiceCount.toString(), variant: 'muted' as const }];
    }

    if (title === 'Abonnementen' && dueSubscriptionCount > 0) {
      return [{ label: `${dueSubscriptionCount} nodig`, variant: 'danger' as const }];
    }

    if (title === 'Aangiftes' && openBtwPeriodCount > 0) {
      return [{ label: `${openBtwPeriodCount} open`, variant: 'muted' as const }];
    }

    return [];
  };

  return (
    <Sidebar
      className="transition-colors duration-200"
      style={{
        backgroundColor: themeStyles.bg,
      } as React.CSSProperties}
    >
      <SidebarHeader className="p-4" style={{ borderBottom: `1px solid ${themeStyles.border}` }}>
        <Link to="/" className="flex items-center gap-2" onClick={closeMobileSidebar}>
          <div className="p-1.5 bg-sidebar-primary rounded-lg">
            <Briefcase className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-sidebar-foreground truncate">{appName}</span>
        </Link>
      </SidebarHeader>

      <SidebarContent
        className="app-sidebar-scrollbar"
        style={{
          '--app-sidebar-scrollbar-thumb': themeStyles.accent,
          '--app-sidebar-scrollbar-thumb-hover': themeStyles.border,
        } as React.CSSProperties}
      >
        <SidebarGroup>
          <SidebarGroupLabel>Snelle acties</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {quickActions.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <Link to={item.url} onClick={closeMobileSidebar}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator style={{ backgroundColor: themeStyles.border }} />

        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActiveRoute(item.url)}
                      tooltip={item.title}
                    >
                      <Link to={item.url} onClick={closeMobileSidebar}>
                        <item.icon className="h-4 w-4" />
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        {getMenuBadges(item.title).map((badge) => (
                          <span
                            key={badge.label}
                            className={
                              badge.variant === 'danger'
                                ? 'ml-auto rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-medium leading-none text-destructive-foreground'
                                : 'ml-auto rounded-md bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium leading-none text-sidebar-accent-foreground'
                            }
                          >
                            {badge.label}
                          </span>
                        ))}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {recentInvoices.length > 0 && (
          <>
            <SidebarSeparator style={{ backgroundColor: themeStyles.border }} />
            <SidebarGroup>
              <SidebarGroupLabel>Recent</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {recentInvoices.map((invoice) => (
                    <SidebarMenuItem key={invoice.id}>
                      <SidebarMenuButton asChild size="sm" tooltip={invoice.invoice_number}>
                        <Link to={`/invoices/${invoice.id}`} onClick={closeMobileSidebar}>
                          <FileText className="h-4 w-4" />
                          <span className="min-w-0 flex-1 truncate">
                            {invoice.invoice_number}
                          </span>
                          <span className="max-w-20 truncate text-xs text-sidebar-foreground/60">
                            {invoice.client_company_name || 'Factuur'}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2" style={{ borderTop: `1px solid ${themeStyles.border}` }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground hover:text-sidebar-foreground"
              style={{ ['--hover-bg' as string]: themeStyles.accent }}
              title={`Thema: ${selectedTheme.label}`}
            >
              <SelectedThemeIcon className="h-4 w-4 mr-2" />
              <span className="flex-1 text-left">{selectedTheme.label}</span>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-44">
            <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
              {themeOptions.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  <option.icon className="mr-2 h-4 w-4" />
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="text-xs text-sidebar-foreground/60 truncate">
          {user?.email}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start text-sidebar-foreground hover:text-sidebar-foreground"
          style={{ ['--hover-bg' as string]: themeStyles.accent }}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Uitloggen
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
