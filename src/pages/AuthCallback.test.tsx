import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthCallback from './AuthCallback';

const completeOAuthSignInMock = vi.fn();
const navigateMock = vi.fn();
const toastMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    completeOAuthSignIn: completeOAuthSignInMock,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('AuthCallback', () => {
  beforeEach(() => {
    sessionStorage.clear();
    completeOAuthSignInMock.mockClear();
    navigateMock.mockClear();
    toastMock.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('completes OAuth login and navigates to the stored safe return path', async () => {
    sessionStorage.setItem('oauth_state', 'expected-state');
    sessionStorage.setItem('oauth_mode', 'login');
    sessionStorage.setItem('oauth_return_to', '/invoices/123?tab=preview#notes');

    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        userId: 'user-1',
        email: 'user@example.com',
        isNewUser: false,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(
      <MemoryRouter
        initialEntries={['/auth/callback?code=abc&state=expected-state']}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <AuthCallback />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(completeOAuthSignInMock).toHaveBeenCalledWith('user-1', 'access-token', 'refresh-token');
    });

    expect(navigateMock).toHaveBeenCalledWith('/invoices/123?tab=preview#notes', { replace: true });
    expect(sessionStorage.getItem('oauth_state')).toBeNull();
    expect(sessionStorage.getItem('oauth_return_to')).toBeNull();
  });

  it('rejects mismatched OAuth state before calling the backend', async () => {
    sessionStorage.setItem('oauth_state', 'expected-state');
    sessionStorage.setItem('oauth_mode', 'login');
    const fetchMock = vi.spyOn(window, 'fetch');

    render(
      <MemoryRouter
        initialEntries={['/auth/callback?code=abc&state=wrong-state']}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <AuthCallback />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Fout bij authenticatie',
        variant: 'destructive',
      }));
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(completeOAuthSignInMock).not.toHaveBeenCalled();
  });
});
