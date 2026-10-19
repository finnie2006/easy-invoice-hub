import { useRef, useState } from 'react';
import { useProfile, Profile } from '@/hooks/useProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Building2, Palette, Mail, ImagePlus, Trash2 } from 'lucide-react';
import { files as filesApi } from '@/api/client';
import { useToast } from '@/hooks/use-toast';
import AdminSettings from '@/components/settings/AdminSettings';
import SystemSettings from '@/components/settings/SystemSettings';
import { MFASettings } from '@/components/settings/MFASettings';
import { PushNotificationSettings } from '@/components/settings/PushNotificationSettings';
import {
  DEFAULT_INVOICE_EMAIL_BODY,
  DEFAULT_INVOICE_EMAIL_SUBJECT,
  INVOICE_EMAIL_VARIABLES,
} from '@/lib/invoice-email-template';
const NUMERIC_PROFILE_FIELDS = ['default_hourly_rate', 'default_km_rate', 'default_payment_terms'] as const;

export default function Settings() {
  const { profile, isLoading, updateProfile, isUpdating, appName } = useProfile();
  const [formData, setFormData] = useState<Partial<Profile>>({});
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Merge profile with form data for display
  const displayData = { ...profile, ...formData };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = { ...formData };
    for (const key of NUMERIC_PROFILE_FIELDS) {
      if (payload[key] === '') payload[key] = null;
    }
    updateProfile(payload);
    setFormData({});
  };

  const handleSignatureImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast({
        title: 'Ongeldig bestand',
        description: 'Gebruik een PNG- of JPG-afbeelding.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingSignature(true);
    try {
      const response = await filesApi.upload(file, 'email-signatures');
      setFormData(prev => ({ ...prev, invoice_email_signature_image_url: response.data.url }));
    } catch (error) {
      console.error('Error uploading signature image:', error);
      toast({
        title: 'Uploaden mislukt',
        description: 'De afbeelding kon niet worden geüpload.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingSignature(false);
    }
  };

  const handleSignatureImageRemove = () => {
    setFormData(prev => ({ ...prev, invoice_email_signature_image_url: null }));
  };

  const handleBrandingToggle = (checked: boolean) => {
    setFormData(prev => ({ ...prev, use_company_branding: checked }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Instellingen</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Beheer je bedrijfsgegevens en voorkeuren
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Branding Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Branding
            </CardTitle>
            <CardDescription>
              Kies hoe de app zich presenteert
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="use_company_branding">Bedrijfsbranding gebruiken</Label>
                <p className="text-sm text-muted-foreground">
                  Toon je bedrijfsnaam in plaats van "MijnZaak"
                </p>
              </div>
              <Switch
                id="use_company_branding"
                checked={displayData.use_company_branding || false}
                onCheckedChange={handleBrandingToggle}
                disabled={!displayData.company_name}
              />
            </div>
            {!displayData.company_name && (
              <p className="text-sm text-muted-foreground">
                Vul eerst je bedrijfsnaam in om bedrijfsbranding te gebruiken.
              </p>
            )}
            <div className="text-sm">
              <span className="text-muted-foreground">Huidige weergave: </span>
              <span className="font-medium">{appName}</span>
            </div>
          </CardContent>
        </Card>

        {/* Company Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Bedrijfsgegevens
            </CardTitle>
            <CardDescription>
              Deze gegevens worden op je facturen getoond
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company_name">Bedrijfsnaam *</Label>
                <Input
                  id="company_name"
                  name="company_name"
                  value={displayData.company_name || ''}
                  onChange={handleChange}
                  placeholder="Jouw Bedrijf B.V."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kvk_number">KVK-nummer *</Label>
                <Input
                  id="kvk_number"
                  name="kvk_number"
                  value={displayData.kvk_number || ''}
                  onChange={handleChange}
                  placeholder="12345678"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="btw_number">BTW-nummer</Label>
                <Input
                  id="btw_number"
                  name="btw_number"
                  value={displayData.btw_number || ''}
                  onChange={handleChange}
                  placeholder="NL123456789B01"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="iban">IBAN</Label>
                <Input
                  id="iban"
                  name="iban"
                  value={displayData.iban || ''}
                  onChange={handleChange}
                  placeholder="NL00 BANK 0000 0000 00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_name">Tenaamstelling (T.n.v.)</Label>
                <Input
                  id="payment_name"
                  name="payment_name"
                  value={displayData.payment_name || ''}
                  onChange={handleChange}
                  placeholder={displayData.company_name || 'Naam op factuur'}
                />
                <p className="text-xs text-muted-foreground">
                  Wordt getoond als T.n.v. op facturen. Laat leeg om je bedrijfsnaam te gebruiken.
                </p>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-medium mb-4">Adresgegevens</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="company_address">Straatnaam + huisnummer</Label>
                  <Input
                    id="company_address"
                    name="company_address"
                    value={displayData.company_address || ''}
                    onChange={handleChange}
                    placeholder="Voorbeeldstraat 123"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_postal_code">Postcode</Label>
                  <Input
                    id="company_postal_code"
                    name="company_postal_code"
                    value={displayData.company_postal_code || ''}
                    onChange={handleChange}
                    placeholder="1234 AB"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_city">Plaats</Label>
                  <Input
                    id="company_city"
                    name="company_city"
                    value={displayData.company_city || ''}
                    onChange={handleChange}
                    placeholder="Amsterdam"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_country">Land</Label>
                  <Input
                    id="company_country"
                    name="company_country"
                    value={displayData.company_country || 'Nederland'}
                    onChange={handleChange}
                    placeholder="Nederland"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-medium mb-4">Standaardinstellingen</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="default_hourly_rate">Standaard uurtarief (€)</Label>
                  <Input
                    id="default_hourly_rate"
                    name="default_hourly_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={displayData.default_hourly_rate || ''}
                    onChange={handleChange}
                    placeholder="75.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default_km_rate">Standaard km-tarief (€)</Label>
                  <Input
                    id="default_km_rate"
                    name="default_km_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={displayData.default_km_rate ?? ''}
                    onChange={handleChange}
                    placeholder="0.25"
                  />
                  <p className="text-xs text-muted-foreground">
                    Wordt ingevuld als je op een factuurregel de eenheid "km" kiest.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default_payment_terms">Betalingstermijn (dagen)</Label>
                  <Input
                    id="default_payment_terms"
                    name="default_payment_terms"
                    type="number"
                    min="1"
                    value={displayData.default_payment_terms || 14}
                    onChange={handleChange}
                    placeholder="14"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Standaard factuurmail
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_email_subject_template">Onderwerp</Label>
                  <Input
                    id="invoice_email_subject_template"
                    name="invoice_email_subject_template"
                    value={displayData.invoice_email_subject_template ?? DEFAULT_INVOICE_EMAIL_SUBJECT}
                    onChange={handleChange}
                    placeholder={DEFAULT_INVOICE_EMAIL_SUBJECT}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice_email_body_template">Bericht</Label>
                  <Textarea
                    id="invoice_email_body_template"
                    name="invoice_email_body_template"
                    value={displayData.invoice_email_body_template ?? DEFAULT_INVOICE_EMAIL_BODY}
                    onChange={handleChange}
                    placeholder={DEFAULT_INVOICE_EMAIL_BODY}
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Afbeelding in handtekening</Label>
                  {displayData.invoice_email_signature_image_url && (
                    <div className="rounded-lg border bg-white p-3 w-fit">
                      <img
                        src={displayData.invoice_email_signature_image_url}
                        alt="Handtekening"
                        className="max-h-24 max-w-[300px] object-contain"
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={signatureInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={handleSignatureImageChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => signatureInputRef.current?.click()}
                      disabled={isUploadingSignature}
                    >
                      {isUploadingSignature ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4 mr-2" />
                      )}
                      {displayData.invoice_email_signature_image_url ? 'Andere afbeelding' : 'Afbeelding uploaden'}
                    </Button>
                    {displayData.invoice_email_signature_image_url && (
                      <Button type="button" variant="ghost" size="sm" onClick={handleSignatureImageRemove}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Verwijderen
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG of JPG, bijvoorbeeld je logo. Wordt onder de groet getoond, of op de plek van {'{handtekening}'} in het bericht. Klik daarna op Opslaan.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Variabelen</Label>
                  <div className="flex flex-wrap gap-2">
                    {INVOICE_EMAIL_VARIABLES.map((variable) => (
                      <Badge key={variable.token} variant="outline" title={variable.description}>
                        {variable.token}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gebruik deze variabelen in onderwerp en bericht. Ze worden automatisch ingevuld bij het e-mailen van een factuur.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Opslaan
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <PushNotificationSettings />

      {/* Admin Settings */}
      <AdminSettings />

      {/* System Settings */}
      <SystemSettings />

      {/* MFA Settings */}
      <MFASettings />
    </div>
  );
}
