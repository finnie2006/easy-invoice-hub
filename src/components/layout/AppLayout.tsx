import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { CommandPalette } from './CommandPalette';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex min-h-14 flex-col gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-sm supports-backdrop-filter:bg-background/70 sm:h-14 sm:flex-row sm:items-center sm:px-6 sm:py-0 print:hidden">
          <SidebarTrigger />
          <CommandPalette />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
