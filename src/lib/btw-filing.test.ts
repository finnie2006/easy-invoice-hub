import { describe, expect, it } from 'vitest';
import { calculateBtwFilingAmounts } from './btw-filing';

describe('btw filing calculations', () => {
  it('matches the Belastingdienst domestic example for 1a, 5b and payable VAT', () => {
    const result = calculateBtwFilingAmounts(
      2026,
      1,
      [
        {
          invoice_date: '2026-02-15',
          status: 'sent',
          subtotal: 5000,
          total_btw: 1050,
        },
      ],
      [
        {
          expense_date: '2026-02-20',
          amount_excl_btw: 1000,
          btw_amount: 210,
          has_reverse_charge: false,
          btw_period: '2026-Q1',
        },
      ]
    );

    expect(result.turnover_1a).toBe(5000);
    expect(result.field_1a).toBe(1050);
    expect(result.field_5a).toBe(1050);
    expect(result.field_5b).toBe(210);
    expect(result.field_5c).toBe(840);
  });

  it('books EU reverse-charge purchases to 4b and deducts the same VAT at 5b', () => {
    const result = calculateBtwFilingAmounts(
      2026,
      2,
      [],
      [
        {
          expense_date: '2026-05-10',
          amount_excl_btw: 1000,
          btw_amount: 210,
          has_reverse_charge: true,
          reverse_charge_type: 'eu',
          btw_period: '2026-Q2',
        },
      ]
    );

    expect(result.turnover_4b).toBe(1000);
    expect(result.field_4b).toBe(210);
    expect(result.field_5a).toBe(210);
    expect(result.field_5b).toBe(210);
    expect(result.field_5c).toBe(0);
  });

  it('books domestic reverse-charge purchases to 2a', () => {
    const result = calculateBtwFilingAmounts(
      2026,
      2,
      [],
      [
        {
          expense_date: '2026-05-10',
          amount_excl_btw: 1000,
          btw_amount: 210,
          has_reverse_charge: true,
          reverse_charge_type: 'domestic',
          btw_period: '2026-Q2',
        },
      ]
    );

    expect(result.turnover_2a).toBe(1000);
    expect(result.field_2a).toBe(210);
    expect(result.turnover_4b).toBe(0);
    expect(result.field_5b).toBe(210);
    expect(result.field_5c).toBe(0);
  });

  it('books non-EU reverse-charge purchases to 4a', () => {
    const result = calculateBtwFilingAmounts(
      2026,
      2,
      [],
      [
        {
          expense_date: '2026-05-10',
          amount_excl_btw: 1000,
          btw_amount: 210,
          has_reverse_charge: true,
          reverse_charge_type: 'non_eu',
          btw_period: '2026-Q2',
        },
      ]
    );

    expect(result.turnover_4a).toBe(1000);
    expect(result.field_4a).toBe(210);
    expect(result.turnover_4b).toBe(0);
    expect(result.field_5b).toBe(210);
    expect(result.field_5c).toBe(0);
  });

  it('classifies low-rate domestic invoices under 1b', () => {
    const result = calculateBtwFilingAmounts(
      2026,
      3,
      [
        {
          invoice_date: '2026-07-01',
          status: 'paid',
          subtotal: 1000,
          total_btw: 90,
        },
      ],
      []
    );

    expect(result.turnover_1b).toBe(1000);
    expect(result.field_1b).toBe(90);
    expect(result.field_5c).toBe(90);
  });
});
