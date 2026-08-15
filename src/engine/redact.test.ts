import { describe, expect, it } from 'vitest';
import { charCount, reassemble, tokenize } from './redact';

describe('tokenize', () => {
  it('splits on whitespace, one token per word', () => {
    const tokens = tokenize('The bureau says preliminary figures suggest a rise.');
    expect(tokens.map((t) => t.text)).toEqual([
      'The',
      'bureau',
      'says',
      'preliminary',
      'figures',
      'suggest',
      'a',
      'rise.',
    ]);
  });

  it('indexes tokens in order', () => {
    const tokens = tokenize('one two three');
    expect(tokens.map((t) => t.index)).toEqual([0, 1, 2]);
  });

  it('starts every token unremoved', () => {
    const tokens = tokenize('one two three');
    expect(tokens.every((t) => !t.removed)).toBe(true);
  });

  it('handles empty input', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('collapses repeated whitespace between words', () => {
    const tokens = tokenize('one   two\tthree');
    expect(tokens.map((t) => t.text)).toEqual(['one', 'two', 'three']);
  });
});

describe('reassemble', () => {
  it('round-trips untouched tokens back to the original text', () => {
    const original = 'The bureau says preliminary figures suggest a rise.';
    expect(reassemble(tokenize(original))).toBe(original);
  });

  it('drops removed words entirely', () => {
    const tokens = tokenize('The bureau says preliminary figures suggest a rise.');
    tokens[3].removed = true; // "preliminary"
    expect(reassemble(tokens)).toBe('The bureau says figures suggest a rise.');
  });

  it('collapses doubled spaces left by a removed word', () => {
    const tokens = tokenize('one two three four');
    tokens[1].removed = true;
    expect(reassemble(tokens)).not.toMatch(/\s{2,}/);
    expect(reassemble(tokens)).toBe('One three four');
  });

  it('drops a comma orphaned by removing the word before it', () => {
    const tokens = tokenize('San Ramil, a coastal city, reported flooding.');
    // remove "Ramil," so the comma does not survive attached to "San"
    tokens[1].removed = true;
    const out = reassemble(tokens);
    expect(out).not.toMatch(/San,/);
    expect(out).toBe('San a coastal city reported flooding.');
  });

  it('keeps the sentence-ending mark when the last word survives', () => {
    const tokens = tokenize('Figures rose sharply.');
    expect(reassemble(tokens)).toMatch(/\.$/);
  });

  it('does not invent a sentence-ending mark when the closer is removed', () => {
    const tokens = tokenize('Figures rose sharply.');
    tokens[2].removed = true; // "sharply."
    expect(reassemble(tokens)).toBe('Figures rose');
  });

  it('preserves the trailing mark when a later word is removed but the last survives', () => {
    const tokens = tokenize('Figures rose sharply today.');
    tokens[2].removed = true; // "sharply"
    expect(reassemble(tokens)).toBe('Figures rose today.');
  });

  it('capitalises the first surviving word after the original first word is removed', () => {
    const tokens = tokenize('Preliminary figures suggest a rise.');
    tokens[0].removed = true;
    expect(reassemble(tokens)).toBe('Figures suggest a rise.');
  });

  it('returns empty string when every word is removed', () => {
    const tokens = tokenize('one two three');
    tokens.forEach((t) => (t.removed = true));
    expect(reassemble(tokens)).toBe('');
  });

  it('handles a single surviving word', () => {
    const tokens = tokenize('one two three');
    tokens[0].removed = true;
    tokens[2].removed = true;
    expect(reassemble(tokens)).toBe('Two');
  });

  it('never produces doubled spaces regardless of which words are removed', () => {
    const tokens = tokenize('a b c d e f g');
    tokens[1].removed = true;
    tokens[3].removed = true;
    tokens[5].removed = true;
    expect(reassemble(tokens)).not.toMatch(/\s{2,}/);
  });
});

describe('charCount', () => {
  it('matches the length of the reassembled string', () => {
    const tokens = tokenize('The bureau says preliminary figures suggest a rise.');
    expect(charCount(tokens)).toBe(reassemble(tokens).length);
  });

  it('shrinks as words are removed', () => {
    const tokens = tokenize('The bureau says preliminary figures suggest a rise.');
    const before = charCount(tokens);
    tokens[3].removed = true;
    expect(charCount(tokens)).toBeLessThan(before);
  });

  it('is zero when everything is removed', () => {
    const tokens = tokenize('one two three');
    tokens.forEach((t) => (t.removed = true));
    expect(charCount(tokens)).toBe(0);
  });
});
