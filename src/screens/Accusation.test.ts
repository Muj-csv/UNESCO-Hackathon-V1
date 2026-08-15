import { describe, expect, it } from 'vitest';
import type { GameState, RoundResult } from '../types/contracts';
import { gameReducer, initialState, routeFor, settingsForPreset } from '../state/gameReducer';

/* ==========================================================================
   The room's vote.

   The one property worth guarding hardest: naming the imposter correctly
   must earn nothing anywhere in the application. The payoff is the ledger
   one screen later, showing that the person the room hunted did less damage
   than the people trying to help — and a small win here would let the room
   stop before it reads that.
   ========================================================================== */

const badFaith = (over: Partial<GameState['round']> = {}): GameState => ({
  ...initialState,
  settings: settingsForPreset('standard', 'badfaith'),
  players: [
    { id: 'a', name: 'Ana' },
    { id: 'b', name: 'Ben' },
    { id: 'c', name: 'Cara' },
  ],
  round: {
    ...initialState.round,
    imposter: { player: 'Ben', hopIndex: 2, targetAtom: 'HEDGE' },
    ...over,
  },
});

describe('CAST_ACCUSATION', () => {
  it('records who the room named', () => {
    const next = gameReducer(badFaith(), { type: 'CAST_ACCUSATION', player: 'Cara' });
    expect(next.round.accusation).toBe('Cara');
  });

  it('lets a room that changed its mind name somebody else', () => {
    let state = gameReducer(badFaith(), { type: 'CAST_ACCUSATION', player: 'Cara' });
    state = gameReducer(state, { type: 'CAST_ACCUSATION', player: 'Ben' });
    expect(state.round.accusation).toBe('Ben');
  });

  it('changes nothing else about the round', () => {
    const before = badFaith();
    const after = gameReducer(before, { type: 'CAST_ACCUSATION', player: 'Ben' });
    expect({ ...after.round, accusation: null }).toEqual(before.round);
    expect(after.session).toBe(before.session);
  });

  /* Naming them right and naming them wrong must be indistinguishable to
     every part of the app that keeps a number. */
  it('is not counted anywhere in the session', () => {
    const right = gameReducer(badFaith(), { type: 'CAST_ACCUSATION', player: 'Ben' });
    const wrong = gameReducer(badFaith(), { type: 'CAST_ACCUSATION', player: 'Cara' });
    expect(right.session).toEqual(wrong.session);

    const result = {
      claimId: 'rainfall-alerts',
      mode: 'badfaith',
      playedAt: 0,
      verdicts: {},
      lostAtoms: [],
      firstLostAtom: null,
      deliberateAtoms: [],
      accidentalAtoms: [],
      predictions: {},
      turingCorrect: null,
      terminalDecision: null,
      verifyChoice: null,
    } as unknown as RoundResult;

    const recordedRight = gameReducer(right, { type: 'RECORD_ROUND_RESULT', result });
    const recordedWrong = gameReducer(wrong, { type: 'RECORD_ROUND_RESULT', result });
    expect(recordedRight.session.results).toEqual(recordedWrong.session.results);
  });
});

describe('REVEAL_ROLES', () => {
  /* On one device the reveal is derived from the accusation being set, so
     there is nothing for this to store. It is T7's trigger for a server that
     has been withholding hop.isImposter, and storing that needs a field
     contracts.ts does not have. */
  it('is deliberately inert on a passed device', () => {
    const voted = gameReducer(badFaith(), { type: 'CAST_ACCUSATION', player: 'Ben' });
    expect(gameReducer(voted, { type: 'REVEAL_ROLES' })).toBe(voted);
  });
});

describe('where the accusation sits', () => {
  it('comes after the reveal and before the thesis', () => {
    const route = routeFor('badfaith');
    expect(route.indexOf('reveal')).toBeLessThan(route.indexOf('accusation'));
    expect(route[route.indexOf('accusation') + 1]).toBe('thesis');
  });

  /* Not a routing detail. The mode's lesson requires the absence of one. */
  it('never appears in crowd recall', () => {
    expect(routeFor('crowd')).not.toContain('accusation');
  });
});
