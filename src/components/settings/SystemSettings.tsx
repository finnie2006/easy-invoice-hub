import { useState, useEffect, useMemo } from 'react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Server, Mail, Key, Save, Loader2, Info, Send } from 'lucide-react';
import { appSettings as appSettingsApi } from '@/api/client';
import { useToast } from '@/hooks/use-toast';

interface SystemConfig {
  // Authentik OAuth
  authentik_url: string;
  authentik_client_id: string;
  authentik_client_secret: string;
  authentik_redirect_uri: string;
  // SMTP
  smtp_host: string;
  smtp_port: string;
  smtp_security: string;
  smtp_allow_self_signed: string;
  smtp_user: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_reply_to: string;
}

type SecretKey = 'authentik_client_secret' | 'smtp_password';

const SECRET_KEYS: SecretKey[] = ['authentik_client_secret', 'smtp_password'];

const defaultConfig: SystemConfig = {
  authentik_url: '',
  authentik_client_id: '',
  authentik_client_secret: '',
  authentik_redirect_uri: '',
  smtp_host: '',
  smtp_port: '587',
  smtp_security: 'auto',
  smtp_allow_self_signed: 'false',
  smtp_user: '',
  smtp_password: '',
  smtp_from_email: '',
  smtp_from_name: '',
  smtp_reply_to: '',
};

