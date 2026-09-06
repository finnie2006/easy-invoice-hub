import { addMonths, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';

export type BillingIntervalMonths = 1 | 3 | 6 | 12;

export interface SubscriptionScheduleInput {
  status: string;
  next_invoice_date: string;
}

export type SubscriptionBillingState = 'overdue' | 'due_today' | 'upcoming' | 'scheduled' | 'inactive';

export const formatDateInput = (date: Date) => format(date, 'yyyy-MM-dd');

export const calculateNextInvoiceDate = (
  invoiceDate: string,
  intervalMonths: number,
) => formatDateInput(addMonths(parseISO(invoiceDate), intervalMonths));

export const getSubscriptionBillingState = (
  subscription: SubscriptionScheduleInput,
  today: Date = new Date(),
): SubscriptionBillingState => {
  if (subscription.status !== 'active') {
    return 'inactive';
  }

  const daysUntilInvoice = differenceInCalendarDays(
    startOfDay(parseISO(subscription.next_invoice_date)),
    startOfDay(today),
  );

  if (daysUntilInvoice < 0) return 'overdue';
  if (daysUntilInvoice === 0) return 'due_today';
  if (daysUntilInvoice <= 14) return 'upcoming';
  return 'scheduled';
};

export const getBillingIntervalLabel = (months: number) => {
  if (months === 1) return 'Maandelijks';
  if (months === 12) return 'Jaarlijks';
  return `Elke ${months} maanden`;
};
