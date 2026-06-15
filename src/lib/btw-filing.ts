import { getExpenseDeductibleVat, getExpenseReverseChargeVat } from './expense-vat';

export type BtwQuestionKey =
  | '1a'
  | '1b'
  | '1c'
  | '1d'
  | '1e'
  | '2a'
  | '3a'
  | '3b'
  | '3c'
  | '4a'
  | '4b';

export type BtwFieldKey =
  | BtwQuestionKey
  | '5a'
  | '5b'
  | '5c';

export type BtwTurnoverKey = Exclude<BtwQuestionKey, '1d'>;

export interface BtwFilingAmounts {
  turnover_1a: number;
  turnover_1b: number;
  turnover_1c: number;
  turnover_1e: number;
  turnover_2a: number;
  turnover_3a: number;
  turnover_3b: number;
  turnover_3c: number;
  turnover_4a: number;
  turnover_4b: number;
  field_1a: number;
  field_1b: number;
  field_1c: number;
  field_1d: number;
  field_1e: number;
  field_2a: number;
  field_3a: number;
  field_3b: number;
  field_3c: number;
  field_4a: number;
  field_4b: number;
  field_5a: number;
  field_5b: number;
  field_5c: number;
}

interface BtwInvoice {
  invoice_date: string;
  status: string;
  subtotal: number | string;
  total_btw: number | string;
}

interface BtwExpense {
  expense_date: string;
  amount_excl_btw?: number | string | null;
  btw_amount?: number | string | null;
  has_reverse_charge?: boolean | null;
  reverse_charge_type?: string | null;
  btw_period?: string | null;
}

export const ZERO_BTW_FILING_AMOUNTS: BtwFilingAmounts = {
  turnover_1a: 0,
  turnover_1b: 0,
  turnover_1c: 0,
  turnover_1e: 0,
  turnover_2a: 0,
  turnover_3a: 0,
  turnover_3b: 0,
  turnover_3c: 0,
  turnover_4a: 0,
  turnover_4b: 0,
  field_1a: 0,
  field_1b: 0,
  field_1c: 0,
  field_1d: 0,
  field_1e: 0,
  field_2a: 0,
  field_3a: 0,
  field_3b: 0,
  field_3c: 0,
  field_4a: 0,
  field_4b: 0,
  field_5a: 0,
  field_5b: 0,
  field_5c: 0,
};

export const BTW_QUESTIONS: Record<
  BtwQuestionKey,
  {
    label: string;
    section: 'domestic' | 'reverse-charge' | 'foreign-sales' | 'foreign-purchases';
    hasTurnover: boolean;
    hasVat: boolean;
  }
> = {
  '1a': {
    label: 'Leveringen/diensten belast met hoog tarief',
    section: 'domestic',
    hasTurnover: true,
    hasVat: true,
  },
  '1b': {
    label: 'Leveringen/diensten belast met laag tarief',
    section: 'domestic',
    hasTurnover: true,
    hasVat: true,
  },
  '1c': {
    label: 'Leveringen/diensten belast met overige tarieven, behalve 0%',
    section: 'domestic',
    hasTurnover: true,
    hasVat: true,
  },
  '1d': {
    label: 'Privegebruik',
    section: 'domestic',
    hasTurnover: false,
    hasVat: true,
  },
  '1e': {
    label: 'Leveringen/diensten belast met 0% of niet bij u belast',
    section: 'domestic',
    hasTurnover: true,
    hasVat: false,
  },
  '2a': {
    label: 'Leveringen/diensten waarbij de btw naar u is verlegd',
    section: 'reverse-charge',
    hasTurnover: true,
    hasVat: true,
  },
  '3a': {
    label: 'Leveringen naar landen buiten de EU',
    section: 'foreign-sales',
    hasTurnover: true,
    hasVat: false,
  },
  '3b': {
    label: 'Leveringen naar of diensten in landen binnen de EU',
    section: 'foreign-sales',
    hasTurnover: true,
    hasVat: false,
  },
  '3c': {
    label: 'Installatie/afstandsverkopen binnen de EU',
    section: 'foreign-sales',
    hasTurnover: true,
    hasVat: false,
  },
  '4a': {
    label: 'Leveringen/diensten uit landen buiten de EU',
    section: 'foreign-purchases',
    hasTurnover: true,
    hasVat: true,
  },
  '4b': {
    label: 'Leveringen/diensten uit landen binnen de EU',
    section: 'foreign-purchases',
    hasTurnover: true,
    hasVat: true,
  },
};

export const VAT_AMOUNT_KEYS: Array<keyof BtwFilingAmounts> = [
  'field_1a',
  'field_1b',
  'field_1c',
  'field_1d',
  'field_2a',
  'field_4a',
  'field_4b',
];

