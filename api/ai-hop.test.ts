import { describe, expect, it } from 'vitest';
import type { Claim } from '../src/types/contracts';
import { clean, inventsFigures, movesFigures } from './ai-hop';
import rawClaims from '../src/data/claims.en.json';

const CLAIMS = rawClaims as Claim[];
const rainfall = CLAIMS.find((c) => c.id === 'rainfall-alerts')!.originalText;
const evening = CLAIMS.find((c) => c.id === 'evening-phone-sleep')!.originalText;

/* ==========================================================================
   The output of this proxy lands on a shared screen in a room with minors in
   it, and it is attributed to a participant nobody can question. The system
   prompt asks the model for all of this; none of it is trusted, because a
   prompt is a request and this is the enforcement.

   Everything rejected here becomes a non-200, and the client quietly uses the
   pre-generated rewrite instead — so being strict costs the room nothing.
   ========================================================================== */

describe('invented figures', () => {
  it('lets through a figure the claim already carried', () => {
    expect(inventsFigures('Flood alerts rose 15 percent.', rainfall)).toBe(false);
  });

  it('catches a figure that came from nowhere', () => {
    expect(inventsFigures('Flood alerts rose 87 percent.', rainfall)).toBe(true);
  });

  it('is fine with text carrying no figures at all', () => {
    expect(inventsFigures('Flood alerts are up.', rainfall)).toBe(false);
  });
});

/* This is not hypothetical. Given a claim carrying both "15 percent" and
   "40 alerts", the live model returned "a 40 percent rise" — every digit
   borrowed from the claim, and a magnitude the claim never made. */
describe('figures moved onto the wrong unit', () => {
  it('catches the transposition seen in a live call', () => {
    expect(movesFigures('The bureau says a 40 percent rise in flood alerts.', rainfall)).toBe(true);
  });

  it('leaves the real figure alone, however compressed', () => {
    expect(movesFigures('Rainfall linked to a 15 percent rise in alerts.', rainfall)).toBe(false);
    expect(movesFigures('A 15% rise in flood alerts.', rainfall)).toBe(false);
  });

  it('lets a count stay a count', () => {
    expect(movesFigures('Alerts rose from 40 to 46 in the basin.', rainfall)).toBe(false);
    expect(movesFigures('40 flood alerts last October.', rainfall)).toBe(false);
  });

  it('guards point figures the same way', () => {
    expect(movesFigures('A 9-point drop in sleep quality.', evening)).toBe(false);
    expect(movesFigures('A 54-point drop in sleep quality.', evening)).toBe(true);
  });
});

describe('clean', () => {
  it('returns a usable rewrite unchanged', () => {
    const text = 'Heavier upstream rainfall is associated with a 15 percent rise in flood alerts.';
    expect(clean(text, rainfall)).toBe(text);
  });

  it('takes the quotes models keep adding however firmly you ask', () => {
    expect(clean('"Flood alerts are up."', rainfall)).toBe('Flood alerts are up.');
    expect(clean('“Flood alerts are up.”', rainfall)).toBe('Flood alerts are up.');
  });

  it('flattens a rewrite that came back as several lines', () => {
    expect(clean('Flood alerts\n\nare up.', rainfall)).toBe('Flood alerts are up.');
  });

  it('drops a model narrating itself instead of answering', () => {
    for (const preamble of [
      "Here's the rewritten claim: alerts are up.",
      'Sure! Flood alerts are up.',
      'As an AI, I cannot do that.',
      'Summary: flood alerts are up.',
    ]) {
      expect(clean(preamble, rainfall), preamble).toBeNull();
    }
  });

  it('drops empty and runaway output', () => {
    expect(clean('   ', rainfall)).toBeNull();
    expect(clean('Alerts are up. '.repeat(60), rainfall)).toBeNull();
  });

  it('enforces the character limit the card actually set', () => {
    const long =
      'The San Ramil Weather Bureau says heavier upstream rainfall is associated with a 15 percent rise in flood alerts.';
    expect(long.length).toBeGreaterThan(90);
    expect(clean(long, rainfall, 90)).toBeNull();
    expect(clean(long, rainfall)).toBe(long);
  });

  it('refuses anything that invented or moved a figure', () => {
    expect(clean('Alerts rose 87 percent.', rainfall)).toBeNull();
    expect(clean('Alerts rose 40 percent.', rainfall)).toBeNull();
  });
});
