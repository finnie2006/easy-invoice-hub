import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useClients } from '@/hooks/useClients';
import {
  Subscription,
  SubscriptionInsert,
  SubscriptionPlan,
  SubscriptionPlanInsert,
  SubscriptionStatus,
  useSubscriptionPlans,
  useSubscriptions,
} from '@/hooks/useSubscriptions';
import {
  BillingIntervalMonths,
  formatDateInput,
  getBillingIntervalLabel,
  getSubscriptionBillingState,
} from '@/lib/subscriptions';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';

type SubscriptionFilter = 'all' | 'active' | 'due' | 'upcoming' | 'paused' | 'cancelled';

const today = () => startOfDay(new Date());

const buildEmptySubscription = (plan?: SubscriptionPlan): SubscriptionInsert => ({
  client_id: null,
  client_name: null,
  service_name: 'Vevuno',
  plan_name: plan?.name || '',
  billing_interval_months: (plan?.billing_interval_months || 1) as BillingIntervalMonths,
  monthly_price: Number(plan?.monthly_price || 0),
  invoice_amount: Number(plan?.invoice_amount || 0),
  btw_percentage: 21,
  start_date: formatDateInput(new Date()),
  next_invoice_date: formatDateInput(new Date()),
  last_invoice_date: null,
  minimum_term_months: Number(plan?.minimum_term_months || 1),
  status: 'active',
  notes: null,
});

const buildEmptyPlan = (sortOrder: number): SubscriptionPlanInsert => ({
  name: '',
  billing_interval_months: 1,
  monthly_price: 0,
  invoice_amount: 0,
  minimum_term_months: 1,
  is_active: true,
  sort_order: sortOrder,
});

