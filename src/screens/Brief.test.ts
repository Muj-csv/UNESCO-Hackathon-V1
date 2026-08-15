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

/* ==========================================================================
   T8 — BAD FAITH deals one brief per player, privately.
   ========================================================================== */

const badFaith = (over: Partial<GameState> = {}): GameState =>
  state({
    settings: { ...initialState.settings, mode: 'badfaith' },
    players: [
      { id: 'a', name: 'Ana' },
      { id: 'b', name: 'Ben' },
      { id: 'c', name: 'Cara' },
    ],
    round: {
      ...initialState.round,
      imposter: { player: 'Ben', hopIndex: 2, targetAtom: 'HEDGE' },
    },
    ...over,
  });

describe('briefsFor in bad faith', () => {
  it('deals one to every player, not just the imposter', () => {
    /* Handing the device to one person would name them to the whole room
       before the round starts. */
    const briefs = briefsFor(badFaith());
    expect(briefs).toHaveLength(3);
    expect(briefs.map((b) => b.player)).toEqual(['Ana', 'Ben', 'Cara']);
  });

  it('gives exactly one player a different brief', () => {
    const briefs = briefsFor(badFaith());
    const odd = briefs.filter((b) => b.anchor !== briefs[0].anchor || b.player === 'Ben');
    expect(odd).toHaveLength(1);
    expect(odd[0].player).toBe('Ben');
  });

  it('leaves the honest players reading exactly the same thing', () => {
    const [ana, , cara] = briefsFor(badFaith());
    expect({ ...ana, player: null }).toEqual({ ...cara, player: null });
  });

  it('names the property the imposter is asked to make die', () => {
    const ben = briefsFor(badFaith()).find((b) => b.player === 'Ben')!;
    expect(ben.lines.join(' ')).toContain('HEDGE');
    expect(ben.lines.join(' ')).toMatch(/disappear/i);
  });

  /* The rule the whole design rests on. The brief targets a property; it
     never asks anybody to lie, in any mode. */
  it('never tells the imposter to lie', () => {
    const ben = briefsFor(badFaith()).find((b) => b.player === 'Ben')!;
    for (const line of [...ben.lines, ben.anchor, ben.anchorNote]) {
      expect(line).not.toMatch(/\blie\b|\blying\b|\bfalse\b|\bfake\b/i);
    }
  });

  it('tells the imposter to keep it plausible', () => {
    const ben = briefsFor(badFaith()).find((b) => b.player === 'Ben')!;
    expect(ben.lines.join(' ')).toMatch(/believable/i);
  });

  it('falls back to the room brief before an imposter is dealt', () => {
    const briefs = briefsFor(badFaith({ round: { ...initialState.round, imposter: null } }));
    expect(briefs).toHaveLength(1);
    expect(briefs[0].player).toBeNull();
  });
});

/* The role rotates every round, so this screen is how each new imposter finds
   out. Skipping it after round one would leave nobody holding the brief. */
describe('shouldShowBrief in bad faith', () => {
  it('shows again on later rounds, unlike every other mode', () => {
    const later = badFaith({ session: { results: [], roundNumber: 3 } });
    expect(shouldShowBrief(later)).toBe(true);
    expect(shouldShowBrief({ ...later, settings: { ...later.settings, mode: 'chain' } })).toBe(false);
  });

  it('still does not reappear once the round is under way', () => {
    const started = badFaith({
      round: {
        ...initialState.round,
        imposter: { player: 'Ben', hopIndex: 2, targetAtom: 'HEDGE' },
        hops: [{ player: 'Ana', text: 'One.', cardId: 'land' }],
      },
    });
    expect(shouldShowBrief(started)).toBe(false);
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
