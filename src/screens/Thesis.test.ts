import { describe, expect, it } from 'vitest';
import type { GameState, ImposterAssignment } from '../types/contracts';
import { initialState, routeFor } from '../state/gameReducer';
import { thesisLineFor } from './Thesis';

/* ==========================================================================
   The line, and where the screen carrying it sits.

   This is the one screen the whole design exists to produce, and it is a
   sentence — so the sentence is worth testing. A mode that shows a claim it
   cannot support ("every player was told to be accurate", in a mode with no
   chain and no retelling) undoes the thing the screen is for.
   ========================================================================== */

const state = (over: Partial<GameState> = {}): GameState => ({ ...initialState, ...over });

const inMode = (mode: GameState['settings']['mode']): GameState =>
  state({ settings: { ...initialState.settings, mode } });

describe('thesisLineFor', () => {
  it('names the finding for a chain: nobody lied', () => {
    expect(thesisLineFor(inMode('chain'))).toBe(
      'Every player was told to be accurate. Nobody lied.',
    );
  });

  /* CROWD RECALL never had a chain, so it cannot claim one. Nobody retold
     anything and nobody withheld anything — the room just never held it all. */
  it('says something true of crowd recall instead', () => {
    const line = thesisLineFor(inMode('crowd'));
    expect(line).toBe('Nobody was hiding anything. Nobody had all of it.');
    expect(line).not.toMatch(/every player|retold/i);
  });

  /* T8 populates round.imposter and the variant appears with no edit here. */
  it('switches to the bad faith claim once a round has an imposter', () => {
    const imposter: ImposterAssignment = { player: 'Rowena', hopIndex: 2, targetAtom: 'HEDGE' };
    const badFaith = state({
      settings: { ...initialState.settings, mode: 'badfaith' },
      round: { ...initialState.round, imposter },
    });
    expect(thesisLineFor(badFaith)).toMatch(/how little difference it made/i);
  });

  it('never accuses the room of lying in any mode', () => {
    for (const mode of ['chain', 'crowd', 'badfaith'] as const) {
      expect(thesisLineFor(inMode(mode))).not.toMatch(/you lied|they lied|someone lied/i);
    }
  });
});

/* ==========================================================================
   Routing. The framing arrives AFTER the room has argued about causes and
   BEFORE it is handed the diagnosis — in both modes.
   ========================================================================== */
describe('where the thesis sits', () => {
  it('comes immediately before the ledger in a chain', () => {
    const route = routeFor('chain');
    expect(route[route.indexOf('thesis') + 1]).toBe('ledger');
  });

  it('comes immediately before the ledger in crowd recall', () => {
    const route = routeFor('crowd');
    expect(route[route.indexOf('thesis') + 1]).toBe('ledger');
    expect(route[route.indexOf('thesis') - 1]).toBe('splitReconstruct');
  });

  /* The guessing beat first, so the room reasons about causes before being
     given the framing to reason with. */
  it('lets the room guess and argue before it frames anything', () => {
    const route = routeFor('chain');
    for (const earlier of ['reveal', 'blackboxGuess', 'turingHop', 'accusation'] as const) {
      expect(route.indexOf(earlier)).toBeLessThan(route.indexOf('thesis'));
    }
  });
});