const SMTP_KEYS = Object.keys(defaultConfig).filter((key) => key.startsWith('smtp_')) as (keyof SystemConfig)[];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateConfig(config: SystemConfig): Partial<Record<keyof SystemConfig, string>> {
  const errors: Partial<Record<keyof SystemConfig, string>> = {};
  const port = Number(config.smtp_port);

  if (config.smtp_port.trim() !== '' && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    errors.smtp_port = 'Kies een poort tussen 1 en 65535';
  }
  if (config.smtp_from_email.trim() !== '' && !EMAIL_PATTERN.test(config.smtp_from_email.trim())) {
    errors.smtp_from_email = 'Ongeldig e-mailadres';
  }
  if (config.smtp_reply_to.trim() !== '' && !EMAIL_PATTERN.test(config.smtp_reply_to.trim())) {
    errors.smtp_reply_to = 'Ongeldig e-mailadres';
  }

  return errors;
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as { response?: { data?: { error?: string } }; message?: string };
  return err?.response?.data?.error || err?.message || fallback;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

export default function SystemSettings() {
  const { isAdmin, isLoading: isLoadingRole } = useAppSettings();
  const { toast } = useToast();
  const [config, setConfig] = useState<SystemConfig>(defaultConfig);
  const [savedConfig, setSavedConfig] = useState<SystemConfig>(defaultConfig);
  // Secrets are never sent to the browser; we only know whether one is stored.
  const [secretsSet, setSecretsSet] = useState<Record<SecretKey, boolean>>({
    authentik_client_secret: false,
    smtp_password: false,
  });
  const [secretsToClear, setSecretsToClear] = useState<Set<SecretKey>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await appSettingsApi.getAll();
        const data = response.data as Array<{ setting_key: string; setting_value: unknown; is_set?: boolean }>;

        const newConfig = { ...defaultConfig };
        const newSecretsSet = { authentik_client_secret: false, smtp_password: false };
        data?.forEach((row) => {
          const key = row.setting_key as keyof SystemConfig;
          if (SECRET_KEYS.includes(key as SecretKey)) {
            newSecretsSet[key as SecretKey] = Boolean(row.is_set);
            return;
          }
          if (key in newConfig && row.setting_value !== null && row.setting_value !== undefined) {
            newConfig[key] = String(row.setting_value);
          }
        });

        setConfig(newConfig);
        setSavedConfig(newConfig);
        setSecretsSet(newSecretsSet);
      } catch (error) {
        console.error('Error loading system settings:', error);
        toast({
          title: 'Fout',
          description: getErrorMessage(error, 'De systeeminstellingen konden niet worden geladen.'),
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [toast]);

  const errors = useMemo(() => validateConfig(config), [config]);
  const hasErrors = Object.keys(errors).length > 0;
  const isDirty = useMemo(
    () => secretsToClear.size > 0
      || (Object.keys(config) as (keyof SystemConfig)[]).some((key) => config[key] !== savedConfig[key]),
    [config, savedConfig, secretsToClear],
  );
  const isSmtpDirty = SMTP_KEYS.some((key) => config[key] !== savedConfig[key]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
    if (SECRET_KEYS.includes(name as SecretKey) && value) {
      setSecretsToClear(prev => {
        const next = new Set(prev);
        next.delete(name as SecretKey);
        return next;
      });
    }
  };

  const setField = (name: keyof SystemConfig, value: string) => {
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleClearSecret = (key: SecretKey) => {
    setConfig(prev => ({ ...prev, [key]: '' }));
    setSecretsToClear(prev => new Set(prev).add(key));
  };

  const handleSave = async () => {
    if (hasErrors) return;

    setIsSaving(true);
    try {
      const settingsToSave = (Object.keys(config) as (keyof SystemConfig)[]).map((key) => {
        if (key === 'smtp_allow_self_signed') {
          return { key, value: config[key] === 'true' };
        }
        if (SECRET_KEYS.includes(key as SecretKey)) {
          // Empty means "unchanged" on the server unless explicitly cleared.
          return { key, value: config[key], clear: secretsToClear.has(key as SecretKey) };
        }
        return { key, value: config[key].trim() };
      });
      await appSettingsApi.upsertMany(settingsToSave);

      setSecretsSet(prev => {
        const next = { ...prev };
        SECRET_KEYS.forEach((key) => {
          if (secretsToClear.has(key)) next[key] = false;
          else if (config[key]) next[key] = true;
        });
        return next;
      });
      const cleared = { ...config, authentik_client_secret: '', smtp_password: '' };
      setConfig(cleared);
      setSavedConfig(cleared);
      setSecretsToClear(new Set());

      toast({
        title: 'Instellingen opgeslagen',
        description: 'De systeeminstellingen zijn succesvol bijgewerkt.',
      });
    } catch (error) {
      console.error('Error saving system settings:', error);
      toast({
        title: 'Fout',
        description: getErrorMessage(error, 'Er is een fout opgetreden bij het opslaan van de instellingen.'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    try {
      const smtpConfig = Object.fromEntries(SMTP_KEYS.map((key) => [key, config[key]]));
      const response = await appSettingsApi.testSmtp(smtpConfig, testRecipient.trim() || undefined);
      toast({
        title: 'Testmail verstuurd',
        description: `Er is een testmail verstuurd naar ${response.data?.recipient}.`,
      });
    } catch (error) {
      console.error('Error sending SMTP test email:', error);
      toast({
        title: 'Testmail mislukt',
        description: getErrorMessage(error, 'Onbekende fout'),
        variant: 'destructive',
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const secretPlaceholder = (key: SecretKey) => {
    if (secretsToClear.has(key)) return 'Wordt gewist bij opslaan';
    return secretsSet[key] ? '•••••••• (ongewijzigd)' : 'Niet ingesteld';
  };

  const renderSecretLabel = (key: SecretKey, label: string) => (
    <div className="flex items-center justify-between">
      <Label htmlFor={key}>{label}</Label>
      {secretsSet[key] && !secretsToClear.has(key) && (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-destructive underline-offset-2 hover:underline"
          onClick={() => handleClearSecret(key)}
        >
          Wissen
        </button>
      )}
    </div>
  );

  const testRecipientInvalid = testRecipient.trim() !== '' && !EMAIL_PATTERN.test(testRecipient.trim());

  if (isLoadingRole || isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Systeeminstellingen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Server className="h-4 w-4" />
            <AlertDescription>
              Je hebt geen beheerrechten om deze instellingen te bekijken.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Systeeminstellingen
          <Badge variant="secondary">Admin</Badge>
        </CardTitle>
        <CardDescription>
          Configureer OAuth en e-mail instellingen voor self-hosting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Authentik OAuth */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Authentik OAuth</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Configureer Authentik als externe authenticatie provider
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="authentik_url">Authentik URL</Label>
              <Input
                id="authentik_url"
                name="authentik_url"
                value={config.authentik_url}
                onChange={handleChange}
                placeholder="https://auth.yourdomain.com/application/o/your-provider/"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="authentik_client_id">Client ID</Label>
              <Input
                id="authentik_client_id"
                name="authentik_client_id"
                value={config.authentik_client_id}
                onChange={handleChange}
                placeholder="your-client-id"
              />
            </div>

            <div className="space-y-2">
              {renderSecretLabel('authentik_client_secret', 'Client Secret')}
              <Input
                id="authentik_client_secret"
                name="authentik_client_secret"
                type="password"
                autoComplete="new-password"
                value={config.authentik_client_secret}
                onChange={handleChange}
                placeholder={secretPlaceholder('authentik_client_secret')}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="authentik_redirect_uri">Redirect URI</Label>
              <Input
                id="authentik_redirect_uri"
                name="authentik_redirect_uri"
                value={config.authentik_redirect_uri}
                onChange={handleChange}
                placeholder="https://app.yourdomain.com/auth/callback"
              />
            </div>
          </div>
        </div>

        {/* SMTP Settings */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">SMTP E-mail</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Configureer SMTP voor het verzenden van facturen per e-mail
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtp_host">SMTP Host</Label>
              <Input
                id="smtp_host"
                name="smtp_host"
                value={config.smtp_host}
                onChange={handleChange}
                placeholder="smtp.yourdomain.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_port">SMTP Port</Label>
              <Input
                id="smtp_port"
                name="smtp_port"
                type="number"
                min={1}
                max={65535}
                value={config.smtp_port}
                onChange={handleChange}
                placeholder="587"
                aria-invalid={Boolean(errors.smtp_port)}
              />
              <FieldError message={errors.smtp_port} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_security">Beveiliging</Label>
              <Select value={config.smtp_security} onValueChange={(value) => setField('smtp_security', value)}>
                <SelectTrigger id="smtp_security">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatisch (SSL op 465, anders STARTTLS indien mogelijk)</SelectItem>
                  <SelectItem value="starttls">STARTTLS (verplicht)</SelectItem>
                  <SelectItem value="ssl">SSL/TLS</SelectItem>
                  <SelectItem value="none">Geen versleuteling</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2 self-end">
              <div>
                <Label htmlFor="smtp_allow_self_signed">Self-signed certificaat toestaan</Label>
                <p className="text-xs text-muted-foreground">Alleen voor eigen mailservers zonder geldig certificaat</p>
              </div>
              <Switch
                id="smtp_allow_self_signed"
                checked={config.smtp_allow_self_signed === 'true'}
                onCheckedChange={(checked) => setField('smtp_allow_self_signed', checked ? 'true' : 'false')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_user">Gebruikersnaam</Label>
              <Input
                id="smtp_user"
                name="smtp_user"
                autoComplete="off"
                value={config.smtp_user}
                onChange={handleChange}
                placeholder="user@yourdomain.com"
              />
            </div>

            <div className="space-y-2">
              {renderSecretLabel('smtp_password', 'Wachtwoord')}
              <Input
                id="smtp_password"
                name="smtp_password"
                type="password"
                autoComplete="new-password"
                value={config.smtp_password}
                onChange={handleChange}
                placeholder={secretPlaceholder('smtp_password')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_from_email">Afzender e-mail</Label>
              <Input
                id="smtp_from_email"
                name="smtp_from_email"
                type="email"
                value={config.smtp_from_email}
                onChange={handleChange}
                placeholder="noreply@yourdomain.com"
                aria-invalid={Boolean(errors.smtp_from_email)}
              />
              <FieldError message={errors.smtp_from_email} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_from_name">Afzender naam</Label>
              <Input
                id="smtp_from_name"
                name="smtp_from_name"
                value={config.smtp_from_name}
                onChange={handleChange}
                placeholder="MijnZaak"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="smtp_reply_to">Standaard antwoordadres (optioneel)</Label>
              <Input
                id="smtp_reply_to"
                name="smtp_reply_to"
                type="email"
                value={config.smtp_reply_to}
                onChange={handleChange}
                placeholder="Leeg laten om antwoorden naar de verzendende gebruiker te sturen"
                aria-invalid={Boolean(errors.smtp_reply_to)}
              />
              <FieldError message={errors.smtp_reply_to} />
            </div>
          </div>

          <div className="space-y-2 rounded-md border p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="space-y-2 flex-1">
                <Label htmlFor="smtp_test_recipient">Testmail versturen naar</Label>
                <Input
                  id="smtp_test_recipient"
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="Leeg laten voor je eigen e-mailadres"
                  aria-invalid={testRecipientInvalid}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestSmtp}
                disabled={isTestingSmtp || !config.smtp_host || hasErrors || testRecipientInvalid}
              >
                {isTestingSmtp ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Testmail versturen
              </Button>
            </div>
            <FieldError message={testRecipientInvalid ? 'Ongeldig e-mailadres' : undefined} />
            {isSmtpDirty && (
              <p className="text-xs text-muted-foreground">
                De test gebruikt de ingevulde waarden. Vergeet niet op te slaan als de test slaagt.
              </p>
            )}
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            De instellingen worden opgeslagen in de database en direct gebruikt door de backend functies.
            Wachtwoorden en secrets worden versleuteld opgeslagen en niet meer getoond.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          {isDirty && (
            <span className="text-sm text-muted-foreground">Niet-opgeslagen wijzigingen</span>
          )}
          <Button onClick={handleSave} disabled={isSaving || !isDirty || hasErrors}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Opslaan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
