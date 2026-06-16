import { describe, expect, it } from 'vitest';
import { parseExpenseDocumentText, readExpenseDocument } from './document-intake';

describe('parseExpenseDocumentText', () => {
  it('extracts common receipt fields from text', () => {
    const result = parseExpenseDocumentText(`
      Bol.com
      Factuur 2026-001
      Datum: 14-06-2026
      Software abonnement
      Subtotaal EUR 82,64
      BTW 21% EUR 17,36
      Totaal incl BTW EUR 100,00
    `);

    expect(result.fields.vendorName).toBe('Bol.com');
    expect(result.fields.expenseDate).toEqual(new Date(2026, 5, 14));
    expect(result.fields.amountInclBtw).toBe(100);
    expect(result.fields.amountExclBtw).toBe(82.64);
    expect(result.fields.btwAmount).toBe(17.36);
    expect(result.fields.btwPercentage).toBe(21);
    expect(result.fields.category).toBe('software');
    expect(result.confidence).toBeGreaterThanOrEqual(80);
  });

  it('falls back to the largest amount when no total label is found', () => {
    const result = parseExpenseDocumentText(`
      Kantoorwinkel
      Papier en inkt
      12/05/2026
      4,95
      22,50
      27,45
    `);

    expect(result.fields.amountInclBtw).toBe(27.45);
    expect(result.fields.category).toBe('kantoor');
  });

  it('uses filename hints for scanned receipts until OCR is available', async () => {
    const file = new File([''], 'bol-com_2026-06-14_100,00.jpg', { type: 'image/jpeg' });

    const result = await readExpenseDocument(file);

    expect(result.needsOcr).toBe(true);
    expect(result.fields.vendorName).toBe('bol com');
    expect(result.fields.expenseDate).toEqual(new Date(2026, 5, 14));
    expect(result.fields.amountInclBtw).toBe(100);
  });
});
