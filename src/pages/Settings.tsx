import { useState } from 'react';
import { useProfile, Profile } from '@/hooks/useProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Building2 } from 'lucide-react';

export default function Settings() {
  const { profile, isLoading, updateProfile, isUpdating } = useProfile();
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
        <h1 className="text-3xl font-bold tracking-tight">Instellingen</h1>
        <p className="text-muted-foreground">
          Beheer je bedrijfsgegevens en voorkeuren
        </p>
      </div>

      <form onSubmit={handleSubmit}>
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
