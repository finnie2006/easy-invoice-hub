import { describe, expect, it } from 'vitest';
import { formatInvoiceQuantity } from './invoice-format';

describe('invoice quantity formatting', () => {
  it('removes trailing decimals for whole quantities', () => {
    expect(formatInvoiceQuantity('1.00', 'dag')).toBe('1 dag');
    expect(formatInvoiceQuantity(3, 'maand')).toBe('3 maanden');
  });

  it('keeps meaningful decimals in Dutch notation', () => {
    expect(formatInvoiceQuantity(1.5, 'uur')).toBe('1,5 uur');
    expect(formatInvoiceQuantity('1.25', 'dag')).toBe('1,25 dagen');
  });

  it('formats supported invoice periods', () => {
    expect(formatInvoiceQuantity(1, 'maand')).toBe('1 maand');
    expect(formatInvoiceQuantity(6, 'maand')).toBe('6 maanden');
    expect(formatInvoiceQuantity(1, 'jaar')).toBe('1 jaar');
  });

  it('omits the unit when no unit is selected', () => {
    expect(formatInvoiceQuantity('1.00', null)).toBe('1');
  });
});
