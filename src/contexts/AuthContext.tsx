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
    const userId = localStorage.getItem('userId');

    auth
      .verify()
      .then((response) => {
        const verifiedUserId = response.data?.userId || userId;
        if (verifiedUserId) {
          localStorage.setItem('userId', verifiedUserId);
          setUser({ id: verifiedUserId });
        } else {
          setUser(null);
        }
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userId');
        setLoading(false);
      });
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const response = await auth.register(email, password);
      const { userId, accessToken, refreshToken } = response.data;
      if (accessToken) localStorage.setItem('accessToken', accessToken);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
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
      const { userId, accessToken, refreshToken } = response.data;
      if (accessToken) localStorage.setItem('accessToken', accessToken);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
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
    try {
      await auth.logout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
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
