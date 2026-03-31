import { useState, useEffect } from 'react';
import { useBTWFilingFields, BTW_FIELDS } from '@/hooks/useBTWFilingFields';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface BtwFilingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  quarter: number;
  period: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

export default function BtwFilingWizard({
  open,
  onOpenChange,
  year,
  quarter,
  period,
}: BtwFilingWizardProps) {
  const { getByPeriod, upsert, calculateFields } = useBTWFilingFields();
  const [activeStep, setActiveStep] = useState<'ontvangen' | 'aftrekbaar' | 'totaal'>('ontvangen');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    field_1a: 0,
    field_1b: 0,
    field_1c: 0,
    field_1d: 0,
    field_1e: 0,
    field_2a: 0,
    field_3a: 0,
    field_3b: 0,
    field_4a: 0,
    field_4b: 0,
    field_5a: 0,
    field_5b: 0,
    field_5c: 0,
  });

  useEffect(() => {
    if (open) {
      loadFilingData();
    }
  }, [open, period]);

  const loadFilingData = async () => {
    setIsLoading(true);
    try {
      const existing = await getByPeriod(period);
      if (existing) {
        setFormData({
          field_1a: existing.field_1a,
          field_1b: existing.field_1b,
          field_1c: existing.field_1c,
          field_1d: existing.field_1d,
          field_1e: existing.field_1e,
          field_2a: existing.field_2a,
          field_3a: existing.field_3a,
          field_3b: existing.field_3b,
          field_4a: existing.field_4a,
          field_4b: existing.field_4b,
          field_5a: existing.field_5a,
          field_5b: existing.field_5b,
          field_5c: existing.field_5c,
        });
      } else {
        // Load calculated values
        const calculated = calculateFields(year, quarter);
        setFormData((prev) => ({ ...prev, ...calculated }));
      }
    } catch (error) {
      console.error('Failed to load filing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const updatedData = {
      ...formData,
      [field]: numValue,
    };

    // Recalculate totals
    updatedData.field_5a =
      updatedData.field_1a +
      updatedData.field_1b +
      updatedData.field_1c +
      updatedData.field_1d +
      updatedData.field_1e;

    updatedData.field_5b =
      updatedData.field_2a +
      updatedData.field_3a +
      updatedData.field_3b +
      updatedData.field_4a +
      updatedData.field_4b;

    updatedData.field_5c = updatedData.field_5a - updatedData.field_5b;

    setFormData(updatedData);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await upsert.mutateAsync({
        period,
        year,
        quarter,
        ...formData,
        submitted: false,
        submitted_at: null,
        notes: null,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save filing:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderFieldInput = (fieldKey: string, value: number) => {
    const fieldInfo = BTW_FIELDS[fieldKey as keyof typeof BTW_FIELDS];
    const isTotal = ['5a', '5b', '5c'].includes(fieldKey);

    return (
      <div key={fieldKey} className="space-y-2">
        <Label htmlFor={fieldKey} className="text-sm">
          {fieldKey}. {fieldInfo?.label}
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">€</span>
          <Input
            id={fieldKey}
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => handleInputChange(fieldKey, e.target.value)}
            disabled={isTotal}
            className="flex-1"
            placeholder="0,00"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {formatCurrency(value)}
        </p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>BTW-aangifte wizard</DialogTitle>
          <DialogDescription>
            Kwartaal {quarter} {year} ({period})
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Informatie</AlertTitle>
              <AlertDescription>
                De waarden zijn automatisch berekend op basis van uw facturen en
                uitgaven. U kunt deze waarden aanpassen indien nodig.
              </AlertDescription>
            </Alert>

            <Tabs
              value={activeStep}
              onValueChange={(v) =>
                setActiveStep(v as 'ontvangen' | 'aftrekbaar' | 'totaal')
              }
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="ontvangen">Ontvangen BTW</TabsTrigger>
                <TabsTrigger value="aftrekbaar">Aftrekbare BTW</TabsTrigger>
                <TabsTrigger value="totaal">Totaal</TabsTrigger>
              </TabsList>

              <TabsContent value="ontvangen" className="space-y-4 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Ontvangen omzetbelasting
                    </CardTitle>
                    <CardDescription>
                      BTW die u heeft ontvangen van klanten
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4">
                      {renderFieldInput('1a', formData.field_1a)}
                      {renderFieldInput('1b', formData.field_1b)}
                      {renderFieldInput('1c', formData.field_1c)}
                      {renderFieldInput('1d', formData.field_1d)}
                      {renderFieldInput('1e', formData.field_1e)}
                    </div>
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-sm text-muted-foreground mb-1">
                        Totaal ontvangen BTW (5a)
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(formData.field_5a)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="aftrekbaar" className="space-y-4 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Aftrekbare omzetbelasting
                    </CardTitle>
                    <CardDescription>
                      BTW die u mag aftrekken van uw aankopen
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4">
                      {renderFieldInput('2a', formData.field_2a)}
                      {renderFieldInput('3a', formData.field_3a)}
                      {renderFieldInput('3b', formData.field_3b)}
                      {renderFieldInput('4a', formData.field_4a)}
                      {renderFieldInput('4b', formData.field_4b)}
                    </div>
                    <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                      <p className="text-sm text-muted-foreground mb-1">
                        Totaal aftrekbare BTW (5b)
                      </p>
                      <p className="text-2xl font-bold text-success">
                        {formatCurrency(formData.field_5b)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="totaal" className="space-y-4 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Saldo</CardTitle>
                    <CardDescription>
                      Te betalen of terug te vorderen bedrag
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground mb-1">
                          Totaal ontvangen BTW (5a)
                        </p>
                        <p className="text-2xl font-bold text-primary">
                          {formatCurrency(formData.field_5a)}
                        </p>
                      </div>

                      <div className="flex justify-center">
                        <span className="text-2xl font-bold text-muted-foreground">−</span>
                      </div>

                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground mb-1">
                          Totaal aftrekbare BTW (5b)
                        </p>
                        <p className="text-2xl font-bold text-success">
                          {formatCurrency(formData.field_5b)}
                        </p>
                      </div>

                      <div className="flex justify-center">
                        <span className="text-2xl font-bold text-muted-foreground">=</span>
                      </div>

                      <div
                        className={`p-4 rounded-lg border-2 flex items-start gap-4 ${
                          formData.field_5c > 0
                            ? 'bg-warning/10 border-warning'
                            : formData.field_5c < 0
                            ? 'bg-success/10 border-success'
                            : 'bg-muted/50 border-muted-foreground/20'
                        }`}
                      >
                        <CheckCircle2
                          className={`h-6 w-6 flex-shrink-0 mt-1 ${
                            formData.field_5c > 0
                              ? 'text-warning'
                              : formData.field_5c < 0
                              ? 'text-success'
                              : 'text-muted-foreground'
                          }`}
                        />
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground mb-1">
                            {formData.field_5c > 0
                              ? 'Te betalen'
                              : formData.field_5c < 0
                              ? 'Terug te vorderen'
                              : 'Geen verschuldigde belasting'}
                          </p>
                          <p className="text-3xl font-bold">
                            {formatCurrency(Math.abs(formData.field_5c))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Controleer uw gegevens</AlertTitle>
                  <AlertDescription>
                    Controleer alle bedragen goed voordat u de aangifte aanvaard.
                    U bent zelf verantwoordelijk voor de juistheid van de gegevens.
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Annuleren
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
