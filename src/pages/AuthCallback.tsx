import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const storedState = sessionStorage.getItem('authentik_state');

      // Check if this is a Supabase auth callback (magic link)
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      
      if (accessToken && refreshToken) {
        // This is a Supabase magic link callback
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (error) {
          setError(error.message);
          toast({
            title: 'Inloggen mislukt',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          navigate('/', { replace: true });
        }
        return;
      }

      // Authentik OAuth callback
      if (!code) {
        // No code, might be returning from magic link
        navigate('/', { replace: true });
        return;
      }

      // Verify state for CSRF protection
      if (state !== storedState) {
        setError('State mismatch - mogelijk CSRF aanval');
        toast({
          title: 'Beveiligingsfout',
          description: 'State verificatie mislukt',
          variant: 'destructive',
        });
        return;
      }

      // Clear stored state
      sessionStorage.removeItem('authentik_state');

      try {
        // Exchange code for session via edge function
        const { data, error } = await supabase.functions.invoke('authentik-callback', {
          body: { code, state },
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data.error) {
          throw new Error(data.error);
        }

        // If we got a redirect URL (magic link), use it
        if (data.redirectUrl) {
          // The redirect URL contains the token, we need to handle it
          // Extract and set the session
          const url = new URL(data.redirectUrl);
          const token = url.hash ? new URLSearchParams(url.hash.slice(1)) : url.searchParams;
          
          const access_token = token.get('access_token');
          const refresh_token = token.get('refresh_token');
          
          if (access_token && refresh_token) {
            await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
          } else {
            // Redirect to the magic link URL
            window.location.href = data.redirectUrl;
            return;
          }
        }

        toast({
          title: 'Ingelogd!',
          description: `Welkom ${data.email}`,
        });

        navigate('/', { replace: true });
      } catch (err: any) {
        console.error('Callback error:', err);
        setError(err.message);
        toast({
          title: 'Inloggen mislukt',
          description: err.message,
          variant: 'destructive',
        });
      }
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
