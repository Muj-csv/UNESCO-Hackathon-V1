/* ============================================================================
   Text normalisation for atom detection.

   The prototype compared raw strings with includes(). That produced false
   deaths — a player who wrote "10 cm" where the claim said "10cm" was recorded
   as having destroyed NUMBER, and the ledger then named a real student as
   responsible for a loss they had not caused.

   Everything on both sides of a comparison goes through normalize(), so the
   keyword and the hop text are always in the same form.

   PURE. No DOM, no fetch, no state.
   ========================================================================== */

/** Spelled-out numbers a player might reasonably write instead of a figure. */
const NUMBER_WORDS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20',
  thirty: '30',
  forty: '40',
  fifty: '50',
  sixty: '60',
  seventy: '70',
  eighty: '80',
  ninety: '90',
};

/**
 * Units collapse to one spelling, so "10cm", "10 cm" and "ten centimetres"
 * all arrive as "10 cm".
 *
 * Deliberately narrow. General plural-stripping would turn "this" into "thi"
 * and start matching things that are not there — the exact class of bug this
 * module exists to remove.
 */
const UNIT_WORDS: Record<string, string> = {
  centimeter: 'cm',
  centimeters: 'cm',
  centimetre: 'cm',
  centimetres: 'cm',
  millimeter: 'mm',
  millimeters: 'mm',
  millimetre: 'mm',
  millimetres: 'mm',
  meter: 'm',
  meters: 'm',
  metre: 'm',
  metres: 'm',
  kilometer: 'km',
  kilometers: 'km',
  kilometre: 'km',
  kilometres: 'km',
  kilogram: 'kg',
  kilograms: 'kg',
  gram: 'g',
  grams: 'g',
  percentage: 'percent',
  percentages: 'percent',
  pct: 'percent',
  minutes: 'minute',
  hours: 'hour',
  seconds: 'second',
  days: 'day',
  weeks: 'week',
  months: 'month',
  years: 'year',
};

/**
 * Reduce text to the form used for every comparison in the engine.
 *
 * Lowercased, smart punctuation flattened, "%" spelled out, figures split
 * from their units, thousands separators removed, punctuation dropped,
 * number words and unit words canonicalised, whitespace collapsed.
 */
export function normalize(text: string): string {
  if (!text) return '';

  const flattened = text
    .toLowerCase()
    /* smart punctuation → ascii */
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, ' ')
    .replace(/…/g, ' ')
    /* "15%" and "15 %" both read as fifteen percent */
    .replace(/%/g, ' percent ')
    /* 1,000 is one number, not two */
    .replace(/(\d),(\d)/g, '$1$2')
    /* "10cm" → "10 cm", "cm10" → "cm 10" */
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    /* everything else that is not a word character or a dot in a decimal */
    .replace(/[^a-z0-9.\s]/g, ' ')
    /* a dot that is not between digits is punctuation */
    .replace(/(\D)\.|\.(\D)/g, '$1 $2')
    .replace(/\.$/, ' ');

  return flattened
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => NUMBER_WORDS[token] ?? UNIT_WORDS[token] ?? token)
    .join(' ');
}

/**
 * Whether `phrase` appears in `text`, comparing normalised forms on whole
 * words.
 *
 * The padding matters: a bare includes() lets the keyword "46" match inside
 * "460", and "one campus" match inside "one campuses". Both would be recorded
 * as an atom surviving when it had not.
 */
export function containsPhrase(text: string, phrase: string): boolean {
  const needle = normalize(phrase);
  if (!needle) return false;
  return ` ${normalize(text)} `.includes(` ${needle} `);
}

/** The first of `phrases` present in `text`, or null. Order is significant. */
export function findPhrase(text: string, phrases: string[] | undefined): string | null {
  if (!phrases?.length) return null;
  return phrases.find((p) => containsPhrase(text, p)) ?? null;
}

/** Any of `phrases` present. */
export function containsAny(text: string, phrases: string[] | undefined): boolean {
  return findPhrase(text, phrases) !== null;
}

/** Normalised word count — the size measure the ledger uses to judge shrinkage. */
export function wordCount(text: string): number {
  const n = normalize(text);
  return n ? n.split(' ').length : 0;
}

/**
 * How much of the previous version this one dropped, 0–1.
 * Used to decide when a loss is too weak a signal to assert (T2).
 */
export function shrinkRatio(previous: string, next: string): number {
  const before = wordCount(previous);
  if (!before) return 0;
  const after = wordCount(next);
  return Math.max(0, 1 - after / before);
}
