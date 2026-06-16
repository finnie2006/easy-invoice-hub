export interface ExpenseDocumentFields {
  vendorName?: string;
  description?: string;
  expenseDate?: Date;
  amountInclBtw?: number;
  amountExclBtw?: number;
  btwAmount?: number;
  btwPercentage?: number;
  category?: string;
}

export interface ExpenseDocumentReadResult {
  fields: ExpenseDocumentFields;
  confidence: number;
  extractedText: string;
  messages: string[];
  needsOcr: boolean;
}

const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  { category: 'software', keywords: ['software', 'saas', 'subscription', 'abonnement', 'github', 'microsoft', 'google', 'adobe', 'notion'] },
  { category: 'hardware', keywords: ['laptop', 'monitor', 'keyboard', 'muis', 'printer', 'hardware', 'apparatuur'] },
  { category: 'reiskosten', keywords: ['trein', 'ns ', 'ov-', 'taxi', 'parking', 'parkeren', 'hotel', 'brandstof', 'benzine'] },
  { category: 'marketing', keywords: ['ads', 'advertentie', 'marketing', 'meta ', 'linkedin', 'drukwerk'] },
  { category: 'telefoon', keywords: ['telefoon', 'internet', 'kpn', 'ziggo', 'odido', 'vodafone'] },
  { category: 'verzekeringen', keywords: ['verzekering', 'polis', 'premie'] },
  { category: 'advieskosten', keywords: ['accountant', 'advies', 'juridisch', 'boekhouder', 'consultancy'] },
  { category: 'kantoor', keywords: ['kantoor', 'office', 'papier', 'inkt', 'bureau'] },
];

const TEXT_FILE_TYPES = new Set([
  'text/plain',
  'text/csv',
  'application/json',
  'application/xml',
]);
const AMOUNT_PATTERN = /(?<![\d-])(?:eur|€)?\s*(-?\d{1,4}(?:[.\s]\d{3})*(?:[,.]\d{2})|-?\d+[,.]\d{2})(?:\s*(?:eur|€))?/i;
const AMOUNT_PATTERN_GLOBAL = /(?<![\d-])(?:eur|€)?\s*(-?\d{1,4}(?:[.\s]\d{3})*(?:[,.]\d{2})|-?\d+[,.]\d{2})(?:\s*(?:eur|€))?/gi;

export async function readExpenseDocument(file: File): Promise<ExpenseDocumentReadResult> {
  const fileText = await readLikelyText(file);
  const filenameText = filenameToText(file.name);
  const extractedText = [fileText, filenameText].filter(Boolean).join('\n');
  const result = parseExpenseDocumentText(extractedText, file.type);

  if (!fileText && isImageOrPdf(file.type, file.name)) {
    result.needsOcr = true;
    result.messages.push('Voor afbeeldingen en scans is later echte OCR nodig. Ik heb nu alvast de bestandsnaam gebruikt.');
  }

  if (!fileText && !result.messages.length) {
    result.messages.push('Er is geen leesbare tekst gevonden. Vul de ontbrekende velden handmatig aan.');
  }

  return result;
}

export function parseExpenseDocumentText(text: string, mimeType = ''): ExpenseDocumentReadResult {
  const normalizedText = normalizeWhitespace(text);
  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const lower = normalizedText.toLowerCase();
  const fields: ExpenseDocumentFields = {};
  const messages: string[] = [];

  const date = findDate(normalizedText);
  if (date) fields.expenseDate = date;

  const btwPercentage = findBtwPercentage(lower);
  if (btwPercentage !== undefined) fields.btwPercentage = btwPercentage;

  const amountInclBtw = findAmount(normalizedText, [
    'totaal incl btw',
    'totaal inclusief btw',
    'total incl vat',
    'total including vat',
    'te betalen',
    'amount due',
    'grand total',
    'totaal',
    'total',
  ]);
  if (amountInclBtw !== undefined) fields.amountInclBtw = amountInclBtw;

  const amountExclBtw = findAmount(normalizedText, [
    'subtotaal',
    'totaal excl btw',
    'totaal exclusief btw',
    'total excl vat',
    'subtotal',
  ]);
  if (amountExclBtw !== undefined) fields.amountExclBtw = amountExclBtw;

  const btwAmount = findAmount(normalizedText, ['btw bedrag', 'btw', 'vat amount', 'vat']);
  if (btwAmount !== undefined) fields.btwAmount = btwAmount;

  if (fields.amountInclBtw === undefined) {
    const largestAmount = findLargestAmount(normalizedText);
    if (largestAmount !== undefined) fields.amountInclBtw = largestAmount;
  }

  const vendorName = findVendorName(lines);
  if (vendorName) fields.vendorName = vendorName;

  const description = findDescription(lines, fields.vendorName);
  if (description) fields.description = description;

  const category = findCategory(lower);
  if (category) fields.category = category;

  if (!Object.keys(fields).length) {
    messages.push('Ik kon nog geen velden herkennen uit dit document.');
  } else {
    messages.push('Controleer de ingelezen velden voordat je de uitgave opslaat.');
  }

  const confidence = calculateConfidence(fields, mimeType);

  return {
    fields,
    confidence,
    extractedText: normalizedText,
    messages,
    needsOcr: false,
  };
}

