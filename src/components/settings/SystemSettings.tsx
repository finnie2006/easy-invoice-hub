import { useState, useEffect } from 'react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Server, Mail, Key, Save, Loader2, Info } from 'lucide-react';
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
  smtp_user: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name: string;
}

const defaultConfig: SystemConfig = {
  authentik_url: '',
  authentik_client_id: '',
  authentik_client_secret: '',
  authentik_redirect_uri: '',
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_password: '',
  smtp_from_email: '',
  smtp_from_name: '',
};

export default function SystemSettings() {
  const { isAdmin, isLoading: isLoadingRole } = useAppSettings();
  const { toast } = useToast();
  const [config, setConfig] = useState<SystemConfig>(defaultConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings from app_settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await appSettingsApi.getAll();
        const data = response.data as Array<{ setting_key: string; setting_value: unknown }>;
        
        const newConfig = { ...defaultConfig };
        data?.forEach((row) => {
          const key = row.setting_key as keyof SystemConfig;
          if (key in newConfig) {
            const value = row.setting_value;
            newConfig[key] = typeof value === 'string' ? value.replace(/"/g, '') : String(value);
          }
        });
        
        setConfig(newConfig);
      } catch (error) {
        console.error('Error loading system settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settingsToSave = Object.entries(config).map(([key, value]) => ({ key, value }));
      await appSettingsApi.upsertMany(settingsToSave);

      toast({
        title: 'Instellingen opgeslagen',
        description: 'De systeeminstellingen zijn succesvol bijgewerkt.',
      });
    } catch (error) {
      console.error('Error saving system settings:', error);
      toast({
        title: 'Fout',
        description: 'Er is een fout opgetreden bij het opslaan van de instellingen.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

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
                placeholder="https://auth.yourdomain.com"
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
              <Label htmlFor="authentik_client_secret">Client Secret</Label>
              <Input
                id="authentik_client_secret"
                name="authentik_client_secret"
                type="password"
                value={config.authentik_client_secret}
                onChange={handleChange}
                placeholder="••••••••"
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
                value={config.smtp_port}
                onChange={handleChange}
                placeholder="587"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_user">Gebruikersnaam</Label>
              <Input
                id="smtp_user"
                name="smtp_user"
                value={config.smtp_user}
                onChange={handleChange}
                placeholder="user@yourdomain.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_password">Wachtwoord</Label>
              <Input
                id="smtp_password"
                name="smtp_password"
                type="password"
                value={config.smtp_password}
                onChange={handleChange}
                placeholder="••••••••"
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
              />
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
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            De instellingen worden opgeslagen in de database en direct gebruikt door de backend functies.
            Bij self-hosting is het niet nodig om aparte omgevingsvariabelen te configureren.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={isSaving}>
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
