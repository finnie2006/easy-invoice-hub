import { describe, expect, it } from 'vitest';
import { getOAuthReturnToFromLocation, getSafeOAuthReturnTo } from './auth-redirect';

describe('OAuth redirect helpers', () => {
  it('allows internal app paths including search and hash', () => {
    expect(getSafeOAuthReturnTo('/invoices/123?tab=preview#notes')).toBe('/invoices/123?tab=preview#notes');
  });

  it('rejects external and auth callback paths', () => {
    expect(getSafeOAuthReturnTo('https://example.com/invoices')).toBe('/');
    expect(getSafeOAuthReturnTo('//example.com/invoices')).toBe('/');
    expect(getSafeOAuthReturnTo('/auth/callback?code=abc')).toBe('/');
    expect(getSafeOAuthReturnTo('/auth')).toBe('/');
  });

  it('builds a safe path from a router location', () => {
    expect(getOAuthReturnToFromLocation({
      pathname: '/reports',
      search: '?year=2026',
      hash: '#btw',
    })).toBe('/reports?year=2026#btw');
  });
});
