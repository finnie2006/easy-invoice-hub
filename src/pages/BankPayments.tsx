import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Landmark,
  Loader2,
  PlugZap,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import { rabobank } from '@/api/client';
import { useInvoices } from '@/hooks/useInvoices';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RabobankStatus {
  configured: boolean;
  missing: string[];
  configErrors: string[];
  mode: 'premium' | 'psd2';
  scopes: string;
  redirectUri: string;
  notificationPushUri: string;
  connected: boolean;
  connection: null | {
    status: string;
    scope: string | null;
    consentedOn: string | null;
    accessTokenExpiresAt: string | null;
    refreshTokenExpiresAt: string | null;
    updatedAt: string | null;
  };
  lastNotification: null | {
    notificationId: string | null;
    subscriptionId: string | null;
    notificationType: string | null;
    createdAt: string | null;
    processedAt: string | null;
  };
}

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('nl-NL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const getRabobankErrorMessage = (error: unknown) => {
  const responseData = (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response
  )
    ? error.response.data
    : null;

  if (responseData && typeof responseData === 'object') {
    const missing = Array.isArray(responseData.missing) ? responseData.missing : [];
    const configErrors = Array.isArray(responseData.configErrors) ? responseData.configErrors : [];
    const details = [...missing, ...configErrors].filter((value): value is string => typeof value === 'string');

    if (details.length > 0) {
      return details.join(', ');
    }

    if ('error' in responseData && typeof responseData.error === 'string') {
      return responseData.error;
    }
  }

  return error instanceof Error ? error.message : 'Controleer de Rabobank configuratie.';
};

export default function BankPayments() {
  const { invoices, isLoading: invoicesLoading } = useInvoices();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusQuery = useQuery({
    queryKey: ['rabobank-status'],
    queryFn: async () => {
      const response = await rabobank.getStatus();
      return response.data as RabobankStatus;
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await rabobank.connect();
      return response.data as { authorizationUrl: string };
    },
    onSuccess: ({ authorizationUrl }) => {
      window.location.assign(authorizationUrl);
    },
    onError: (error) => {
      toast({
        title: 'Rabobank koppelen mislukt',
        description: getRabobankErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await rabobank.disconnect();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rabobank-status'] });
      toast({
        title: 'Rabobank losgekoppeld',
        description: 'De lokale koppeling en opgeslagen tokens zijn verwijderd.',
      });
    },
  });

  useEffect(() => {
    const result = searchParams.get('rabobank');
    if (!result) return;

    const messages: Record<string, { title: string; description: string; variant?: 'destructive' }> = {
      connected: {
        title: 'Rabobank gekoppeld',
        description: 'De autorisatie is opgeslagen. Realtime meldingen kunnen nu via Rabo ANS binnenkomen.',
      },
      denied: {
        title: 'Autorisatie afgebroken',
        description: 'Rabobank heeft geen toestemming teruggegeven.',
        variant: 'destructive',
      },
      invalid_state: {
        title: 'Ongeldige autorisatie',
        description: 'De beveiligingscode was verlopen of ongeldig.',
        variant: 'destructive',
      },
      token_failed: {
        title: 'Token ophalen mislukt',
        description: 'Rabobank gaf wel een code terug, maar de server kon die niet omwisselen.',
        variant: 'destructive',
      },
    };

    const message = messages[result] || {
      title: 'Rabobank callback mislukt',
      description: 'De terugkoppeling van Rabobank kon niet worden verwerkt.',
      variant: 'destructive' as const,
    };

    toast(message);
    queryClient.invalidateQueries({ queryKey: ['rabobank-status'] });

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('rabobank');
    setSearchParams(nextParams, { replace: true });
  }, [queryClient, searchParams, setSearchParams, toast]);

  const status = statusQuery.data;
  const openInvoiceCount = invoices.filter(
    (invoice) => invoice.status !== 'paid' && invoice.status !== 'cancelled',
  ).length;
  const payableInvoiceCount = invoices.filter(
    (invoice) =>
      invoice.status !== 'paid' &&
      invoice.status !== 'cancelled' &&
      (invoice.payment_reference || invoice.invoice_number),
  ).length;
  const isLoading = invoicesLoading || statusQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Bankbetalingen</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Autoriseer Rabobank en verwerk betaalmeldingen automatisch
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {status?.connected ? (
            <Button
              variant="outline"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4 mr-2" />
              )}
              Loskoppelen
            </Button>
          ) : (
            <Button
              onClick={() => connectMutation.mutate()}
              disabled={!status?.configured || connectMutation.isPending}
            >
              {connectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Rabobank koppelen
            </Button>
          )}
        </div>
      </div>

      {!status?.configured && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Rabobank is nog niet geconfigureerd</AlertTitle>
          <AlertDescription>
            {[...(status?.missing || []), ...(status?.configErrors || [])].join(', ') || 'Controleer de Rabobank env-vars'}.
            Daarna wordt de koppelknop actief.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {status?.connected ? 'Gekoppeld' : 'Niet gekoppeld'}
              {status?.connected && <CheckCircle2 className="h-5 w-5 text-success" />}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open facturen</CardDescription>
            <CardTitle className="text-2xl">{openInvoiceCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Matchbaar</CardDescription>
            <CardTitle className="text-2xl">{payableInvoiceCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rabo API</CardDescription>
            <CardTitle className="text-2xl capitalize">{status?.mode || 'premium'}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Rabobank autorisatie
          </CardTitle>
          <CardDescription>
            De gebruiker wordt naar Rabobank gestuurd en keert daarna terug naar deze app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 font-medium">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                Consent
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {status?.connected
                  ? `Actief sinds ${formatDateTime(status.connection?.consentedOn)}`
                  : 'Nog geen toestemming opgeslagen.'}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Tokenopslag
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Tokens blijven versleuteld op de server en worden niet naar de browser gestuurd.
              </p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex flex-col gap-1 rounded-md bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Redirect URI</span>
              <code className="break-all text-xs">{status?.redirectUri || '-'}</code>
            </div>
            <div className="flex flex-col gap-1 rounded-md bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Scopes</span>
              <code className="break-all text-xs">{status?.scopes || '-'}</code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="h-5 w-5" />
            Automatische meldingen
          </CardTitle>
          <CardDescription>
            Gebruik deze URL als pushUri bij de Rabo Account Notification Service.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3">
            <code className="break-all text-xs">{status?.notificationPushUri || '-'}</code>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Laatste Rabo melding</p>
              <p className="text-sm text-muted-foreground">
                {status?.lastNotification
                  ? formatDateTime(status.lastNotification.createdAt)
                  : 'Nog geen melding ontvangen'}
              </p>
            </div>
            <Badge variant={status?.lastNotification ? 'outline' : 'secondary'}>
              {status?.lastNotification?.notificationType || 'Wacht op ANS'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Banknote className="h-4 w-4" />
        <AlertTitle>Volgende stap na autorisatie</AlertTitle>
        <AlertDescription>
          Rabobank ANS vereist daarnaast een Developer Portal abonnement, mTLS en request signing voor het
          ophalen van transactiedetails. Deze app heeft nu de consent-flow en push-endpoint klaarstaan.
        </AlertDescription>
      </Alert>
    </div>
  );
}
