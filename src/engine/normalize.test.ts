import { describe, expect, it } from 'vitest';
import { containsAny, containsPhrase, findPhrase, normalize, shrinkRatio, wordCount } from './normalize';

describe('normalize', () => {
  it('collapses case, punctuation and whitespace', () => {
    expect(normalize('  The  Bureau, SAYS.  ')).toBe('the bureau says');
  });

  it('flattens smart quotes, dashes and ellipses', () => {
    expect(normalize('“preliminary” — suggests … may')).toBe('preliminary suggests may');
  });

  it('spells out the percent sign so 15% and 15 percent agree', () => {
    expect(normalize('15%')).toBe('15 percent');
    expect(normalize('15 percent')).toBe('15 percent');
    expect(normalize('a 15% rise')).toBe(normalize('a 15 percent rise'));
  });

  it('keeps thousands separators inside one number', () => {
    expect(normalize('1,000 students')).toBe('1000 students');
  });

  /* The requirement T0 states outright. */
  it('reads 10cm, 10 cm and ten centimeters as the same thing', () => {
    expect(normalize('10cm')).toBe('10 cm');
    expect(normalize('10 cm')).toBe('10 cm');
    expect(normalize('ten centimeters')).toBe('10 cm');
    expect(normalize('ten centimetres')).toBe('10 cm');
  });

  it('canonicalises number words and units', () => {
    expect(normalize('forty alerts')).toBe('40 alerts');
    expect(normalize('34 minutes')).toBe('34 minute');
    expect(normalize('two kilometres')).toBe('2 km');
  });

  it('preserves decimals', () => {
    expect(normalize('5.9 down to 5.5')).toBe('5.9 down to 5.5');
  });
});

describe('containsPhrase', () => {
  it('matches across differing punctuation and case', () => {
    expect(containsPhrase('The San Ramil Weather Bureau, says…', 'san ramil weather bureau')).toBe(true);
  });

  it('matches a spelled-out figure against a numeric keyword', () => {
    expect(containsPhrase('rose by fifteen percent', '15%')).toBe(true);
  });

  /* The bug this module exists to remove: a bare includes() marked atoms as
     surviving inside longer numbers and words, and named real students as
     responsible for losses they had not caused. */
  it('does not match a number inside a longer number', () => {
    expect(containsPhrase('460 alerts were issued', '46')).toBe(false);
    expect(containsPhrase('1800 students', '180')).toBe(false);
  });

  it('does not match a word inside a longer word', () => {
    expect(containsPhrase('one campuses', 'one campus')).toBe(false);
    expect(containsPhrase('the causeway reopened', 'cause')).toBe(false);
  });

  it('matches at the start and end of the text', () => {
    expect(containsPhrase('preliminary figures suggest', 'preliminary')).toBe(true);
    expect(containsPhrase('figures that only suggest', 'suggest')).toBe(true);
  });

  it('is false for empty input', () => {
    expect(containsPhrase('', 'anything')).toBe(false);
    expect(containsPhrase('something', '')).toBe(false);
  });
});

describe('findPhrase / containsAny', () => {
  it('returns the matching phrase, not just a boolean', () => {
    expect(findPhrase('this causes flooding', ['linked to', 'causes'])).toBe('causes');
  });

  it('returns null when nothing matches', () => {
    expect(findPhrase('associated with flooding', ['causes', 'due to'])).toBe(null);
    expect(containsAny('associated with flooding', ['causes'])).toBe(false);
  });

  it('handles a missing list', () => {
    expect(findPhrase('anything', undefined)).toBe(null);
    expect(containsAny('anything', undefined)).toBe(false);
  });
});

describe('wordCount / shrinkRatio', () => {
  it('counts normalised words', () => {
    expect(wordCount('The bureau, says.')).toBe(3);
    expect(wordCount('')).toBe(0);
  });

  it('reports how much a rewrite dropped', () => {
    expect(shrinkRatio('one two three four', 'one two')).toBeCloseTo(0.5);
    expect(shrinkRatio('one two three four', 'one two three four')).toBe(0);
  });

  it('never reports negative shrinkage when a hop grew', () => {
    expect(shrinkRatio('one two', 'one two three four')).toBe(0);
  });

  it('is safe on empty previous text', () => {
    expect(shrinkRatio('', 'anything')).toBe(0);
  });
});