export default function SubscriptionsPage() {
  const {
    subscriptions,
    isLoading,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    markSubscriptionInvoiced,
    isCreating,
    isUpdating,
  } = useSubscriptions();
  const {
    plans,
    isLoading: isPlansLoading,
    createPlan,
    updatePlan,
    deletePlan,
    isSaving: isSavingPlan,
  } = useSubscriptionPlans();
  const { clients } = useClients();
  const [searchParams, setSearchParams] = useSearchParams();

  const activePlans = useMemo(() => plans.filter((plan) => plan.is_active), [plans]);
  const firstActivePlan = activePlans[0];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [plansDialogOpen, setPlansDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [deleteConfirmSubscription, setDeleteConfirmSubscription] = useState<Subscription | null>(null);
  const [deleteConfirmPlan, setDeleteConfirmPlan] = useState<SubscriptionPlan | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriptionFilter>('all');
  const [selectedPlanId, setSelectedPlanId] = useState('custom');
  const [formData, setFormData] = useState<SubscriptionInsert>(buildEmptySubscription());
  const [planFormData, setPlanFormData] = useState<SubscriptionPlanInsert>(buildEmptyPlan(0));
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [nextInvoiceDate, setNextInvoiceDate] = useState<Date>(new Date());

  const resetForm = useCallback((plan = firstActivePlan) => {
    const emptySubscription = buildEmptySubscription(plan);
    setEditingSubscription(null);
    setSelectedPlanId(plan?.id || 'custom');
    setFormData(emptySubscription);
    setStartDate(parseISO(emptySubscription.start_date));
    setNextInvoiceDate(parseISO(emptySubscription.next_invoice_date));
  }, [firstActivePlan]);

  const resetPlanForm = () => {
    setEditingPlan(null);
    setPlanFormData(buildEmptyPlan(plans.length));
  };

  const openNewSubscription = useCallback(() => {
    resetForm();
    setDialogOpen(true);
  }, [resetForm]);

  useEffect(() => {
    if (searchParams.get('new') === '1' && !dialogOpen) {
      openNewSubscription();
    }
  }, [dialogOpen, openNewSubscription, searchParams]);

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
      if (searchParams.has('new')) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('new');
        setSearchParams(nextParams, { replace: true });
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (value: string | null) => {
    if (!value) return '-';
    return format(parseISO(value), 'd MMM yyyy', { locale: nl });
  };

  const getClientLabel = (subscription: Subscription | SubscriptionInsert) => {
    if (subscription.client_id) {
      return clients.find((client) => client.id === subscription.client_id)?.company_name || subscription.client_name || 'Klant';
    }

    return subscription.client_name || 'Geen klant gekoppeld';
  };

  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId);
    if (planId === 'custom') return;

    const plan = plans.find((option) => option.id === planId);
    if (!plan) return;

    setFormData((prev) => ({
      ...prev,
      plan_name: plan.name,
      billing_interval_months: plan.billing_interval_months as BillingIntervalMonths,
      monthly_price: Number(plan.monthly_price),
      invoice_amount: Number(plan.invoice_amount),
      minimum_term_months: Number(plan.minimum_term_months),
    }));
  };

  const handleClientChange = (value: string) => {
    if (value === 'none') {
      setFormData((prev) => ({ ...prev, client_id: null, client_name: null }));
      return;
    }

    const client = clients.find((item) => item.id === value);
    setFormData((prev) => ({
      ...prev,
      client_id: value,
      client_name: client?.company_name || prev.client_name,
    }));
  };

  const handleEdit = (subscription: Subscription) => {
    const matchingPlan = plans.find((plan) => (
      plan.name === subscription.plan_name &&
      Number(plan.billing_interval_months) === Number(subscription.billing_interval_months) &&
      Number(plan.monthly_price) === Number(subscription.monthly_price) &&
      Number(plan.invoice_amount) === Number(subscription.invoice_amount)
    ));

    setEditingSubscription(subscription);
    setSelectedPlanId(matchingPlan?.id || 'custom');
    setFormData({
      client_id: subscription.client_id,
      client_name: subscription.client_name,
      service_name: subscription.service_name,
      plan_name: subscription.plan_name,
      billing_interval_months: subscription.billing_interval_months as BillingIntervalMonths,
      monthly_price: Number(subscription.monthly_price),
      invoice_amount: Number(subscription.invoice_amount),
      btw_percentage: Number(subscription.btw_percentage),
      start_date: subscription.start_date,
      next_invoice_date: subscription.next_invoice_date,
      last_invoice_date: subscription.last_invoice_date,
      minimum_term_months: Number(subscription.minimum_term_months),
      status: subscription.status,
      notes: subscription.notes,
    });
    setStartDate(parseISO(subscription.start_date));
    setNextInvoiceDate(parseISO(subscription.next_invoice_date));
    setDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const selectedClient = formData.client_id
      ? clients.find((client) => client.id === formData.client_id)
      : null;
    const payload: SubscriptionInsert = {
      ...formData,
      client_name: selectedClient?.company_name || formData.client_name || null,
      service_name: formData.service_name || 'Vevuno',
      plan_name: formData.plan_name || 'Handmatig',
      billing_interval_months: Number(formData.billing_interval_months) as BillingIntervalMonths,
      monthly_price: Number(formData.monthly_price) || 0,
      invoice_amount: Number(formData.invoice_amount) || 0,
      btw_percentage: Number(formData.btw_percentage) || 0,
      start_date: formatDateInput(startDate),
      next_invoice_date: formatDateInput(nextInvoiceDate),
      minimum_term_months: Number(formData.minimum_term_months) || Number(formData.billing_interval_months) || 1,
      last_invoice_date: formData.last_invoice_date || null,
      notes: formData.notes || null,
    };

    if (editingSubscription) {
      await updateSubscription({ id: editingSubscription.id, updates: payload });
    } else {
      await createSubscription(payload);
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setPlanFormData({
      name: plan.name,
      billing_interval_months: plan.billing_interval_months as BillingIntervalMonths,
      monthly_price: Number(plan.monthly_price),
      invoice_amount: Number(plan.invoice_amount),
      minimum_term_months: Number(plan.minimum_term_months),
      is_active: plan.is_active,
      sort_order: Number(plan.sort_order),
    });
  };

  const handlePlanSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const payload: SubscriptionPlanInsert = {
      ...planFormData,
      name: planFormData.name.trim(),
      billing_interval_months: Number(planFormData.billing_interval_months) as BillingIntervalMonths,
      monthly_price: Number(planFormData.monthly_price) || 0,
      invoice_amount: Number(planFormData.invoice_amount) || 0,
      minimum_term_months: Number(planFormData.minimum_term_months) || 1,
      sort_order: Number(planFormData.sort_order) || 0,
    };

    if (!payload.name) return;

    if (editingPlan) {
      await updatePlan({ id: editingPlan.id, updates: payload });
    } else {
      await createPlan(payload);
    }

    resetPlanForm();
  };

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((subscription) => {
      const query = searchQuery.toLowerCase();
      const billingState = getSubscriptionBillingState(subscription);
      const matchesSearch = !query ||
        subscription.service_name.toLowerCase().includes(query) ||
        subscription.plan_name.toLowerCase().includes(query) ||
        (subscription.client_name?.toLowerCase().includes(query) ?? false);

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'due') return billingState === 'overdue' || billingState === 'due_today';
      if (statusFilter === 'upcoming') return billingState === 'upcoming';
      return subscription.status === statusFilter;
    });
  }, [searchQuery, statusFilter, subscriptions]);

  const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'active');
  const dueSubscriptions = activeSubscriptions.filter((subscription) => {
    return startOfDay(parseISO(subscription.next_invoice_date)) <= today();
  });
  const upcomingSubscriptions = activeSubscriptions.filter((subscription) => {
    const days = differenceInCalendarDays(startOfDay(parseISO(subscription.next_invoice_date)), today());
    return days > 0 && days <= 14;
  });
  const monthlyRecurringValue = activeSubscriptions.reduce(
    (sum, subscription) => sum + Number(subscription.monthly_price),
    0,
  );
  const hasActiveFilters = Boolean(searchQuery) || statusFilter !== 'all';

  const getStatusBadge = (subscription: Subscription) => {
    const billingState = getSubscriptionBillingState(subscription);

    if (billingState === 'overdue') return <Badge variant="destructive">Te factureren</Badge>;
    if (billingState === 'due_today') return <Badge className="bg-amber-500 text-white">Vandaag</Badge>;
    if (billingState === 'upcoming') return <Badge variant="outline">Binnen 14 dagen</Badge>;
    if (subscription.status === 'paused') return <Badge variant="secondary">Gepauzeerd</Badge>;
    if (subscription.status === 'cancelled') return <Badge variant="secondary">Gestopt</Badge>;
    return <Badge className="bg-success text-success-foreground">Actief</Badge>;
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  if (isLoading || isPlansLoading) {
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
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Abonnementen</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Houd Vevuno-diensten en komende factuurmomenten bij
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setPlansDialogOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4" />
            Pakketten
          </Button>
          <Button className="w-full sm:w-auto" onClick={openNewSubscription}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuw abonnement
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSubscription ? 'Abonnement bewerken' : 'Nieuw abonnement'}</DialogTitle>
            <DialogDescription>
              Registreer de factuurplanning voor een doorlopende Vevuno-dienst.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="service_name">Dienst *</Label>
                <Input
                  id="service_name"
                  value={formData.service_name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, service_name: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan_name">Pakket</Label>
                <Select value={selectedPlanId} onValueChange={handlePlanChange}>
                  <SelectTrigger id="plan_name">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activePlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Handmatig</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedPlanId === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="custom_plan_name">Pakketnaam</Label>
                <Input
                  id="custom_plan_name"
                  value={formData.plan_name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, plan_name: event.target.value }))}
                  placeholder="Bijv. Vevuno maatwerk"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="client_id">Klant</Label>
              <Select value={formData.client_id || 'none'} onValueChange={handleClientChange}>
                <SelectTrigger id="client_id">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen klant gekoppeld</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!formData.client_id && (
              <div className="space-y-2">
                <Label htmlFor="client_name">Klantnaam</Label>
                <Input
                  id="client_name"
                  value={formData.client_name || ''}
                  onChange={(event) => setFormData((prev) => ({ ...prev, client_name: event.target.value || null }))}
                  placeholder="Bijv. Acme B.V."
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="billing_interval_months">Facturatie</Label>
                <Select
                  value={String(formData.billing_interval_months)}
                  onValueChange={(value) => {
                    setSelectedPlanId('custom');
                    setFormData((prev) => ({
                      ...prev,
                      billing_interval_months: Number(value) as BillingIntervalMonths,
                      minimum_term_months: Number(value),
                    }));
                  }}
                >
                  <SelectTrigger id="billing_interval_months">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Maandelijks</SelectItem>
                    <SelectItem value="3">Elke 3 maanden</SelectItem>
                    <SelectItem value="6">Elke 6 maanden</SelectItem>
                    <SelectItem value="12">Jaarlijks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthly_price">Prijs p/m</Label>
                <Input
                  id="monthly_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.monthly_price || ''}
                  onChange={(event) => {
                    setSelectedPlanId('custom');
                    setFormData((prev) => ({ ...prev, monthly_price: parseFloat(event.target.value) || 0 }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_amount">Factuurbedrag</Label>
                <Input
                  id="invoice_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.invoice_amount || ''}
                  onChange={(event) => {
                    setSelectedPlanId('custom');
                    setFormData((prev) => ({ ...prev, invoice_amount: parseFloat(event.target.value) || 0 }));
                  }}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="start_date">Startdatum</Label>
                <DatePicker
                  id="start_date"
                  value={startDate}
                  onChange={(date) => date && setStartDate(date)}
                  showClearButton={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next_invoice_date">Volgende factuur</Label>
                <DatePicker
                  id="next_invoice_date"
                  value={nextInvoiceDate}
                  onChange={(date) => date && setNextInvoiceDate(date)}
                  showClearButton={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minimum_term_months">Min. looptijd</Label>
                <Input
                  id="minimum_term_months"
                  type="number"
                  min="1"
                  step="1"
                  value={formData.minimum_term_months || ''}
                  onChange={(event) => {
                    setSelectedPlanId('custom');
                    setFormData((prev) => ({ ...prev, minimum_term_months: parseInt(event.target.value, 10) || 1 }));
                  }}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="btw_percentage">BTW %</Label>
                <Input
                  id="btw_percentage"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.btw_percentage}
                  onChange={(event) => setFormData((prev) => ({ ...prev, btw_percentage: parseFloat(event.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value as SubscriptionStatus }))}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actief</SelectItem>
                    <SelectItem value="paused">Gepauzeerd</SelectItem>
                    <SelectItem value="cancelled">Gestopt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notities</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value || null }))}
                placeholder="Bijv. prijsafspraak, onboarding of opzegtermijn"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={isCreating || isUpdating}>
                {(isCreating || isUpdating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Opslaan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={plansDialogOpen}
        onOpenChange={(open) => {
          setPlansDialogOpen(open);
          if (!open) resetPlanForm();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Abonnementspakketten</DialogTitle>
            <DialogDescription>
              Beheer de pakketten die je kunt kiezen bij een nieuw Vevuno-abonnement.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePlanSubmit} className="mt-4 rounded-lg border p-4">
            <div className="grid gap-4 md:grid-cols-6">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="plan_form_name">Naam *</Label>
                <Input
                  id="plan_form_name"
                  value={planFormData.name}
                  onChange={(event) => setPlanFormData((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Bijv. Vevuno Flex"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan_form_interval">Interval</Label>
                <Select
                  value={String(planFormData.billing_interval_months)}
                  onValueChange={(value) => setPlanFormData((prev) => ({
                    ...prev,
                    billing_interval_months: Number(value) as BillingIntervalMonths,
                    minimum_term_months: Number(value),
                  }))}
                >
                  <SelectTrigger id="plan_form_interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Maand</SelectItem>
                    <SelectItem value="3">3 maanden</SelectItem>
                    <SelectItem value="6">6 maanden</SelectItem>
                    <SelectItem value="12">Jaar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan_form_monthly">Prijs p/m</Label>
                <Input
                  id="plan_form_monthly"
                  type="number"
                  min="0"
                  step="0.01"
                  value={planFormData.monthly_price || ''}
                  onChange={(event) => setPlanFormData((prev) => ({ ...prev, monthly_price: parseFloat(event.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan_form_invoice">Factuur</Label>
                <Input
                  id="plan_form_invoice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={planFormData.invoice_amount || ''}
                  onChange={(event) => setPlanFormData((prev) => ({ ...prev, invoice_amount: parseFloat(event.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan_form_term">Looptijd</Label>
                <Input
                  id="plan_form_term"
                  type="number"
                  min="1"
                  step="1"
                  value={planFormData.minimum_term_months || ''}
                  onChange={(event) => setPlanFormData((prev) => ({ ...prev, minimum_term_months: parseInt(event.target.value, 10) || 1 }))}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={planFormData.is_active}
                  onCheckedChange={(checked) => setPlanFormData((prev) => ({ ...prev, is_active: checked }))}
                />
                Actief
              </label>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                {editingPlan && (
                  <Button type="button" variant="outline" onClick={resetPlanForm}>
                    Annuleren
                  </Button>
                )}
                <Button type="submit" disabled={isSavingPlan}>
                  {isSavingPlan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingPlan ? 'Pakket opslaan' : 'Pakket toevoegen'}
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pakket</TableHead>
                  <TableHead>Facturatie</TableHead>
                  <TableHead>Prijs p/m</TableHead>
                  <TableHead>Factuurbedrag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>
                      <div>{getBillingIntervalLabel(plan.billing_interval_months)}</div>
                      <div className="text-sm text-muted-foreground">
                        {plan.minimum_term_months} maanden looptijd
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(Number(plan.monthly_price))}</TableCell>
                    <TableCell>{formatCurrency(Number(plan.invoice_amount))}</TableCell>
                    <TableCell>
                      {plan.is_active ? (
                        <Badge className="bg-success text-success-foreground">Actief</Badge>
                      ) : (
                        <Badge variant="secondary">Inactief</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditPlan(plan)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmPlan(plan)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actief</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscriptions.length}</div>
            <p className="text-xs text-muted-foreground">lopende diensten</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nu nodig</CardTitle>
            <ReceiptText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dueSubscriptions.length}</div>
            <p className="text-xs text-muted-foreground">te factureren</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Binnen 14 dagen</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingSubscriptions.length}</div>
            <p className="text-xs text-muted-foreground">komende facturen</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maandwaarde</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(monthlyRecurringValue)}</div>
            <p className="text-xs text-muted-foreground">actieve diensten p/m</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Factuurplanning</CardTitle>
          <CardDescription>
            Sorteer op wat aandacht nodig heeft en schuif een abonnement door zodra de factuur is gemaakt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Zoek op dienst, pakket of klant..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as SubscriptionFilter)}>
              <SelectTrigger className="w-full md:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="due">Te factureren</SelectItem>
                <SelectItem value="upcoming">Binnen 14 dagen</SelectItem>
                <SelectItem value="active">Actief</SelectItem>
                <SelectItem value="paused">Gepauzeerd</SelectItem>
                <SelectItem value="cancelled">Gestopt</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                Wissen
              </Button>
            )}
          </div>

          {filteredSubscriptions.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center">
              <CalendarClock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">Geen abonnementen gevonden</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Voeg je eerste Vevuno-abonnement toe om factuurmomenten bij te houden.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dienst</TableHead>
                    <TableHead>Pakket</TableHead>
                    <TableHead>Factuurbedrag</TableHead>
                    <TableHead>Volgende factuur</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((subscription) => {
                    const daysUntilInvoice = differenceInCalendarDays(
                      startOfDay(parseISO(subscription.next_invoice_date)),
                      today(),
                    );
                    const dayLabel = daysUntilInvoice < 0
                      ? `${Math.abs(daysUntilInvoice)} dagen te laat`
                      : daysUntilInvoice === 0
                        ? 'Vandaag'
                        : `over ${daysUntilInvoice} dagen`;

                    return (
                      <TableRow key={subscription.id}>
                        <TableCell>
                          <div className="font-medium">{subscription.service_name}</div>
                          <div className="text-sm text-muted-foreground">{getClientLabel(subscription)}</div>
                        </TableCell>
                        <TableCell>
                          <div>{subscription.plan_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {getBillingIntervalLabel(subscription.billing_interval_months)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{formatCurrency(Number(subscription.invoice_amount))}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatCurrency(Number(subscription.monthly_price))} p/m
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{formatDate(subscription.next_invoice_date)}</div>
                          <div className="text-sm text-muted-foreground">{dayLabel}</div>
                        </TableCell>
                        <TableCell>{getStatusBadge(subscription)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markSubscriptionInvoiced(subscription)}
                              disabled={subscription.status !== 'active' || isUpdating}
                            >
                              <ReceiptText className="mr-2 h-4 w-4" />
                              Gefactureerd
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(subscription)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirmSubscription(subscription)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteConfirmSubscription}
        onOpenChange={(open) => !open && setDeleteConfirmSubscription(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abonnement verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert de planning voor {deleteConfirmSubscription?.service_name}. Bestaande facturen blijven ongemoeid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmSubscription) {
                  deleteSubscription(deleteConfirmSubscription.id);
                  setDeleteConfirmSubscription(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteConfirmPlan} onOpenChange={(open) => !open && setDeleteConfirmPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pakket verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert {deleteConfirmPlan?.name} uit de keuzelijst. Bestaande abonnementen blijven hun opgeslagen pakketgegevens houden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmPlan) {
                  deletePlan(deleteConfirmPlan.id);
                  setDeleteConfirmPlan(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
