export type ExpenseAmountInputMode = 'incl' | 'excl';

export interface ExpenseVatAmounts {
  amountInclBtw: number;
  amountExclBtw: number;
  btwAmount: number;
}

interface ExpenseVatCalculationInput {
  inputAmount: number;
  inputMode: ExpenseAmountInputMode;
  btwPercentage: number;
  hasReverseCharge: boolean;
}

interface ExpenseVatFields {
  amount_excl_btw?: number | string | null;
  amount_incl_btw?: number | string | null;
  btw_amount?: number | string | null;
  has_reverse_charge?: boolean | null;
}

const roundMoney = (amount: number) => Math.round(amount * 100) / 100;

export const calculateExpenseVatAmounts = ({
  inputAmount,
  inputMode,
  btwPercentage,
  hasReverseCharge,
}: ExpenseVatCalculationInput): ExpenseVatAmounts => {
  const safeAmount = Number.isFinite(inputAmount) ? inputAmount : 0;
  const safeBtwPercentage = Number.isFinite(btwPercentage) ? btwPercentage : 0;

  if (hasReverseCharge) {
    const amountExclBtw = safeAmount;
    const btwAmount = amountExclBtw * (safeBtwPercentage / 100);

    return {
      amountInclBtw: roundMoney(amountExclBtw),
      amountExclBtw: roundMoney(amountExclBtw),
      btwAmount: roundMoney(btwAmount),
    };
  }

  if (inputMode === 'incl') {
    const amountInclBtw = safeAmount;
    const amountExclBtw = safeBtwPercentage === 0
      ? amountInclBtw
      : amountInclBtw / (1 + safeBtwPercentage / 100);

    return {
      amountInclBtw: roundMoney(amountInclBtw),
      amountExclBtw: roundMoney(amountExclBtw),
      btwAmount: roundMoney(amountInclBtw - amountExclBtw),
    };
  }

  const amountExclBtw = safeAmount;
  const btwAmount = amountExclBtw * (safeBtwPercentage / 100);

  return {
    amountInclBtw: roundMoney(amountExclBtw + btwAmount),
    amountExclBtw: roundMoney(amountExclBtw),
    btwAmount: roundMoney(btwAmount),
  };
};

export const getExpensePaidAmount = (expense: ExpenseVatFields) => {
  if (expense.has_reverse_charge) {
    return Number(expense.amount_excl_btw ?? expense.amount_incl_btw ?? 0);
  }

  return Number(expense.amount_incl_btw ?? 0);
};

export const getExpenseDeductibleVat = (expense: ExpenseVatFields) => {
  return Number(expense.btw_amount ?? 0);
};

export const getExpenseReverseChargeVat = (expense: ExpenseVatFields) => {
  return expense.has_reverse_charge ? Number(expense.btw_amount ?? 0) : 0;
};
