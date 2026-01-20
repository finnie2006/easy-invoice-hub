import { useState } from 'react';
import { useProfile, Profile } from '@/hooks/useProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Building2, Palette, FileText, PanelLeft } from 'lucide-react';

const invoiceColorThemes = [
  { id: 'gray', name: 'Grijs', colors: ['#374151', '#6B7280', '#9CA3AF'] },
  { id: 'blue', name: 'Blauw', colors: ['#1E40AF', '#3B82F6', '#60A5FA'] },
  { id: 'emerald', name: 'Groen', colors: ['#047857', '#10B981', '#34D399'] },
  { id: 'amber', name: 'Amber', colors: ['#B45309', '#F59E0B', '#FBBF24'] },
  { id: 'rose', name: 'Roze', colors: ['#BE123C', '#F43F5E', '#FB7185'] },
  { id: 'purple', name: 'Paars', colors: ['#7C3AED', '#8B5CF6', '#A78BFA'] },
];

const panelColorThemes = [
  { id: 'default', name: 'Donker', preview: 'bg-slate-900' },
  { id: 'slate', name: 'Leisteen', preview: 'bg-slate-800' },
  { id: 'zinc', name: 'Zink', preview: 'bg-zinc-800' },
  { id: 'neutral', name: 'Neutraal', preview: 'bg-neutral-800' },
  { id: 'blue', name: 'Blauw', preview: 'bg-blue-900' },
  { id: 'indigo', name: 'Indigo', preview: 'bg-indigo-900' },
];

export default function Settings() {
  const { profile, isLoading, updateProfile, isUpdating, appName } = useProfile();
  const [formData, setFormData] = useState<Partial<Profile>>({});

  // Merge profile with form data for display
  const displayData = { ...profile, ...formData };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(formData);
    setFormData({});
  };

  const handleBrandingToggle = (checked: boolean) => {
    setFormData(prev => ({ ...prev, use_company_branding: checked }));
  };

  const handleInvoiceColorChange = (themeId: string) => {
    setFormData(prev => ({ ...prev, invoice_color_theme: themeId }));
  };

  const handlePanelColorChange = (themeId: string) => {
    setFormData(prev => ({ ...prev, panel_color_theme: themeId }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentInvoiceTheme = displayData.invoice_color_theme || 'gray';
  const currentPanelTheme = displayData.panel_color_theme || 'default';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Instellingen</h1>
        <p className="text-muted-foreground">
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

        {/* Panel Color Theme */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PanelLeft className="h-5 w-5" />
              Paneel Kleurthema
            </CardTitle>
            <CardDescription>
              Pas de kleur van het zijpaneel aan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {panelColorThemes.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handlePanelColorChange(theme.id)}
                  className={`group relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    currentPanelTheme === theme.id
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-transparent hover:border-muted-foreground/30'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-lg ${theme.preview} shadow-md`} />
                  <span className="text-xs font-medium">{theme.name}</span>
                  {currentPanelTheme === theme.id && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Invoice Color Theme */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Factuur Kleurthema
            </CardTitle>
            <CardDescription>
              Kies het kleurthema voor je facturen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {invoiceColorThemes.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleInvoiceColorChange(theme.id)}
                  className={`group relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    currentInvoiceTheme === theme.id
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-transparent hover:border-muted-foreground/30'
                  }`}
                >
                  <div className="flex gap-0.5">
                    {theme.colors.map((color, i) => (
                      <div
                        key={i}
                        className="w-4 h-8 first:rounded-l last:rounded-r"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium">{theme.name}</span>
                  {currentInvoiceTheme === theme.id && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
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
    </div>
  );
}