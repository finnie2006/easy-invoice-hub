import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Particles, { ParticlesProvider } from '@tsparticles/react';
import type { Engine, ISourceOptions } from '@tsparticles/engine';
import { loadSlim } from '@tsparticles/slim';
import { useAuth } from '@/contexts/AuthContext';
import { publicBranding } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Briefcase, Loader2 } from 'lucide-react';
import { AuthentikLoginButton } from './AuthentikLoginButton';

const initLoginParticles = async (engine: Engine) => {
  await loadSlim(engine);
};

const loginParticlesOptions: ISourceOptions = {
  background: {
    color: {
      value: 'transparent',
    },
  },
  detectRetina: true,
  fpsLimit: 40,
  fullScreen: {
    enable: false,
  },
  interactivity: {
    events: {
      onHover: {
        enable: false,
      },
      onClick: {
        enable: false,
      },
      resize: {
        enable: true,
      },
    },
  },
  particles: {
    color: {
      value: ['#2563EB', '#16A34A', '#64748B'],
    },
    links: {
      color: '#2563EB',
      distance: 155,
      enable: true,
      opacity: 0.26,
      width: 1,
    },
    move: {
      direction: 'none',
      enable: true,
      outModes: {
        default: 'bounce',
      },
      random: true,
      speed: 0.45,
      straight: false,
    },
    number: {
      density: {
        enable: true,
      },
      value: 58,
    },
    opacity: {
      value: {
        min: 0.28,
        max: 0.48,
      },
    },
    shape: {
      type: 'circle',
    },
    size: {
      value: {
        min: 1.4,
        max: 3.8,
      },
    },
  },
};

interface PublicBranding {
  appName: string;
  logoUrl: string | null;
}

export function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
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

  useEffect(() => {
    if (!branding?.logoUrl) return;

    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) {
      favicon.href = branding.logoUrl;
    }
  }, [branding?.logoUrl]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    
    if (error) {
      toast({
        title: 'Inloggen mislukt',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);
    
    if (error) {
      toast({
        title: 'Registratie mislukt',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Account aangemaakt!',
        description: 'Je kunt nu inloggen.',
      });
    }
  };

  return (
    <div className="relative isolate min-h-screen flex items-center justify-center overflow-hidden bg-background p-4">
      <ParticlesProvider init={initLoginParticles}>
        <Particles
          id="login-particles"
          className="pointer-events-none absolute inset-0 z-0"
          options={loginParticlesOptions}
          style={{ height: '100%', width: '100%' }}
        />
      </ParticlesProvider>
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.06),transparent_32%)]" />
      <div className="relative z-10 w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="p-2 bg-primary rounded-lg">
            <Briefcase className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{appName}</h1>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Welkom</CardTitle>
            <CardDescription>
              Log in of maak een account aan om te beginnen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Authentik OAuth Button */}
            <AuthentikLoginButton />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Of met e-mail
                </span>
              </div>
            </div>

            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Inloggen</TabsTrigger>
                <TabsTrigger value="register">Registreren</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-mailadres</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="naam@bedrijf.nl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Wachtwoord</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Inloggen
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-email">E-mailadres</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="naam@bedrijf.nl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Wachtwoord</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Account aanmaken
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
