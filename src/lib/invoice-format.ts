const UNIT_LABELS: Record<string, { singular: string; plural: string }> = {
  uur: { singular: 'uur', plural: 'uur' },
  dag: { singular: 'dag', plural: 'dagen' },
  stuk: { singular: 'stuk', plural: 'stuks' },
  optreden: { singular: 'optreden', plural: 'optredens' },
  project: { singular: 'project', plural: 'projecten' },
  maand: { singular: 'maand', plural: 'maanden' },
  jaar: { singular: 'jaar', plural: 'jaar' },
};

export const INVOICE_UNIT_OPTIONS = [
  { value: 'uur', label: 'uur' },
  { value: 'dag', label: 'dag' },
  { value: 'maand', label: 'maand' },
  { value: 'jaar', label: 'jaar' },
  { value: 'stuk', label: 'stuk' },
  { value: 'optreden', label: 'optreden' },
  { value: 'project', label: 'project' },
] as const;

export function formatInvoiceQuantity(quantity: number | string | null | undefined, unit?: string | null) {
  if (quantity === null || quantity === undefined || quantity === '') {
    return '-';
  }

  const amount = Number(quantity);
  const formattedQuantity = Number.isFinite(amount)
    ? amount.toLocaleString('nl-NL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
    : String(quantity ?? '');

  const normalizedUnit = unit?.trim();
  if (!normalizedUnit) {
    return formattedQuantity;
  }

  const labels = UNIT_LABELS[normalizedUnit];
  const unitLabel = amount === 1
    ? labels?.singular ?? normalizedUnit
    : labels?.plural ?? normalizedUnit;

  return `${formattedQuantity} ${unitLabel}`;
}
