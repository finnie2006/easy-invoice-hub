import { describe, expect, it } from 'vitest';
import {
  getBookValueEndOfYear,
  getCapitalizedExpenseIds,
  getDepreciationForPeriod,
  getDepreciationForYear,
  getExpenseCostExclBtw,
  isDepreciatingInYear,
} from './depreciation';

const laptop = {
  purchase_date: '2026-10-15',
  purchase_price: 1200,
  residual_value: 0,
  useful_life_years: 5,
};

describe('depreciation', () => {
  it('depreciates pro rata per month from the purchase month', () => {
    // okt t/m dec = 3 van 60 maanden
    expect(getDepreciationForYear(laptop, 2026)).toBe(60);
    expect(getDepreciationForYear(laptop, 2027)).toBe(240);
  });

  it('carries the remainder into an extra partial year', () => {
    expect(getDepreciationForYear(laptop, 2031)).toBe(180);
    expect(getDepreciationForYear(laptop, 2032)).toBe(0);
    const total = [2026, 2027, 2028, 2029, 2030, 2031].reduce((sum, y) => sum + getDepreciationForYear(laptop, y), 0);
    expect(total).toBe(1200);
    expect(isDepreciatingInYear(laptop, 2031)).toBe(true);
    expect(isDepreciatingInYear(laptop, 2032)).toBe(false);
  });

  it('fully depreciates a one-year asset', () => {
    const asset = { ...laptop, useful_life_years: 1 };
    expect(getDepreciationForYear(asset, 2026) + getDepreciationForYear(asset, 2027)).toBe(1200);
  });

  it('respects the residual value and keeps cents exact', () => {
    const asset = { purchase_date: '2026-01-01', purchase_price: '1000.00', residual_value: '100.00', useful_life_years: 3 };
    const years = [2026, 2027, 2028].map((y) => getDepreciationForYear(asset, y));
    expect(years.reduce((a, b) => a + b, 0)).toBeCloseTo(900, 2);
    expect(getBookValueEndOfYear(asset, 2028)).toBe(100);
  });

  it('calculates depreciation for a quarter', () => {
    expect(getDepreciationForPeriod(laptop, new Date(2026, 9, 1), new Date(2026, 11, 31))).toBe(60);
    expect(getDepreciationForPeriod(laptop, new Date(2026, 6, 1), new Date(2026, 8, 30))).toBe(0);
  });

  it('excludes capitalized expenses from direct costs', () => {
    const ids = getCapitalizedExpenseIds([{ expense_id: 'a' }, { expense_id: null }]);
    expect(getExpenseCostExclBtw({ id: 'a', amount_excl_btw: 1200 }, ids)).toBe(0);
    expect(getExpenseCostExclBtw({ id: 'b', amount_excl_btw: '50' }, ids)).toBe(50);
  });
});
