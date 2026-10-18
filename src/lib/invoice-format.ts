const UNIT_LABELS: Record<string, { singular: string; plural: string }> = {
  uur: { singular: 'uur', plural: 'uur' },
  dag: { singular: 'dag', plural: 'dagen' },
  stuk: { singular: 'stuk', plural: 'stuks' },
  optreden: { singular: 'optreden', plural: 'optredens' },
  project: { singular: 'project', plural: 'projecten' },
  maand: { singular: 'maand', plural: 'maanden' },
  jaar: { singular: 'jaar', plural: 'jaar' },
  km: { singular: 'km', plural: 'km' },
};

/** Fallback when no default km rate is set in the profile (matches the mileage default). */
export const DEFAULT_KM_RATE = 0.25;

export const INVOICE_UNIT_OPTIONS = [
  { value: 'uur', label: 'uur' },
  { value: 'dag', label: 'dag' },
  { value: 'maand', label: 'maand' },
  { value: 'jaar', label: 'jaar' },
  { value: 'stuk', label: 'stuk' },
  { value: 'optreden', label: 'optreden' },
  { value: 'project', label: 'project' },
  { value: 'km', label: 'km' },
] as const;

export function getUnitPriceLabel(unit?: string | null) {
  const normalizedUnit = unit?.trim();
  return normalizedUnit ? `Prijs per ${normalizedUnit} (€)` : 'Prijs (€)';
}

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

interface DefaultRates {
  hourly?: number | string | null;
  km?: number | string | null;
}

export function getDefaultUnitPrice(unit: string | null | undefined, rates: DefaultRates) {
  if (unit === 'km') return Number(rates.km) || DEFAULT_KM_RATE;
  if (unit === 'uur') return Number(rates.hourly) || 0;
  return undefined;
}

/**
 * Switch an invoice line to another unit. The price follows the default rate
 * for the new unit, unless the user already entered a custom price.
 */
export function applyUnitChange<T extends { unit?: string | null; unit_price: number | string }>(
  item: T,
  nextUnit: string | null,
  rates: DefaultRates,
): T {
  const previousDefault = getDefaultUnitPrice(item.unit, rates);
  const nextDefault = getDefaultUnitPrice(nextUnit, rates);
  // Prices loaded from the API arrive as strings (Postgres numeric).
  const currentPrice = Number(item.unit_price) || 0;
  const priceUntouched = currentPrice === 0 || currentPrice === previousDefault;

  return {
    ...item,
    unit: nextUnit,
    unit_price: nextDefault !== undefined && priceUntouched ? nextDefault : item.unit_price,
  };
}
