import { describe, expect, it } from 'vitest';
import type { GameState, Hop } from '../types/contracts';
import { initialState } from '../state/gameReducer';
import { briefsFor, shouldShowBrief } from './Brief';

/* ==========================================================================
   The brief is the one screen the rest of the session is gated behind, and
   it is shown exactly once. Getting that wrong in either direction costs
   something real: shown every round it becomes the thing everyone taps past
   without reading, and skipped on a first round the room plays the whole
   game believing the card told them to distort.

   The rule is derived rather than stored, so it is worth pinning down.
   ========================================================================== */

const hop = (text: string): Hop => ({ player: 'Ana', text, cardId: 'certain' });

const state = (over: Partial<GameState> = {}): GameState => ({
  ...initialState,
  ...over,
});

describe('shouldShowBrief', () => {
  it('shows before the first hop of a session', () => {
    expect(shouldShowBrief(state())).toBe(true);
  });

  it('does not show again once the room has written something', () => {
    const played = state({ round: { ...initialState.round, hops: [hop('A retelling.')] } });
    expect(shouldShowBrief(played)).toBe(false);
  });

  it('does not show on later rounds', () => {
    const second = state({ session: { results: [], roundNumber: 2 } });
    expect(shouldShowBrief(second)).toBe(false);
  });

  /* T5 rehydrates mid-round. Coming back to a briefing the room already read
     — with a hop half-written behind it — would be worse than not resuming. */
  it('does not show when a restored session is already underway', () => {
    const restored = state({
      round: { ...initialState.round, hops: [hop('A retelling.')], currentHop: 1 },
      session: { results: [], roundNumber: 1 },
    });
    expect(shouldShowBrief(restored)).toBe(false);
  });
});

describe('briefsFor', () => {
  it('gives the whole room one brief', () => {
    const briefs = briefsFor(state());
    expect(briefs).toHaveLength(1);
    expect(briefs[0].player).toBeNull();
  });

  /* The line the screen exists for. If this ever reads as an instruction to
     distort, the session teaches the opposite of what it means to. */
  it('says the card is a pressure, and never says to mislead', () => {
    const [brief] = briefsFor(state());
    expect(brief.anchor).toMatch(/pressure, not an instruction to distort/i);
    for (const line of [...brief.lines, brief.anchor, brief.anchorNote]) {
      expect(line).not.toMatch(/\blie\b|\blying\b/i);
    }
  });

  it('warns the room that the original does not travel with the claim', () => {
    const [brief] = briefsFor(state());
    expect(brief.lines.join(' ')).toMatch(/won't see the original/i);
  });
});
