import { useEffect, useState } from 'react';
import { Link2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { MFASetup } from '../auth/MFASetup';

export function MFASettings() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  const [oauthEnabled, setOauthEnabled] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkMFAStatus();
    checkOAuthConfig();
  }, []);

  const checkOAuthConfig = async () => {
    try {
      const response = await fetch('/api/auth/oauth/config', {
        credentials: 'include',
      });
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setOauthEnabled(Boolean(data.enabled));
    } catch (error) {
      console.error('Error checking OAuth status:', error);
    }
  };

  const checkMFAStatus = async () => {
    try {
      const response = await fetch('/api/auth/mfa/status', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setMfaEnabled(data.mfaEnabled);
      }
    } catch (error) {
      console.error('Error checking MFA status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupComplete = () => {
    setShowSetup(false);
    setMfaEnabled(true);
    toast({
      title: 'Success',
      description: 'Two-factor authentication has been enabled.',
    });
  };

  const handleDisableMFA = async () => {
    if (!disablePassword) {
      toast({
        title: 'Error',
        description: 'Please enter your password to disable MFA',
        variant: 'destructive',
      });
      return;
    }

    setDisableLoading(true);
    try {
      const response = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ password: disablePassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to disable MFA');
      }

      setMfaEnabled(false);
      setDisablePassword('');
      toast({
        title: 'Success',
        description: 'Two-factor authentication has been disabled.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDisableLoading(false);
    }
  };

  const handleLinkAuthentik = async () => {
    setLinkLoading(true);
    try {
      const response = await fetch('/api/auth/oauth/link/authorize', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initiate Authentik linking');
      }

      const data = await response.json();
      sessionStorage.setItem('oauth_state', data.state || '');
      sessionStorage.setItem('oauth_mode', 'link');
      window.location.href = data.url;
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to link Authentik account',
        variant: 'destructive',
      });
      setLinkLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Two-Factor Authentication</h3>
          </div>
          <div className="text-sm font-medium">
            {mfaEnabled ? (
              <span className="text-green-600">Enabled</span>
            ) : (
              <span className="text-gray-500">Disabled</span>
            )}
          </div>
        </div>

        {mfaEnabled ? (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Your account is protected with two-factor authentication using an authenticator app.
              </AlertDescription>
            </Alert>

            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <h4 className="font-semibold text-red-900 mb-3">Disable MFA</h4>
              <p className="text-sm text-red-800 mb-3">
                This will remove two-factor authentication from your account.
                You'll only need your password to sign in.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-red-900 mb-1">
                    Confirm your password:
                  </label>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleDisableMFA}
                  disabled={disableLoading || !disablePassword}
                  variant="destructive"
                  className="w-full"
                >
                  {disableLoading ? 'Disabling...' : 'Disable MFA'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">
              Add an extra layer of security to your account with two-factor authentication.
              You'll need to enter a code from your phone in addition to your password when signing in.
            </p>

            <Button onClick={() => setShowSetup(true)} className="w-full">
              Enable Two-Factor Authentication
            </Button>
          </div>
        )}

        {oauthEnabled && (
          <div className="mt-6 border-t pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-muted-foreground" />
              <h4 className="font-semibold">Authentik account koppelen</h4>
            </div>
            <p className="text-sm text-gray-600">
              Koppel je huidige account aan Authentik zodat je ook met Single Sign-On kunt inloggen.
            </p>
            <Button onClick={handleLinkAuthentik} disabled={linkLoading} variant="outline" className="w-full">
              {linkLoading ? 'Doorsturen naar Authentik...' : 'Koppel met Authentik'}
            </Button>
          </div>
        )}
      </Card>

      {showSetup && (
        <MFASetup
          onComplete={handleSetupComplete}
          onCancel={() => setShowSetup(false)}
        />
      )}
    </>
  );
}
