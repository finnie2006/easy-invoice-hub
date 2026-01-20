import { useAppSettings, EnvironmentMode } from '@/hooks/useAppSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, UserX, Building2, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AdminSettings() {
  const { settings, isLoading, isAdmin, updateSetting, isUpdating } = useAppSettings();

  if (isLoading) {
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
            <Shield className="h-5 w-5" />
            Beheerdersinstellingen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Je hebt geen beheerrechten om deze instellingen te wijzigen.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const handleRegistrationToggle = (checked: boolean) => {
    updateSetting('registration_enabled', checked);
  };

  const handleEnvironmentModeChange = (value: EnvironmentMode) => {
    updateSetting('environment_mode', value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Beheerdersinstellingen
          <Badge variant="secondary">Admin</Badge>
        </CardTitle>
        <CardDescription>
          Globale instellingen voor de applicatie (alleen zichtbaar voor beheerders)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Registration Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-start gap-3">
            <UserX className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div className="space-y-0.5">
              <Label htmlFor="registration_enabled" className="font-medium">
                Registratie toestaan
              </Label>
              <p className="text-sm text-muted-foreground">
                Nieuwe gebruikers kunnen zich registreren voor de applicatie
              </p>
            </div>
          </div>
          <Switch
            id="registration_enabled"
            checked={settings?.registration_enabled ?? true}
            onCheckedChange={handleRegistrationToggle}
            disabled={isUpdating}
          />
        </div>

        {/* Environment Mode */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <Label className="font-medium">Omgevingsmodus</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Bepaal hoe gebruikers data delen binnen de applicatie
          </p>
          
          <RadioGroup
            value={settings?.environment_mode ?? 'isolated'}
            onValueChange={handleEnvironmentModeChange}
            className="space-y-3"
            disabled={isUpdating}
          >
            <div className="flex items-start space-x-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="isolated" id="isolated" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <Label htmlFor="isolated" className="font-medium cursor-pointer">
                    Geïsoleerd (per gebruiker)
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Elke gebruiker heeft eigen klanten, facturen en uitgaven. 
                  Ideaal voor meerdere ZZP'ers die dezelfde installatie gebruiken.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="shared" id="shared" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <Label htmlFor="shared" className="font-medium cursor-pointer">
                    Gedeeld (alle gebruikers)
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Alle gebruikers zien dezelfde data. 
                  Ideaal voor een klein bedrijf met gedeelde administratie.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="team" id="team" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <Label htmlFor="team" className="font-medium cursor-pointer">
                    Team-gebaseerd
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Gebruikers kunnen teams maken en data delen binnen hun team.
                  Ideaal voor organisaties met meerdere afdelingen.
                </p>
                <Badge variant="outline" className="mt-2">Binnenkort beschikbaar</Badge>
              </div>
            </div>
          </RadioGroup>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Let op:</strong> Het wijzigen van de omgevingsmodus heeft directe invloed op de 
            data-toegang van alle gebruikers. Bij self-hosting met plain PostgreSQL worden deze 
            instellingen ook toegepast via de RLS-policies.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
