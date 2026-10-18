import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AuthPage } from "@/components/auth/AuthPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { lazy, Suspense } from "react";
import { getOAuthReturnToFromLocation, getSafeOAuthReturnTo } from "@/lib/auth-redirect";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoiceNew = lazy(() => import("./pages/InvoiceNew"));
const InvoiceEdit = lazy(() => import("./pages/InvoiceEdit"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const Clients = lazy(() => import("./pages/Clients"));
const Expenses = lazy(() => import("./pages/Expenses"));
const OtherIncome = lazy(() => import("./pages/OtherIncome"));
const BankPayments = lazy(() => import("./pages/BankPayments"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const Reports = lazy(() => import("./pages/Reports"));
const TaxFilings = lazy(() => import("./pages/TaxFilings"));
const Settings = lazy(() => import("./pages/Settings"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Mileage = lazy(() => import("./pages/Mileage"));

const queryClient = new QueryClient();

function ThemeInitializer({ children }: { children: React.ReactNode }) {
  // Initialize theme on mount
  useTheme();
  return <>{children}</>;
}

// Remember the requested page so the user lands there after logging in.
function RedirectToAuth() {
  const location = useLocation();
  return <Navigate to="/auth" replace state={{ from: getOAuthReturnToFromLocation(location) }} />;
}

function RedirectFromAuth() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return <Navigate to={getSafeOAuthReturnTo(from)} replace />;
}

function PageLoader({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div className={`${fullScreen ? "min-h-screen" : "min-h-[50vh]"} flex items-center justify-center`}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader fullScreen />;
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader fullScreen />}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<RedirectToAuth />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <AppLayout>
      <ErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/new" element={<InvoiceNew />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/invoices/:id/edit" element={<InvoiceEdit />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/mileage" element={<Mileage />} />
            <Route path="/income" element={<OtherIncome />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/payments" element={<BankPayments />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/tax-filings" element={<TaxFilings />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth" element={<RedirectFromAuth />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AppLayout>
  );
}

const App = () => (
  <ErrorBoundary>
    <ThemeInitializer>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeInitializer>
  </ErrorBoundary>
);

export default App;
