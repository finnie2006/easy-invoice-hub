import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clients as clientsApi } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Client {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  kvk_number: string | null;
  btw_number: string | null;
  notes: string | null;
  is_saved: boolean;
  created_at: string;
  updated_at: string;
}

export type ClientInsert = Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export function useClients() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const response = await clientsApi.getAll();
      return response.data as Client[];
    },
    enabled: !!user,
  });

  const createClient = useMutation({
    mutationFn: async (client: ClientInsert) => {
      if (!user) throw new Error('Not authenticated');

      const response = await clientsApi.create(client);
      return response.data as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: 'Klant aangemaakt',
        description: 'De klant is toegevoegd aan je klantenbestand.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken klant',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Client> & { id: string }) => {
      await clientsApi.update(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: 'Klant bijgewerkt',
        description: 'De klantgegevens zijn opgeslagen.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken klant',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      await clientsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: 'Klant verwijderd',
        description: 'De klant is verwijderd uit je bestand.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    clients,
    isLoading,
    createClient: createClient.mutateAsync,
    updateClient: updateClient.mutate,
    deleteClient: deleteClient.mutate,
    isCreating: createClient.isPending,
  };
}
