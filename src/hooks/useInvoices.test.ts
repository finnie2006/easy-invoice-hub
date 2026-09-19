import { describe, expect, it } from 'vitest';
import { calculateItemTotals, InvoiceItemInsert } from './useInvoices';

function createItem(quantity: number | null): InvoiceItemInsert {
  return {
    description: 'Dienst',
    quantity,
    unit: '',
    unit_price: 150,
    btw_percentage: 21,
  };
}

describe('invoice item totals', () => {
  it('treats an empty quantity as one line item', () => {
    expect(calculateItemTotals(createItem(null))).toMatchObject({
      subtotal: 150,
      btw_amount: 31.5,
      total: 181.5,
    });
  });

  it('preserves an explicit zero quantity', () => {
    expect(calculateItemTotals(createItem(0))).toMatchObject({
      subtotal: 0,
      btw_amount: 0,
      total: 0,
    });
  });
});