export const INPUT_VAT_KEY: keyof BtwFilingAmounts = 'field_5b';

export const getPeriodString = (year: number, quarter: number) => `${year}-Q${quarter}`;

export const isInvoiceRelevantForBtw = (status: string) => {
  return status !== 'draft' && status !== 'cancelled';
};

const toDateString = (value: string) => value.slice(0, 10);

const getQuarterRange = (year: number, quarter: number) => {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  return {
    start: `${year}-${String(startMonth).padStart(2, '0')}-01`,
    end: `${year}-${String(endMonth).padStart(2, '0')}-${new Date(year, endMonth, 0).getDate()}`,
  };
};

export const isDateInBtwQuarter = (date: string, year: number, quarter: number) => {
  const { start, end } = getQuarterRange(year, quarter);
  const dateString = toDateString(date);
  return dateString >= start && dateString <= end;
};

export const isExpenseInBtwPeriod = (expense: BtwExpense, year: number, quarter: number) => {
  const period = getPeriodString(year, quarter);
  if (expense.btw_period) {
    return expense.btw_period === period;
  }
  return isDateInBtwQuarter(expense.expense_date, year, quarter);
};

export const roundBtwReturnAmount = (amount: number) => Math.round(amount);

const addAmount = (current: number, amount: number) => roundBtwReturnAmount(current + amount);

const classifyDomesticInvoice = (invoice: BtwInvoice): '1a' | '1b' | '1c' | '1e' => {
  const subtotal = Number(invoice.subtotal) || 0;
  const vat = Number(invoice.total_btw) || 0;
  if (vat === 0) return '1e';

  const rate = subtotal > 0 ? vat / subtotal : 0;
  if (Math.abs(rate - 0.21) < 0.005) return '1a';
  if (Math.abs(rate - 0.09) < 0.005) return '1b';
  return '1c';
};

export const recalculateBtwFilingTotals = (
  amounts: BtwFilingAmounts
): BtwFilingAmounts => {
  const field_5a = roundBtwReturnAmount(
    VAT_AMOUNT_KEYS.reduce((sum, key) => sum + Number(amounts[key] || 0), 0)
  );
  const field_5b = roundBtwReturnAmount(Number(amounts.field_5b || 0));
  return {
    ...amounts,
    field_5a,
    field_5b,
    field_5c: roundBtwReturnAmount(field_5a - field_5b),
  };
};

export const calculateBtwFilingAmounts = (
  year: number,
  quarter: number,
  invoices: BtwInvoice[],
  expenses: BtwExpense[]
): BtwFilingAmounts => {
  const amounts: BtwFilingAmounts = { ...ZERO_BTW_FILING_AMOUNTS };

  invoices
    .filter((invoice) => (
      isInvoiceRelevantForBtw(invoice.status) &&
      isDateInBtwQuarter(invoice.invoice_date, year, quarter)
    ))
    .forEach((invoice) => {
      const field = classifyDomesticInvoice(invoice);
      const turnoverKey = `turnover_${field}` as keyof BtwFilingAmounts;
      const vatKey = `field_${field}` as keyof BtwFilingAmounts;

      amounts[turnoverKey] = addAmount(Number(amounts[turnoverKey]), Number(invoice.subtotal) || 0);
      if (BTW_QUESTIONS[field].hasVat) {
        amounts[vatKey] = addAmount(Number(amounts[vatKey]), Number(invoice.total_btw) || 0);
      }
    });

  const periodExpenses = expenses.filter((expense) => isExpenseInBtwPeriod(expense, year, quarter));

  periodExpenses.forEach((expense) => {
    const deductibleVat = getExpenseDeductibleVat(expense);
    if (expense.has_reverse_charge) {
      const reverseChargeVat = getExpenseReverseChargeVat(expense);
      const turnover = Number(expense.amount_excl_btw) || 0;
      const reverseChargeType = expense.reverse_charge_type || 'eu';

      if (reverseChargeType === 'domestic') {
        amounts.turnover_2a = addAmount(amounts.turnover_2a, turnover);
        amounts.field_2a = addAmount(amounts.field_2a, reverseChargeVat);
      } else if (reverseChargeType === 'non_eu') {
        amounts.turnover_4a = addAmount(amounts.turnover_4a, turnover);
        amounts.field_4a = addAmount(amounts.field_4a, reverseChargeVat);
      } else {
        amounts.turnover_4b = addAmount(amounts.turnover_4b, turnover);
        amounts.field_4b = addAmount(amounts.field_4b, reverseChargeVat);
      }

      amounts.field_5b = addAmount(amounts.field_5b, reverseChargeVat);
      return;
    }

    amounts.field_5b = addAmount(amounts.field_5b, deductibleVat);
  });

  return recalculateBtwFilingTotals(amounts);
};
