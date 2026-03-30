import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for OAuth callback
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        // Check for old-style error callback
        const errorMessage = searchParams.get('error_description') || searchParams.get('error');
        if (errorMessage && !code) {
          setError(errorMessage);
          toast({
            title: 'Inloggen mislukt',
            description: errorMessage,
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        // If OAuth code is present, handle OAuth callback
        if (code) {
          // Retrieve state from session storage (set during OAuth initiation)
          const sessionState = sessionStorage.getItem('oauth_state');
          sessionStorage.removeItem('oauth_state');

          if (!sessionState) {
            throw new Error('Invalid session state - please try again');
          }

          // Exchange code for tokens
          const response = await fetch('/api/auth/oauth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              state,
              sessionState,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'OAuth callback failed');
          }

          const data = await response.json();

          // Store tokens
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          localStorage.setItem('userId', data.userId);

          // Show welcome message for new users
          if (data.isNewUser) {
            toast({
              title: 'Welkom!',
              description: `Account aangemaakt voor ${data.email}`,
            });
          } else {
            toast({
              title: 'Ingelogd',
              description: `Welkom terug!`,
            });
          }

          // Redirect to dashboard
          navigate('/', { replace: true });
          return;
        }

        // Fallback: show message
        toast({
          title: 'Callback verwerkt',
          description: 'Je kunt nu inloggen.',
        });
        navigate('/auth', { replace: true });
      } catch (err) {
        console.error('Auth callback error:', err);
        const message = err instanceof Error ? err.message : 'Authentication failed';
        setError(message);
        toast({
          title: 'Fout bij authenticatie',
          description: message,
          variant: 'destructive',
        });

        setTimeout(() => {
          navigate('/auth', { replace: true });
        }, 3000);
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, navigate, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Authenticatie wordt verwerkt...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md p-8">
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <p className="text-sm text-gray-600 text-center">
            Je wordt teruggestuurd naar de inlogpagina...
          </p>
        </Card>
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
