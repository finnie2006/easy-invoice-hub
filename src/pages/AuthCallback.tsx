import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const errorMessage = searchParams.get('error_description') || searchParams.get('error');
      if (errorMessage) {
        setError(errorMessage);
        toast({
          title: 'Inloggen mislukt',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Callback verwerkt',
        description: 'Je kunt nu inloggen met e-mail en wachtwoord.',
      });
      navigate('/auth', { replace: true });
    };

    handleCallback();
  }, [searchParams, navigate, toast]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <a href="/auth" className="text-primary hover:underline">
            Terug naar inloggen
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Bezig met inloggen...</p>
      </div>
    </div>
  );
}
