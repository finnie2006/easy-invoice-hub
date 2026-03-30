import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { btwPeriods as btwPeriodsApi } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface BtwPeriod {
  id: string;
  user_id: string;
  period: string;
  year: number;
  quarter: number;
  is_closed: boolean;
  submitted_at: string | null;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BtwPeriodInsert {
  period: string;
  year: number;
  quarter: number;
  is_closed?: boolean;
  submitted_at?: string | null;
  closed_at?: string | null;
  notes?: string | null;
}

export function useBtwPeriods() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: btwPeriods = [], isLoading } = useQuery({
    queryKey: ['btw-periods', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const response = await btwPeriodsApi.getAll();
      return response.data as BtwPeriod[];
    },
    enabled: !!user?.id,
  });

  const createPeriodMutation = useMutation({
    mutationFn: async (period: BtwPeriodInsert) => {
      if (!user?.id) throw new Error('Not authenticated');

      const response = await btwPeriodsApi.create(period);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['btw-periods'] });
      toast.success('BTW-periode toegevoegd');
    },
    onError: (error) => {
      console.error('Error creating BTW period:', error);
      toast.error('Fout bij toevoegen BTW-periode');
    },
  });

  const updatePeriodMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BtwPeriod> & { id: string }) => {
      const response = await btwPeriodsApi.update(id, updates);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['btw-periods'] });
      toast.success('BTW-periode bijgewerkt');
    },
    onError: (error) => {
      console.error('Error updating BTW period:', error);
      toast.error('Fout bij bijwerken BTW-periode');
    },
  });

  const togglePeriodClosedMutation = useMutation({
    mutationFn: async ({ id, is_closed }: { id: string; is_closed: boolean }) => {
      const updates: Partial<BtwPeriod> = {
        is_closed,
        closed_at: is_closed ? new Date().toISOString() : null,
        submitted_at: is_closed ? new Date().toISOString() : null,
      };

      const response = await btwPeriodsApi.update(id, updates);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['btw-periods'] });
      toast.success(data.is_closed ? 'BTW-periode afgesloten' : 'BTW-periode heropend');
    },
    onError: (error) => {
      console.error('Error toggling BTW period:', error);
      toast.error('Fout bij wijzigen BTW-periode');
    },
  });

  // Helper to check if a period is closed
  const isPeriodClosed = (year: number, quarter: number): boolean => {
    return btwPeriods.some(p => p.year === year && p.quarter === quarter && p.is_closed);
  };

  // Helper to get the BTW period string for a date
  const getBtwPeriodForDate = (date: Date): string => {
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    const year = date.getFullYear();
    return `${year}-Q${quarter}`;
  };

  // Helper to get next available period if current is closed
  const getNextAvailablePeriod = (date: Date): { period: string; year: number; quarter: number } => {
    let year = date.getFullYear();
    let quarter = Math.ceil((date.getMonth() + 1) / 3);
    
    // Keep incrementing until we find an open period
    while (isPeriodClosed(year, quarter)) {
      quarter++;
      if (quarter > 4) {
        quarter = 1;
        year++;
      }
    }
    
    return {
      period: `${year}-Q${quarter}`,
      year,
      quarter,
    };
  };

  // Ensure a period exists (create if not)
  const ensurePeriodExists = async (year: number, quarter: number) => {
    const period = `${year}-Q${quarter}`;
    const exists = btwPeriods.some(p => p.period === period);
    
    if (!exists) {
      await createPeriodMutation.mutateAsync({
        period,
        year,
        quarter,
        is_closed: false,
      });
    }
  };

  return {
    btwPeriods,
    isLoading,
    createPeriod: createPeriodMutation.mutate,
    updatePeriod: updatePeriodMutation.mutate,
    togglePeriodClosed: togglePeriodClosedMutation.mutate,
    isPeriodClosed,
    getBtwPeriodForDate,
    getNextAvailablePeriod,
    ensurePeriodExists,
    isCreating: createPeriodMutation.isPending,
    isUpdating: updatePeriodMutation.isPending,
  };
}
