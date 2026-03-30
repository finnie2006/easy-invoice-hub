import { useState } from 'react';
import { AlertCircle, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

export function MFASetup({ onComplete, onCancel }) {
  const [step, setStep] = useState('generate'); // generate, verify, backup
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [totpToken, setTotpToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [showCodes, setShowCodes] = useState(false);
  const { toast } = useToast();

  const generateMFA = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/mfa/setup', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to setup MFA');

      const data = await response.json();
      setSecret(data.secret);
      setQrCode(data.qrCode);
      setRecoveryCodes(data.recoveryCodes);
      setStep('verify');
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyMFA = async () => {
    if (!totpToken || totpToken.length !== 6) {
      toast({
        title: 'Invalid code',
        description: 'Enter a 6-digit code from your authenticator app',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ secret, totpToken }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to verify MFA');
      }

      const data = await response.json();
      setRecoveryCodes(data.recoveryCodes);
      setStep('backup');
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const downloadCodes = () => {
    const csv = recoveryCodes.join('\n');
    const blob = new Blob([csv], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoice-hub-recovery-codes.txt';
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-2xl font-bold mb-4">Setup Two-Factor Authentication</h2>

        {step === 'generate' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Two-factor authentication adds an extra layer of security to your account.
              You'll need an authenticator app like Google Authenticator or Authy.
            </p>
            <Button onClick={generateMFA} disabled={loading} className="w-full">
              {loading ? 'Generating...' : 'Start Setup'}
            </Button>
            <Button onClick={onCancel} variant="outline" className="w-full">
              Cancel
            </Button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Scan this QR code with your authenticator app
              </AlertDescription>
            </Alert>

            {qrCode && (
              <div className="flex justify-center p-4 bg-gray-50 rounded-lg">
                <img src={qrCode} alt="QR Code" className="w-48 h-48" />
              </div>
            )}

            <div className="text-xs text-gray-500 text-center">
              Can't scan? Enter this code manually:
              <div className="font-mono bg-gray-50 p-2 rounded mt-2 break-all">
                {secret}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Enter 6-digit code from your app:
              </label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength="6"
                value={totpToken}
                onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest"
              />
            </div>

            <Button onClick={verifyMFA} disabled={loading || totpToken.length !== 6} className="w-full">
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </Button>
          </div>
        )}

        {step === 'backup' && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Save your recovery codes in a secure location. Each code can only be used once.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Recovery Codes:</label>
                <button
                  onClick={() => setShowCodes(!showCodes)}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  {showCodes ? (
                    <>
                      <EyeOff className="w-4 h-4" /> Hide
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" /> Show
                    </>
                  )}
                </button>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg space-y-2 max-h-48 overflow-y-auto">
                {showCodes ? (
                  recoveryCodes.map((code, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm font-mono hover:bg-gray-100 p-2 rounded group cursor-pointer"
                      onClick={() => copyCode(code)}
                    >
                      <span>{code}</span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {copiedCode === code ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Codes hidden. Click "Show" to display them.
                  </div>
                )}
              </div>
            </div>

            <Button onClick={downloadCodes} variant="outline" className="w-full">
              Download Codes
            </Button>

            <Button onClick={onComplete} className="w-full">
              I've Saved My Codes
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
