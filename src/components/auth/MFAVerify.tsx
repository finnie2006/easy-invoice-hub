import { useState } from 'react';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import type { MfaCode } from '@/contexts/AuthContext';

interface MFAVerifyProps {
  onVerify: (code: MfaCode) => Promise<void>;
  onCancel: () => void;
}

export function MFAVerify({ onVerify, onCancel }: MFAVerifyProps) {
  const [method, setMethod] = useState<'totp' | 'recovery'>('totp');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const isComplete = method === 'totp' ? code.length === 6 : code.trim().length >= 9;

  const submit = async (value = code) => {
    if (loading) return;
    setLoading(true);
    try {
      await onVerify(method === 'totp' ? { totpToken: value } : { recoveryCode: value.trim() });
    } finally {
      setLoading(false);
      setCode('');
    }
  };

  const switchMethod = () => {
    setMethod((current) => (current === 'totp' ? 'recovery' : 'totp'));
    setCode('');
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Tweestapsverificatie</h2>
        <p className="text-sm text-muted-foreground">
          {method === 'totp'
            ? 'Voer de 6-cijferige code uit je authenticator-app in.'
            : 'Voer een van je herstelcodes in (formaat XXXX-XXXX).'}
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (isComplete) void submit();
        }}
      >
        {method === 'totp' ? (
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(value) => setCode(value.replace(/\D/g, ''))}
            onComplete={(value: string) => void submit(value)}
            autoFocus
            disabled={loading}
            containerClassName="justify-center"
            aria-label="Verificatiecode"
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot key={index} index={index} className="h-12 w-11 text-lg" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="recovery-code">Herstelcode</Label>
            <Input
              id="recovery-code"
              placeholder="ABCD-EFGH"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="h-11 text-center font-mono tracking-widest"
              autoComplete="one-time-code"
              autoFocus
              disabled={loading}
            />
          </div>
        )}

        <Button type="submit" className="h-11 w-full" disabled={loading || !isComplete}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verifiëren
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Terug
        </button>
        <button
          type="button"
          onClick={switchMethod}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {method === 'totp' ? 'Herstelcode gebruiken' : 'Authenticator-code gebruiken'}
        </button>
      </div>
    </div>
  );
}
