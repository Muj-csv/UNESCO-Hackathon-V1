import { describe, expect, it } from 'vitest';
import type { Claim } from '../types/contracts';
import { ALL_CARD_IDS, CARDS } from '../data/cards';
import { FALLBACKS, fallbackFor } from './fallbacks';
import rawClaims from '../data/claims.en.json';

const CLAIMS = rawClaims as Claim[];

/* ==========================================================================
   The fallback table is the reason a round never stalls.

   It is also the one place in the project where text that will be attributed
   to the AI participant is written by hand, so it is held to the same rule
   the live model is: compress or rephrase the claim it was given, and invent
   nothing. A fabricated figure here would be laundered through the ledger as
   something "the machine said" and the room would have no way to catch it.
   ========================================================================== */

const digits = (text: string): string[] => text.match(/\d+/g) ?? [];

describe('the shipped fallback table', () => {
  it.each(CLAIMS.map((c) => [c.id] as const))('covers every card for %s', (id) => {
    for (const card of ALL_CARD_IDS) {
      expect(fallbackFor(id, card), `${id} / ${card}`).toBeTruthy();
    }
  });

  it('has no rewrites for claims that do not exist', () => {
    const shipped = CLAIMS.map((c) => c.id).sort();
    expect(Object.keys(FALLBACKS).sort()).toEqual(shipped);
  });

  it('needs a card to answer at all', () => {
    expect(fallbackFor('rainfall-alerts', null)).toBeNull();
  });

  /* A pack loaded at runtime (T10) has no authored rewrites. The caller must
     pass the previous text through rather than show anything error-shaped. */
  it('returns null for a claim it has never seen', () => {
    expect(fallbackFor('some-authored-pack-claim', 'certain')).toBeNull();
  });
});

describe('every fallback obeys the rule the live model obeys', () => {
  const rows = CLAIMS.flatMap((claim) =>
    ALL_CARD_IDS.map((card) => [claim.id, card, claim] as const),
  );

  /* The hard safety line: no new facts, entities or numbers. Numbers are the
     part a machine can check, and the part that would do the most damage. */
  it.each(rows)('%s / %s invents no figure the claim did not have', (id, card, claim) => {
    const allowed = new Set(digits(claim.originalText));
    for (const figure of digits(fallbackFor(id, card)!)) {
      expect(allowed.has(figure), `"${figure}" is not in the claim`).toBe(true);
    }
  });

  it.each(rows)('%s / %s respects the card it was written under', (id, card) => {
    const text = fallbackFor(id, card)!;
    const limit = CARDS[card].charLimit;

    expect(text.trim()).toBe(text);
    expect(text).not.toMatch(/\n/); // every card here is a single message
    if (limit != null) expect(text.length).toBeLessThanOrEqual(limit);
  });

  /* The model is a participant under observation, never a narrator of itself.
     Anything that reads as commentary would tell the room which hop was the
     machine before the Turing Hop ever asks. */
  it.each(rows)('%s / %s reads as a version, not as a machine talking', (id, card) => {
    const text = fallbackFor(id, card)!;
    expect(text).not.toMatch(/\b(as an ai|i cannot|here is|here's the|summary:|rewritten)\b/i);
  });
});
