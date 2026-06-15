import { useState, useEffect, useCallback } from 'react';
import { useBTWFilingFields } from '@/hooks/useBTWFilingFields';
import {
  BTW_QUESTIONS,
  BtwFilingAmounts,
  BtwQuestionKey,
  ZERO_BTW_FILING_AMOUNTS,
  recalculateBtwFilingTotals,
} from '@/lib/btw-filing';
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

const sections: Record<
  'domestic' | 'reverse-charge' | 'foreign-sales' | 'foreign-purchases',
  { title: string; description: string; fields: BtwQuestionKey[] }
> = {
  domestic: {
    title: '1. Prestaties binnenland',
    description: 'Binnenlandse omzet, btw bij hoog/laag tarief, privegebruik en 0%-omzet.',
    fields: ['1a', '1b', '1c', '1d', '1e'],
  },
  'reverse-charge': {
    title: '2. Verleggingsregelingen binnenland',
    description: 'Binnenlandse leveringen of diensten waarbij btw naar u is verlegd.',
    fields: ['2a'],
  },
  'foreign-sales': {
    title: '3. Prestaties naar of in het buitenland',
    description: 'Buitenlandse omzet die in deze Nederlandse aangifte moet worden vermeld.',
    fields: ['3a', '3b', '3c'],
  },
  'foreign-purchases': {
    title: '4. Prestaties vanuit het buitenland aan u geleverd',
    description: 'Aankopen uit het buitenland waarbij u Nederlandse btw aangeeft.',
    fields: ['4a', '4b'],
  },
};

const tabs = [
  { value: 'domestic', label: 'Binnenland' },
  { value: 'reverse-charge', label: 'Verlegd' },
  { value: 'foreign-sales', label: 'Buitenland omzet' },
  { value: 'foreign-purchases', label: 'Buitenland inkoop' },
  { value: 'totals', label: 'Voorbelasting' },
] as const;

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const normalizeAmounts = (data?: Partial<BtwFilingAmounts> | null): BtwFilingAmounts => {
  const amounts = { ...ZERO_BTW_FILING_AMOUNTS };
  (Object.keys(amounts) as Array<keyof BtwFilingAmounts>).forEach((key) => {
    amounts[key] = Number(data?.[key] ?? 0);
  });
  return recalculateBtwFilingTotals(amounts);
};

const getTurnoverKey = (field: BtwQuestionKey) => {
  return `turnover_${field}` as keyof BtwFilingAmounts;
};

const getVatKey = (field: BtwQuestionKey) => {
  return `field_${field}` as keyof BtwFilingAmounts;
};

