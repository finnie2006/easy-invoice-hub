import { describe, expect, it } from 'vitest';
import { applyUnitChange, formatInvoiceQuantity, getUnitPriceLabel } from './invoice-format';

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

  it('formats performances as invoice units', () => {
    expect(formatInvoiceQuantity(1, 'optreden')).toBe('1 optreden');
    expect(formatInvoiceQuantity(2, 'optreden')).toBe('2 optredens');
  });

  it('formats kilometers as invoice units', () => {
    expect(formatInvoiceQuantity(1, 'km')).toBe('1 km');
    expect(formatInvoiceQuantity('42.5', 'km')).toBe('42,5 km');
  });

  it('labels the unit price per unit', () => {
    expect(getUnitPriceLabel('km')).toBe('Prijs per km (€)');
    expect(getUnitPriceLabel(null)).toBe('Prijs (€)');
  });

  it('omits the unit when no unit is selected', () => {
    expect(formatInvoiceQuantity('1.00', null)).toBe('1');
  });

  it('shows a dash for an empty quantity', () => {
    expect(formatInvoiceQuantity(null, null)).toBe('-');
    expect(formatInvoiceQuantity('', 'uur')).toBe('-');
  });
});

describe('invoice unit changes', () => {
  const rates = { hourly: 75, km: 0.3 };

  it('uses the km rate when switching a default line to km', () => {
    expect(applyUnitChange({ unit: 'uur', unit_price: 75 }, 'km', rates)).toEqual({ unit: 'km', unit_price: 0.3 });
  });

  it('falls back to the default km rate when none is configured', () => {
    expect(applyUnitChange({ unit: 'stuk', unit_price: 0 }, 'km', { hourly: 75 }).unit_price).toBe(0.25);
  });

  it('treats prices loaded as strings like numbers', () => {
    expect(applyUnitChange({ unit: 'uur', unit_price: '75.00' }, 'km', rates).unit_price).toBe(0.3);
  });

  it('keeps a custom price', () => {
    expect(applyUnitChange({ unit: 'uur', unit_price: 90 }, 'km', rates)).toEqual({ unit: 'km', unit_price: 90 });
  });
});
