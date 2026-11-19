/**
 * Lineaire afschrijving van bedrijfsmiddelen, tijdsevenredig per maand.
 *
 * De afschrijving start in de maand van aanschaf en loopt `useful_life_years * 12`
 * maanden door. Bij aanschaf halverwege het jaar schuift het restant dus door naar
 * een extra (gedeeltelijk) jaar, zoals de Belastingdienst het ook verwacht.
 */

/** Grens (excl. BTW) vanaf waar een aanschaf als bedrijfsmiddel moet worden afgeschreven. */
export const DEPRECIATION_THRESHOLD = 450;

/** Maximaal 20% per jaar afschrijven, dus minimaal 5 jaar voor de meeste bedrijfsmiddelen. */
export const MIN_FISCAL_USEFUL_LIFE_YEARS = 5;

export interface DepreciableAsset {
  purchase_date: string;
  purchase_price: number | string;
  residual_value: number | string | null;
  useful_life_years: number | string | null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

const parseLocalDate = (value: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(value);
};

const monthIndex = (date: Date) => date.getFullYear() * 12 + date.getMonth();

const getSchedule = (asset: DepreciableAsset) => {
  const purchase = parseLocalDate(asset.purchase_date);
  const lifeYears = Math.max(0, Number(asset.useful_life_years) || 0);
  const totalMonths = Math.round(lifeYears * 12);
  const depreciable = Math.max(0, Number(asset.purchase_price || 0) - Number(asset.residual_value || 0));
  return {
    startIndex: monthIndex(purchase),
    totalMonths,
    depreciable,
  };
};

/** Cumulatieve afschrijving t/m het einde van maand `index` (afgerond op centen). */
const cumulativeThroughMonth = (asset: DepreciableAsset, index: number): number => {
  const { startIndex, totalMonths, depreciable } = getSchedule(asset);
  if (totalMonths <= 0 || Number.isNaN(startIndex)) return 0;
  const elapsed = Math.min(totalMonths, Math.max(0, index - startIndex + 1));
  if (elapsed === totalMonths) return round2(depreciable);
  return round2((depreciable * elapsed) / totalMonths);
};

/** Afschrijving binnen de maanden van `start` t/m `end` (inclusief). */
export function getDepreciationForPeriod(asset: DepreciableAsset, start: Date, end: Date): number {
  const startIdx = monthIndex(start);
  const endIdx = monthIndex(end);
  if (endIdx < startIdx) return 0;
  return round2(cumulativeThroughMonth(asset, endIdx) - cumulativeThroughMonth(asset, startIdx - 1));
}

export function getDepreciationForYear(asset: DepreciableAsset, year: number): number {
  return getDepreciationForPeriod(asset, new Date(year, 0, 1), new Date(year, 11, 31));
}

export function getBookValueEndOfYear(asset: DepreciableAsset, year: number): number {
  const purchase = parseLocalDate(asset.purchase_date);
  if (year < purchase.getFullYear()) return 0;
  return round2(Number(asset.purchase_price || 0) - cumulativeThroughMonth(asset, year * 12 + 11));
}

/** Of het bedrijfsmiddel in (een deel van) dit jaar wordt afgeschreven. */
export function isDepreciatingInYear(asset: DepreciableAsset, year: number): boolean {
  const { startIndex, totalMonths } = getSchedule(asset);
  if (totalMonths <= 0) return false;
  const lastIndex = startIndex + totalMonths - 1;
  return startIndex <= year * 12 + 11 && lastIndex >= year * 12;
}

export function getTotalDepreciationForPeriod(assets: DepreciableAsset[], start: Date, end: Date): number {
  return round2(assets.reduce((sum, asset) => sum + getDepreciationForPeriod(asset, start, end), 0));
}

/** Ids van uitgaven die als bedrijfsmiddel zijn geactiveerd (en dus niet direct als kosten tellen). */
export function getCapitalizedExpenseIds(assets: Array<{ expense_id?: string | null }>): Set<string> {
  return new Set(assets.map((asset) => asset.expense_id).filter((id): id is string => Boolean(id)));
}

/** Kosten excl. BTW die direct ten laste van de winst komen (0 voor geactiveerde uitgaven). */
export function getExpenseCostExclBtw(
  expense: { id: string; amount_excl_btw: number | string | null },
  capitalizedExpenseIds: Set<string>,
): number {
  if (capitalizedExpenseIds.has(expense.id)) return 0;
  return Number(expense.amount_excl_btw || 0);
}