export default function BtwFilingWizard({
  open,
  onOpenChange,
  year,
  quarter,
  period,
}: BtwFilingWizardProps) {
  const { getByPeriod, upsert, calculateFields } = useBTWFilingFields();
  const [activeStep, setActiveStep] = useState<(typeof tabs)[number]['value']>('domestic');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<BtwFilingAmounts>(() => ({ ...ZERO_BTW_FILING_AMOUNTS }));

  const loadFilingData = useCallback(async () => {
    setIsLoading(true);
    try {
      const existing = await getByPeriod(period);
      if (existing) {
        setFormData(normalizeAmounts(existing));
      } else {
        setFormData(calculateFields(year, quarter));
      }
    } catch (error) {
      console.error('Failed to load filing data:', error);
      setFormData(calculateFields(year, quarter));
    } finally {
      setIsLoading(false);
    }
  }, [calculateFields, getByPeriod, period, quarter, year]);

  useEffect(() => {
    if (open) {
      loadFilingData();
    }
  }, [loadFilingData, open]);

  const handleInputChange = (field: keyof BtwFilingAmounts, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value, 10) || 0;
    setFormData((prev) => recalculateBtwFilingTotals({
      ...prev,
      [field]: numValue,
    }));
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

  const renderNumberInput = (
    id: string,
    field: keyof BtwFilingAmounts,
    value: number,
    label: string
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm">{label}</Label>
      <Input
        id={id}
        type="number"
        step="1"
        value={value}
        onChange={(event) => handleInputChange(field, event.target.value)}
        placeholder="0"
      />
    </div>
  );

  const renderQuestion = (field: BtwQuestionKey) => {
    const info = BTW_QUESTIONS[field];
    const turnoverKey = getTurnoverKey(field);
    const vatKey = getVatKey(field);

    return (
      <div key={field} className="grid gap-3 rounded-md border p-4 md:grid-cols-[minmax(0,1fr)_150px_150px]">
        <div className="space-y-1">
          <p className="font-medium">{field}. {info.label}</p>
          <p className="text-sm text-muted-foreground">
            {info.hasTurnover && info.hasVat
              ? 'Vul omzet exclusief btw en het btw-bedrag in hele euro\'s in.'
              : info.hasTurnover
                ? 'Vul de omzet exclusief btw in hele euro\'s in.'
                : 'Vul alleen het btw-bedrag in hele euro\'s in.'}
          </p>
        </div>
        {info.hasTurnover ? (
          renderNumberInput(
            `${field}-turnover`,
            turnoverKey,
            Number(formData[turnoverKey] || 0),
            'Omzet'
          )
        ) : (
          <div className="hidden md:block" />
        )}
        {info.hasVat ? (
          renderNumberInput(
            `${field}-vat`,
            vatKey,
            Number(formData[vatKey] || 0),
            'Btw'
          )
        ) : (
          <div className="hidden md:block" />
        )}
      </div>
    );
  };

  const renderSection = (sectionKey: keyof typeof sections) => {
    const section = sections[sectionKey];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{section.title}</CardTitle>
          <CardDescription>{section.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {section.fields.map(renderQuestion)}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
              <AlertTitle>Gebaseerd op de Belastingdienst-rubrieken</AlertTitle>
              <AlertDescription>
                Automatisch ingevulde waarden gebruiken de gegevens die in deze app bekend zijn. Controleer buitenlandse omzet,
                privegebruik, binnenlandse verlegging en bijzondere tarieven altijd handmatig.
              </AlertDescription>
            </Alert>

            <Tabs value={activeStep} onValueChange={(value) => setActiveStep(value as typeof activeStep)}>
              <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="domestic" className="space-y-4 mt-6">
                {renderSection('domestic')}
              </TabsContent>

              <TabsContent value="reverse-charge" className="space-y-4 mt-6">
                {renderSection('reverse-charge')}
              </TabsContent>

              <TabsContent value="foreign-sales" className="space-y-4 mt-6">
                {renderSection('foreign-sales')}
              </TabsContent>

              <TabsContent value="foreign-purchases" className="space-y-4 mt-6">
                {renderSection('foreign-purchases')}
              </TabsContent>

              <TabsContent value="totals" className="space-y-4 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">5. Voorbelasting en totaal</CardTitle>
                    <CardDescription>
                      5a wordt berekend uit rubrieken 1 t/m 4. 5b is de aftrekbare voorbelasting.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 rounded-md border p-4 md:grid-cols-[minmax(0,1fr)_160px]">
                      <div>
                        <p className="font-medium">5a. Verschuldigde btw</p>
                        <p className="text-sm text-muted-foreground">Totaal btw uit rubrieken 1 t/m 4.</p>
                      </div>
                      <p className="text-right text-2xl font-bold">{formatCurrency(formData.field_5a)}</p>
                    </div>

                    <div className="grid gap-3 rounded-md border p-4 md:grid-cols-[minmax(0,1fr)_160px]">
                      <div>
                        <p className="font-medium">5b. Voorbelasting</p>
                        <p className="text-sm text-muted-foreground">
                          Nederlandse btw op zakelijke inkopen en aftrekbare verlegde btw.
                        </p>
                      </div>
                      {renderNumberInput('5b-vat', 'field_5b', formData.field_5b, 'Btw')}
                    </div>

                    <div
                      className={`rounded-md border-2 p-4 ${
                        formData.field_5c > 0
                          ? 'bg-warning/10 border-warning'
                          : formData.field_5c < 0
                            ? 'bg-success/10 border-success'
                            : 'bg-muted/50 border-muted-foreground/20'
                      }`}
                    >
                      <div className="flex items-start gap-4">
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
                                ? 'Terug te vragen'
                                : 'Geen saldo'}
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
                    De aangifte zelf dient u nog in via Mijn Belastingdienst Zakelijk. Rond bedragen af op hele euro's en
                    controleer rubrieken die niet volledig uit facturen of uitgaven zijn af te leiden.
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
