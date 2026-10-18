import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Particles, { ParticlesProvider } from '@tsparticles/react';
import type { Engine, ISourceOptions } from '@tsparticles/engine';
import { loadSlim } from '@tsparticles/slim';
import { useAuth, type MfaCode } from '@/contexts/AuthContext';
import { publicBranding } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Briefcase, Eye, EyeOff, FileText, Landmark, Loader2, Receipt } from 'lucide-react';
import { AuthentikLoginButton } from './AuthentikLoginButton';
import { MFAVerify } from './MFAVerify';

const MIN_PASSWORD_LENGTH = 8;

const initLoginParticles = async (engine: Engine) => {
  await loadSlim(engine);
};

const loginParticlesOptions: ISourceOptions = {
  background: { color: { value: 'transparent' } },
  detectRetina: true,
  fpsLimit: 40,
  fullScreen: { enable: false },
  interactivity: {
    events: {
      onHover: { enable: false },
      onClick: { enable: false },
      resize: { enable: true },
    },
  },
  particles: {
    color: { value: ['#93C5FD', '#86EFAC', '#CBD5E1'] },
    links: {
      color: '#93C5FD',
      distance: 150,
      enable: true,
      opacity: 0.18,
      width: 1,
    },
    move: {
      direction: 'none',
      enable: true,
      outModes: { default: 'bounce' },
      random: true,
      speed: 0.35,
      straight: false,
    },
    number: { density: { enable: true }, value: 46 },
    opacity: { value: { min: 0.2, max: 0.45 } },
    shape: { type: 'circle' },
    size: { value: { min: 1.2, max: 3 } },
  },
};

const FEATURES = [
  { icon: FileText, text: 'Professionele facturen in een paar klikken' },
  { icon: Receipt, text: 'Uitgaven, abonnementen en kilometers bijhouden' },
  { icon: Landmark, text: 'Btw-aangifte en jaaroverzicht voorbereid' },
];

interface PublicBranding {
  appName: string;
  logoUrl: string | null;
  registrationEnabled?: boolean;
}

type Mode = 'login' | 'register';

function BrandMark({ appName, logoUrl, inverted = false }: { appName: string; logoUrl?: string | null; inverted?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg bg-white object-contain p-1" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Briefcase className="h-5 w-5 text-primary-foreground" />
        </div>
      )}
      <span className={inverted ? 'text-lg font-semibold text-white' : 'text-lg font-semibold text-foreground'}>
        {appName}
      </span>
    </div>
  );
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const { signIn, signUp, verifyMfa } = useAuth();
  const { toast } = useToast();
  const { data: branding } = useQuery({
    queryKey: ['public-branding'],
    queryFn: async () => {
      const response = await publicBranding.get();
      return response.data as PublicBranding;
    },
    staleTime: 5 * 60 * 1000,
  });
  const appName = branding?.appName || 'MijnZaak';
  const registrationEnabled = branding?.registrationEnabled !== false;
  const isRegister = mode === 'register' && registrationEnabled;

  useEffect(() => {
    if (!branding?.logoUrl) return;

    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) {
      favicon.href = branding.logoUrl;
    }
  }, [branding?.logoUrl]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setPassword('');
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isRegister) {
      const { error: signUpError } = await signUp(email, password);
      setLoading(false);
      if (signUpError) {
        setError(signUpError.message);
      } else {
        toast({ title: 'Account aangemaakt', description: `Welkom bij ${appName}!` });
      }
      return;
    }

    const result = await signIn(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
    } else if (result.mfaToken) {
      setMfaToken(result.mfaToken);
    }
  };

  const handleVerifyMfa = async (code: MfaCode) => {
    if (!mfaToken) return;
    const { error: mfaError } = await verifyMfa(mfaToken, code);
    if (mfaError) {
      toast({ title: 'Verificatie mislukt', description: mfaError.message, variant: 'destructive' });
    }
  };

  const cancelMfa = () => {
    setMfaToken(null);
    setPassword('');
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <aside className="relative isolate hidden overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <ParticlesProvider init={initLoginParticles}>
          <Particles
            id="login-particles"
            className="pointer-events-none absolute inset-0 -z-10"
            options={loginParticlesOptions}
            style={{ height: '100%', width: '100%' }}
          />
        </ParticlesProvider>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,hsl(var(--primary)/0.28),transparent_45%),radial-gradient(circle_at_85%_90%,hsl(var(--accent)/0.16),transparent_40%)]" />

        <BrandMark appName={appName} logoUrl={branding?.logoUrl} inverted />

        <div className="max-w-md space-y-8">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
            Je administratie, overzichtelijk op één plek.
          </h2>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-sidebar-foreground/80">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
                  <Icon className="h-4 w-4 text-white" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-sidebar-foreground/50">
          © {new Date().getFullYear()} {appName}
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <BrandMark appName={appName} logoUrl={branding?.logoUrl} />
          </div>

          {mfaToken ? (
            <MFAVerify onVerify={handleVerifyMfa} onCancel={cancelMfa} />
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {isRegister ? 'Account aanmaken' : 'Welkom terug'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isRegister
                    ? 'Maak een account aan om je administratie te starten.'
                    : 'Log in om verder te gaan met je administratie.'}
                </p>
              </div>

              {!isRegister && <AuthentikLoginButton />}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="auth-email">E-mailadres</Label>
                  <Input
                    id="auth-email"
                    type="email"
                    placeholder="naam@bedrijf.nl"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auth-password">Wachtwoord</Label>
                  <div className="relative">
                    <Input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={isRegister ? `Minimaal ${MIN_PASSWORD_LENGTH} tekens` : '••••••••'}
                      autoComplete={isRegister ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pr-11"
                      minLength={isRegister ? MIN_PASSWORD_LENGTH : undefined}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isRegister ? 'Account aanmaken' : 'Inloggen'}
                </Button>
              </form>

              {registrationEnabled && (
                <p className="text-center text-sm text-muted-foreground">
                  {isRegister ? 'Heb je al een account?' : 'Nog geen account?'}{' '}
                  <button
                    type="button"
                    onClick={() => switchMode(isRegister ? 'login' : 'register')}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {isRegister ? 'Inloggen' : 'Registreren'}
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
