import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth } from '@/api/client';
import type { AxiosError } from 'axios';

interface AuthUser {
  id: string;
  email?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const token = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId');

    if (token && userId) {
      auth
        .verify()
        .then(() => {
          setUser({ id: userId });
          setLoading(false);
        })
        .catch(() => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('userId');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const response = await auth.register(email, password);
      const { accessToken, refreshToken, userId } = response.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('userId', userId);
      setUser({ id: userId });
      return { error: null };
    } catch (error) {
      const err = error as AxiosError<{ error?: string }>;
      const message = err.response?.data?.error || err.message || 'Registratie mislukt';
      return { error: new Error(message) };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await auth.login(email, password);
      const { accessToken, refreshToken, userId } = response.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('userId', userId);
      setUser({ id: userId });
      return { error: null };
    } catch (error) {
      const err = error as AxiosError<{ error?: string }>;
      const message = err.response?.data?.error || err.message || 'Inloggen mislukt';
      return { error: new Error(message) };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