async function readLikelyText(file: File): Promise<string> {
  if (TEXT_FILE_TYPES.has(file.type) || file.name.match(/\.(txt|csv|json|xml)$/i)) {
    return file.text();
  }

  if (file.type === 'application/pdf' || file.name.match(/\.pdf$/i)) {
    const buffer = await file.arrayBuffer();
    const decoded = new TextDecoder('latin1').decode(buffer);
    return decoded
      .split('')
      .map((char) => isReadableTextChar(char) ? char : ' ')
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return '';
}

function isReadableTextChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126) || (code >= 160 && code <= 591);
}

function isImageOrPdf(mimeType: string, filename: string): boolean {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf' || filename.match(/\.(png|jpe?g|webp|pdf)$/i) !== null;
}

function filenameToText(filename: string): string {
  const stem = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const vendorHint = stem
    .replace(/\b(20\d{2}|19\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/g, ' ')
    .replace(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2}|19\d{2})\b/g, ' ')
    .replace(/(?:eur|€)?\s*-?\d{1,4}(?:[.\s]\d{3})*(?:[,.]\d{2})(?:\s*(?:eur|€))?/gi, ' ')
    .replace(/[-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return [vendorHint, stem].filter((line, index, lines) => line && lines.indexOf(line) === index).join('\n');
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function findDate(text: string): Date | undefined {
  const isoMatch = text.match(/\b(20\d{2}|19\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    return makeDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const localMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2}|19\d{2})\b/);
  if (localMatch) {
    return makeDate(Number(localMatch[3]), Number(localMatch[2]), Number(localMatch[1]));
  }

  return undefined;
}

function makeDate(year: number, month: number, day: number): Date | undefined {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined;
  }
  return date;
}

function findBtwPercentage(text: string): number | undefined {
  const matches = Array.from(text.matchAll(/\b(21|9|0)(?:[,.]0{1,2})?\s*%/g));
  const preferred = matches.find((match) => {
    const matchIndex = match.index ?? 0;
    const start = Math.max(0, matchIndex - 20);
    const context = text.slice(start, matchIndex + 30);
    return context.includes('btw') || context.includes('vat');
  });
  const match = preferred || matches[0];
  return match ? Number(match[1]) : undefined;
}

function findAmount(text: string, labels: string[]): number | undefined {
  const lower = text.toLowerCase();

  for (const label of labels) {
    const labelIndex = lower.indexOf(label);
    if (labelIndex === -1) continue;

    const fragment = text.slice(labelIndex, labelIndex + 120);
    const amount = firstAmount(fragment);
    if (amount !== undefined) return amount;
  }

  return undefined;
}

function firstAmount(text: string): number | undefined {
  const match = text.match(AMOUNT_PATTERN);
  return match ? parseLocalizedNumber(match[1]) : undefined;
}

function findLargestAmount(text: string): number | undefined {
  const amounts = Array.from(text.matchAll(AMOUNT_PATTERN_GLOBAL))
    .map((match) => parseLocalizedNumber(match[1]))
    .filter((amount): amount is number => amount !== undefined && amount >= 0);

  if (!amounts.length) return undefined;
  return Math.max(...amounts);
}

function parseLocalizedNumber(value: string): number | undefined {
  const trimmed = value.replace(/\s/g, '');
  const decimalSeparator = trimmed.lastIndexOf(',') > trimmed.lastIndexOf('.') ? ',' : '.';
  const normalized = trimmed
    .replace(decimalSeparator === ',' ? /\./g : /,/g, '')
    .replace(decimalSeparator, '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function findVendorName(lines: string[]): string | undefined {
  const ignored = /^(factuur|invoice|bon|receipt|datum|date|totaal|total|btw|vat|kvk|iban)\b/i;
  const candidate = lines.find((line) => {
    const clean = line.trim();
    return clean.length >= 3 && clean.length <= 60 && !ignored.test(clean) && !clean.match(/^\d/) && !clean.includes('€') && firstAmount(clean) === undefined && !findDate(clean);
  });

  return candidate ? cleanReadableText(candidate) : undefined;
}

function findDescription(lines: string[], vendorName?: string): string | undefined {
  const candidate = lines.find((line) => {
    const clean = line.trim();
    return clean.length >= 6 && clean.length <= 80 && clean.toLowerCase() !== vendorName?.toLowerCase() && !clean.includes('€') && firstAmount(clean) === undefined && !findDate(clean);
  });

  return candidate ? sentenceCase(candidate) : undefined;
}

function findCategory(text: string): string | undefined {
  return CATEGORY_KEYWORDS.find(({ keywords }) => keywords.some((keyword) => text.includes(keyword)))?.category;
}

function calculateConfidence(fields: ExpenseDocumentFields, mimeType: string): number {
  let score = 0;
  if (fields.vendorName) score += 20;
  if (fields.expenseDate) score += 20;
  if (fields.amountInclBtw !== undefined) score += 25;
  if (fields.btwPercentage !== undefined) score += 15;
  if (fields.category) score += 10;
  if (fields.description) score += 10;
  if (mimeType.startsWith('image/')) score = Math.max(0, score - 20);
  return Math.min(100, score);
}

function cleanReadableText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
