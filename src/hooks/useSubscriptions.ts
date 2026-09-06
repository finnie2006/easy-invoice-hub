import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  subscriptionPlans as subscriptionPlansApi,
  subscriptions as subscriptionsApi,
} from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { calculateNextInvoiceDate, calculatePreviousInvoiceDate } from '@/lib/subscriptions';

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export interface Subscription {
  id: string;
  user_id: string;
  client_id: string | null;
  client_name: string | null;
  service_name: string;
  plan_name: string;
  billing_interval_months: number;
  monthly_price: number;
  invoice_amount: number;
  btw_percentage: number;
  start_date: string;
  next_invoice_date: string;
  last_invoice_date: string | null;
  minimum_term_months: number;
  status: SubscriptionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SubscriptionInsert = Omit<Subscription, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export interface SubscriptionPlan {
  id: string;
  user_id: string;
  name: string;
  billing_interval_months: number;
  monthly_price: number;
  invoice_amount: number;
  minimum_term_months: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type SubscriptionPlanInsert = Omit<SubscriptionPlan, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Er is een onbekende fout opgetreden.';
};

export function useSubscriptions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['subscriptions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const response = await subscriptionsApi.getAll();
      return response.data as Subscription[];
    },
    enabled: !!user,
  });

  const createSubscription = useMutation({
    mutationFn: async (subscription: SubscriptionInsert) => {
      if (!user) throw new Error('Not authenticated');
      const response = await subscriptionsApi.create(subscription);
      return response.data as Subscription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast({
        title: 'Abonnement toegevoegd',
        description: 'De factuurplanning is opgeslagen.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Fout bij toevoegen',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const updateSubscription = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SubscriptionInsert> }) => {
      if (!user) throw new Error('Not authenticated');
      const response = await subscriptionsApi.update(id, updates);
      return response.data as Subscription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast({
        title: 'Abonnement bijgewerkt',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Fout bij bijwerken',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const deleteSubscription = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      await subscriptionsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast({
        title: 'Abonnement verwijderd',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Fout bij verwijderen',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const markSubscriptionInvoiced = useMutation({
    mutationFn: async (subscription: Subscription) => {
      if (!user) throw new Error('Not authenticated');
      const response = await subscriptionsApi.update(subscription.id, {
        last_invoice_date: subscription.next_invoice_date,
        next_invoice_date: calculateNextInvoiceDate(
          subscription.next_invoice_date,
          subscription.billing_interval_months,
        ),
      });
      return response.data as Subscription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast({
        title: 'Factuurmoment verwerkt',
        description: 'De volgende factuurdatum is doorgeschoven.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Fout bij verwerken',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const undoSubscriptionInvoiced = useMutation({
    mutationFn: async (subscription: Subscription) => {
      if (!user) throw new Error('Not authenticated');

      const response = await subscriptionsApi.update(subscription.id, {
        next_invoice_date: calculatePreviousInvoiceDate(
          subscription.next_invoice_date,
          subscription.billing_interval_months,
        ),
        last_invoice_date: null,
      });
      return response.data as Subscription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast({
        title: 'Factuurmoment teruggedraaid',
        description: 'De vorige volgende factuurdatum is hersteld.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Fout bij terugdraaien',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  return {
    subscriptions,
    isLoading,
    createSubscription: createSubscription.mutateAsync,
    updateSubscription: updateSubscription.mutateAsync,
    deleteSubscription: deleteSubscription.mutate,
    markSubscriptionInvoiced: markSubscriptionInvoiced.mutateAsync,
    undoSubscriptionInvoiced: undoSubscriptionInvoiced.mutateAsync,
    isCreating: createSubscription.isPending,
    isUpdating: updateSubscription.isPending || markSubscriptionInvoiced.isPending || undoSubscriptionInvoiced.isPending,
  };
}

export function useSubscriptionPlans() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['subscription-plans', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const response = await subscriptionPlansApi.getAll();
      return response.data as SubscriptionPlan[];
    },
    enabled: !!user,
  });

  const createPlan = useMutation({
    mutationFn: async (plan: SubscriptionPlanInsert) => {
      if (!user) throw new Error('Not authenticated');
      const response = await subscriptionPlansApi.create(plan);
      return response.data as SubscriptionPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      toast({
        title: 'Pakket toegevoegd',
        description: 'Het abonnementspakket is beschikbaar in nieuwe abonnementen.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Fout bij toevoegen pakket',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const updatePlan = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SubscriptionPlanInsert> }) => {
      if (!user) throw new Error('Not authenticated');
      const response = await subscriptionPlansApi.update(id, updates);
      return response.data as SubscriptionPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      toast({
        title: 'Pakket bijgewerkt',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Fout bij bijwerken pakket',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      await subscriptionPlansApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      toast({
        title: 'Pakket verwijderd',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Fout bij verwijderen pakket',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  return {
    plans,
    isLoading,
    createPlan: createPlan.mutateAsync,
    updatePlan: updatePlan.mutateAsync,
    deletePlan: deletePlan.mutate,
    isSaving: createPlan.isPending || updatePlan.isPending,
  };
}
