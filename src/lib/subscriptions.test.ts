import { describe, expect, it } from 'vitest';
import {
  calculateNextInvoiceDate,
  calculatePreviousInvoiceDate,
  getBillingIntervalLabel,
  getSubscriptionBillingState,
} from './subscriptions';

describe('subscription billing helpers', () => {
  it('advances the next invoice date by the selected interval', () => {
    expect(calculateNextInvoiceDate('2026-09-06', 1)).toBe('2026-10-06');
    expect(calculateNextInvoiceDate('2026-09-06', 3)).toBe('2026-12-06');
    expect(calculateNextInvoiceDate('2026-09-06', 12)).toBe('2027-09-06');
  });

  it('moves the next invoice date back by the selected interval', () => {
    expect(calculatePreviousInvoiceDate('2027-07-04', 1)).toBe('2027-06-04');
    expect(calculatePreviousInvoiceDate('2027-07-04', 3)).toBe('2027-04-04');
    expect(calculatePreviousInvoiceDate('2027-07-04', 12)).toBe('2026-07-04');
  });

  it('labels invoice urgency for active subscriptions', () => {
    const today = new Date('2026-09-06T10:00:00');

    expect(getSubscriptionBillingState({
      status: 'active',
      next_invoice_date: '2026-09-05',
    }, today)).toBe('overdue');
    expect(getSubscriptionBillingState({
      status: 'active',
      next_invoice_date: '2026-09-06',
    }, today)).toBe('due_today');
    expect(getSubscriptionBillingState({
      status: 'active',
      next_invoice_date: '2026-09-20',
    }, today)).toBe('upcoming');
    expect(getSubscriptionBillingState({
      status: 'active',
      next_invoice_date: '2026-09-21',
    }, today)).toBe('scheduled');
  });

  it('treats paused and cancelled subscriptions as inactive', () => {
    expect(getSubscriptionBillingState({
      status: 'paused',
      next_invoice_date: '2026-09-06',
    }, new Date('2026-09-06T10:00:00'))).toBe('inactive');
  });

  it('formats billing intervals for the UI', () => {
    expect(getBillingIntervalLabel(1)).toBe('Maandelijks');
    expect(getBillingIntervalLabel(3)).toBe('Elke 3 maanden');
    expect(getBillingIntervalLabel(12)).toBe('Jaarlijks');
  });
});
