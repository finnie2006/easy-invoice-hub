import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function MFAVerify({ userId, onVerify, onError }) {
  const [method, setMethod] = useState('totp'); // totp or recovery
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!code) return;

    setLoading(true);
    try {
      const response = await fetch('/api/auth/mfa/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...(method === 'totp'
            ? { totpToken: code }
            : { recoveryCode: code }),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Invalid code');
      }

      const data = await response.json();
      onVerify(data);
    } catch (error) {
      onError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md p-6">
      <h2 className="text-2xl font-bold mb-4">Two-Factor Authentication</h2>

      <Alert className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Enter your 6-digit code or a recovery code to continue
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setMethod('totp');
              setCode('');
            }}
            className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
              method === 'totp'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Authenticator
          </button>
          <button
            onClick={() => {
              setMethod('recovery');
              setCode('');
            }}
            className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
              method === 'recovery'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Recovery Code
          </button>
        </div>

        {method === 'totp' ? (
          <div>
            <label className="block text-sm font-medium mb-2">
              6-digit code from your app:
            </label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="000000"
              maxLength="6"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-widest"
              autoFocus
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-2">
              Recovery code (format: XXXX-XXXX):
            </label>
            <Input
              type="text"
              placeholder="ABCD-EFGH"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono text-center"
              autoFocus
            />
          </div>
        )}

        <Button
          onClick={handleVerify}
          disabled={loading || !code}
          className="w-full"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </Button>
      </div>
    </Card>
  );
}
