import { Bell, BellOff, Loader2, Send, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function PushNotificationSettings() {
  const {
    config,
    isLoadingConfig,
    support,
    permission,
    isSubscribed,
    enablePush,
    disablePush,
    sendTest,
    isEnabling,
    isDisabling,
    isSendingTest,
  } = usePushNotifications();

  const disabled = !support.supported || !config?.enabled || isLoadingConfig || isEnabling || isDisabling;
  const statusText = !support.supported
    ? support.reason
    : !config?.enabled
      ? 'Pushmeldingen zijn nog niet geconfigureerd op de server.'
      : isSubscribed
        ? 'Actief op dit apparaat.'
        : permission === 'denied'
          ? 'Geblokkeerd in je browserinstellingen.'
          : 'Nog niet actief op dit apparaat.';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          App en meldingen
        </CardTitle>
        <CardDescription>
          Installeer MijnZaak als app en ontvang betaaltermijnmeldingen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="space-y-0.5">
            <Label htmlFor="push-reminders">Factuurherinneringen</Label>
            <p className="text-sm text-muted-foreground">
              Melding wanneer een factuur nog op verzonden staat na de vervaldatum.
            </p>
          </div>
          <Switch
            id="push-reminders"
            checked={isSubscribed}
            disabled={disabled || permission === 'denied'}
            onCheckedChange={(checked) => (checked ? enablePush() : disablePush())}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isLoadingConfig ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSubscribed ? (
              <Bell className="h-4 w-4 text-primary" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
            <span>{statusText}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => sendTest()}
            disabled={!isSubscribed || isSendingTest}
          >
            {isSendingTest ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Testmelding
          </Button>
        </div>

        {!config?.persistentKeys && config?.enabled && (
          <p className="text-xs text-muted-foreground">
            De server gebruikt tijdelijke VAPID keys. Stel vaste keys in via de omgeving voor blijvende pushabonnementen.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
