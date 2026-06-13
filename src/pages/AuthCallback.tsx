import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getSafeOAuthReturnTo } from '@/lib/auth-redirect';

interface OAuthCallbackResponse {
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  email?: string;
  isNewUser?: boolean;
}

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { completeOAuthSignIn } = useAuth();
  const hasHandledCallback = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      if (hasHandledCallback.current) {
        return;
      }
      hasHandledCallback.current = true;

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
          window.setTimeout(() => {
            navigate('/auth', { replace: true });
          }, 3000);
          setLoading(false);
          return;
        }

        // If OAuth code is present, handle OAuth callback
        if (code) {
          // Retrieve state from session storage (set during OAuth initiation)
          const sessionState = sessionStorage.getItem('oauth_state');
          const oauthMode = sessionStorage.getItem('oauth_mode') || 'login';
          const returnTo = getSafeOAuthReturnTo(sessionStorage.getItem('oauth_return_to'));
          sessionStorage.removeItem('oauth_state');
          sessionStorage.removeItem('oauth_mode');
          sessionStorage.removeItem('oauth_return_to');

          if (!sessionState) {
            throw new Error('Ongeldige Authentik sessie. Probeer opnieuw in te loggen.');
          }

          if (!state || state !== sessionState) {
            throw new Error('Authentik sessie kon niet worden gevalideerd. Probeer opnieuw in te loggen.');
          }

          const callbackEndpoint = oauthMode === 'link'
            ? '/api/auth/oauth/link/callback'
            : '/api/auth/oauth/callback';

          // Exchange code for tokens or complete linking
          const response = await fetch(callbackEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              code,
              state,
              sessionState,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => null) as { error?: string } | null;
            throw new Error(errorData?.error || 'Authentik callback kon niet worden verwerkt');
          }

          const data = await response.json() as OAuthCallbackResponse;

          if (oauthMode === 'link') {
            toast({
              title: 'Authentik gekoppeld',
              description: 'Je bestaande account is nu gekoppeld aan Authentik.',
            });
            navigate('/settings', { replace: true });
            return;
          }

          if (!data.userId) {
            throw new Error('Authentik login is gelukt, maar de gebruiker kon niet worden bepaald.');
          }

          completeOAuthSignIn(data.userId, data.accessToken, data.refreshToken);

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

          navigate(returnTo, { replace: true });
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
  }, [searchParams, navigate, toast, completeOAuthSignIn]);

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
