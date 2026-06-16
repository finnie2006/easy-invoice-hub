import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
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
  LayoutDashboard,
  FileText,
  Users,
  Receipt,
  Banknote,
  BarChart3,
  Settings,
  LogOut,
  Calendar,
  Briefcase,
  FolderKanban,
  FileCheck,
  Moon,
  Sun,
} from 'lucide-react';

const quickActions = [
  { title: 'Nieuwe factuur', url: '/invoices/new', icon: FileText },
  { title: 'Nieuwe klant', url: '/clients?new=1', icon: Users },
  { title: 'Nieuwe uitgave', url: '/expenses?new=1', icon: Receipt },
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
      { title: 'Inkomsten', url: '/income', icon: Banknote },
      { title: 'Uitgaven', url: '/expenses', icon: Receipt },
      { title: 'Aangiftes', url: '/tax-filings', icon: FileCheck },
    ],
  },
  {
    label: 'Inzicht',
    items: [
      { title: 'Rapporten', url: '/reports', icon: BarChart3 },
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
  const { isMobile, setOpenMobile } = useSidebar();

  const themeKey = profile?.panel_color_theme || 'default';
  const themeStyles = panelThemeStyles[themeKey] || panelThemeStyles.default;

  const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
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
    if (url === '/') {
      return location.pathname === '/';
    }

    return location.pathname === url || location.pathname.startsWith(`${url}/`);
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

      <SidebarContent>
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
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2" style={{ borderTop: `1px solid ${themeStyles.border}` }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(nextTheme)}
          className="w-full justify-start text-sidebar-foreground hover:text-sidebar-foreground"
          style={{ ['--hover-bg' as string]: themeStyles.accent }}
          title={`Thema: ${theme}`}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 mr-2" />
          ) : (
            <Moon className="h-4 w-4 mr-2" />
          )}
          <span>
            {theme === 'light' && 'Licht'}
            {theme === 'dark' && 'Donker'}
            {theme === 'system' && 'Systeem'}
          </span>
        </Button>
        
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
