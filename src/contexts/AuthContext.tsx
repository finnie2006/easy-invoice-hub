import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { AUTH_SESSION_EXPIRED_EVENT, auth } from '@/api/client';
import type { AxiosError } from 'axios';
import { useQueryClient } from '@tanstack/react-query';

interface AuthUser {
  id: string;
  email?: string;
}

export type MfaCode = { totpToken: string } | { recoveryCode: string };

interface SignInResult {
  error: Error | null;
  /** Set when the password was correct but a second factor is still required. */
  mfaToken?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  verifyMfa: (mfaToken: string, code: MfaCode) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  completeOAuthSignIn: (userId: string, accessToken?: string, refreshToken?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const toError = (error: unknown, fallback: string) => {
  const err = error as AxiosError<{ error?: string }>;
  return new Error(err.response?.data?.error || err.message || fallback);
};

const clearStoredAuth = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userId');
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    clearStoredAuth();
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

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
        clearStoredAuth();
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, clearSession);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, clearSession);
  }, [clearSession]);

  const storeSession = (data: { userId: string; accessToken?: string; refreshToken?: string }) => {
    if (data.accessToken) localStorage.setItem('accessToken', data.accessToken);
    if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('userId', data.userId);
    setUser({ id: data.userId });
  };

  const signUp = async (email: string, password: string) => {
    try {
      const response = await auth.register(email, password);
      storeSession(response.data);
      return { error: null };
    } catch (error) {
      return { error: toError(error, 'Registratie mislukt') };
    }
  };

  const signIn = async (email: string, password: string): Promise<SignInResult> => {
    try {
      const response = await auth.login(email, password);
      if (response.data?.mfaRequired) {
        return { error: null, mfaToken: response.data.mfaToken };
      }
      storeSession(response.data);
      return { error: null };
    } catch (error) {
      return { error: toError(error, 'Inloggen mislukt') };
    }
  };

  const verifyMfa = async (mfaToken: string, code: MfaCode) => {
    try {
      const response = await auth.verifyMfa(mfaToken, code);
      storeSession(response.data);
      return { error: null };
    } catch (error) {
      return { error: toError(error, 'Verificatie mislukt') };
    }
  };

  const signOut = async () => {
    try {
      await auth.logout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
    clearSession();
  };

  const completeOAuthSignIn = useCallback((userId: string, accessToken?: string, refreshToken?: string) => {
    if (accessToken) localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('userId', userId);
    setUser({ id: userId });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, verifyMfa, signOut, completeOAuthSignIn }}>
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
