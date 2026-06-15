import { describe, expect, it } from 'vitest';
import { calculateExpenseVatAmounts, getExpensePaidAmount } from './expense-vat';

describe('expense VAT calculations', () => {
  it('keeps EU reverse-charge purchases at the paid net amount and calculates Dutch VAT separately', () => {
    expect(calculateExpenseVatAmounts({
      inputAmount: 1000,
      inputMode: 'excl',
      btwPercentage: 21,
      hasReverseCharge: true,
    })).toEqual({
      amountInclBtw: 1000,
      amountExclBtw: 1000,
      btwAmount: 210,
    });
  });

  it('calculates regular Dutch VAT from an amount including VAT', () => {
    expect(calculateExpenseVatAmounts({
      inputAmount: 121,
      inputMode: 'incl',
      btwPercentage: 21,
      hasReverseCharge: false,
    })).toEqual({
      amountInclBtw: 121,
      amountExclBtw: 100,
      btwAmount: 21,
    });
  });

  it('accepts numeric strings returned by the database', () => {
    expect(calculateExpenseVatAmounts({
      inputAmount: '108.69',
      inputMode: 'excl',
      btwPercentage: '21.00',
      hasReverseCharge: true,
    })).toEqual({
      amountInclBtw: 108.69,
      amountExclBtw: 108.69,
      btwAmount: 22.82,
    });
  });

  it('uses the net amount as paid amount for old reverse-charge records', () => {
    expect(getExpensePaidAmount({
      amount_excl_btw: 1000,
      amount_incl_btw: 1210,
      has_reverse_charge: true,
    })).toBe(1000);
  });
});
