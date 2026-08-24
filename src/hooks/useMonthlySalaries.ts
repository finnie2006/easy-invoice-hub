import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { monthlySalaries as monthlySalariesApi } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface MonthlySalary {
  id: string;
  user_id: string;
  year: number;
  month: number;
  gross_amount: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlySalaryInput {
  year: number;
  month: number;
  gross_amount: number;
}

export function useMonthlySalaries(year: number) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: salaries = [], isLoading } = useQuery({
    queryKey: ['monthly-salaries', user?.id, year],
    queryFn: async () => {
      if (!user) return [];
      const response = await monthlySalariesApi.getByYear(year);
      return response.data as MonthlySalary[];
    },
    enabled: !!user,
  });

  const saveSalary = useMutation({
    mutationFn: async (data: MonthlySalaryInput) => {
      if (!user) throw new Error('Not authenticated');
      const response = await monthlySalariesApi.save(data);
      return response.data as MonthlySalary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-salaries', user?.id, year] });
      toast({ title: 'Loon opgeslagen' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij opslaan loon', description: error.message, variant: 'destructive' });
    },
  });

  const saveSalaries = useMutation({
    mutationFn: async (data: MonthlySalaryInput[]) => {
      if (!user) throw new Error('Not authenticated');
      const response = await monthlySalariesApi.saveMany({ salaries: data });
      return response.data as MonthlySalary[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-salaries', user?.id, year] });
      toast({ title: 'Loon opgeslagen' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij opslaan loon', description: error.message, variant: 'destructive' });
    },
  });

  return {
    salaries,
    isLoading,
    saveSalary: saveSalary.mutateAsync,
    saveSalaries: saveSalaries.mutateAsync,
    isSaving: saveSalary.isPending || saveSalaries.isPending,
  };
}