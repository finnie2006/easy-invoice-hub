import { describe, expect, it } from 'vitest';
import {
  getInvoiceEmailVariables,
  renderInvoiceEmailTemplate,
} from './invoice-email-template';

describe('invoice email templates', () => {
  it('renders invoice variables and keeps unknown placeholders intact', () => {
    const variables = getInvoiceEmailVariables(
      {
        invoice_number: '2026001',
        invoice_date: '2026-09-02',
        due_date: '2026-09-16',
        total: 121,
        payment_reference: 'REF-2026001',
        client_company_name: 'Acme B.V.',
        client_contact_name: 'Sam',
      },
      {
        company_name: 'Mijn Zaak',
        iban: 'NL00 BANK 0000 0000 00',
      },
    );

    expect(variables.totaalbedrag).toContain('121,00');
    expect(renderInvoiceEmailTemplate(
      'Beste {klantnaam}, betaal met {betaalreferentie}. {onbekend}',
      variables,
    )).toBe('Beste Sam, betaal met REF-2026001. {onbekend}');
  });
});
