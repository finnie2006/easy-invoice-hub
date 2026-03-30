import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export function AuthentikLoginButton() {
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

      if (!response.ok) {
        throw new Error('Failed to get authorization URL');
      }

      const data = await response.json();

      // Store state for CSRF validation on callback
      sessionStorage.setItem('oauth_state', data.url.match(/state=([^&]+)/)?.[1] || '');

      // Redirect to Authentik
      window.location.href = data.url;
    } catch (err) {
      console.error('OAuth login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  };

  if (!oauthEnabled) {
    return null;
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handleLogin}
        disabled={loading}
        variant="outline"
        className="w-full"
      >
        {loading ? 'Redirecting to Authentik...' : 'Login with Authentik'}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or</span>
        </div>
      </div>
    </div>
  );
}
