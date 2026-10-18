import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react';
import { getOAuthReturnToFromLocation, getSafeOAuthReturnTo } from '@/lib/auth-redirect';

export function AuthentikLoginButton() {
  const location = useLocation();
  const [oauthEnabled, setOauthEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if OAuth is configured
    const checkOAuthConfig = async () => {
      try {
        const response = await fetch('/api/auth/oauth/config');
        const data = await response.json();
        setOauthEnabled(data.enabled);
      } catch (err) {
        console.error('Failed to check OAuth config:', err);
      }
    };

    checkOAuthConfig();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get authorization URL from backend
      const response = await fetch('/api/auth/oauth/authorize', {
        method: 'POST',
      });
      const data = await response.json().catch(() => null) as { url?: string; state?: string; error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error || 'Authentik login kon niet worden gestart');
      }

      if (!data?.url || !data.state) {
        throw new Error('Authentik gaf geen geldige login-URL terug');
      }

      // Store state for CSRF validation on callback
      sessionStorage.setItem('oauth_state', data.state);
      sessionStorage.setItem('oauth_mode', 'login');
      const from = (location.state as { from?: string } | null)?.from;
      sessionStorage.setItem(
        'oauth_return_to',
        from ? getSafeOAuthReturnTo(from) : getOAuthReturnToFromLocation(location)
      );

      // Redirect to Authentik
      window.location.href = data.url;
    } catch (err) {
      console.error('OAuth login error:', err);
      setError(err instanceof Error ? err.message : 'Inloggen mislukt');
      setLoading(false);
    }
  };

  if (!oauthEnabled) {
    return null;
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        type="button"
        onClick={handleLogin}
        disabled={loading}
        variant="outline"
        className="h-11 w-full"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
        {loading ? 'Doorsturen naar Authentik…' : 'Inloggen met Authentik'}
      </Button>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        of met e-mail
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
