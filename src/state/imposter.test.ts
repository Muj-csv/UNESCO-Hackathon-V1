import { describe, expect, it } from 'vitest';
import type { Claim, GameState, Player } from '../types/contracts';
import { ATOMS } from '../types/contracts';
import {
  gameReducer,
  initialState,
  pickImposter,
  pickTargetAtom,
  prepareRound,
  settingsForPreset,
} from './gameReducer';
import rawClaims from '../data/claims.en.json';

const CLAIMS = rawClaims as Claim[];
const claim = CLAIMS[0];

const roomOf = (n: number): Player[] =>
  ['Ana', 'Ben', 'Cara', 'Dan', 'Eli', 'Fay'].slice(0, n).map((name, i) => ({ id: `p${i}`, name }));

/* ==========================================================================
   Who is quietly given a different brief.

   Every rule here is load-bearing for the reveal. Two imposters make it
   unreadable; an imposter on the first or last hop changes what the mode is
   about; an imposter on the machine's hop names a language model as the
   saboteur; and a target the claim never carried asks for a loss that cannot
   happen, which would show up on the ledger as deliberate damage nobody did.
   ========================================================================== */

describe('pickImposter', () => {
  it('never takes the first hop or the last one', () => {
    for (let i = 0; i < 300; i++) {
      for (const chainLength of [3, 5, 6, 8]) {
        const assignment = pickImposter(claim, roomOf(3), chainLength, [], 1);
        if (!assignment) continue;
        expect(assignment.hopIndex).toBeGreaterThan(0);
        expect(assignment.hopIndex).toBeLessThan(chainLength - 1);
      }
    }
  });

  /* A language model cannot be handed a secret brief, and the reveal has to
     be able to name a person. */
  it('never lands on a hop the machine is taking', () => {
    for (let i = 0; i < 200; i++) {
      const assignment = pickImposter(claim, roomOf(4), 6, [2, 3], 1);
      expect([2, 3]).not.toContain(assignment!.hopIndex);
    }
  });

  it('names the player who actually takes that hop', () => {
    const players = roomOf(3);
    for (let i = 0; i < 100; i++) {
      const assignment = pickImposter(claim, players, 6, [], 1)!;
      expect(assignment.player).toBe(players[assignment.hopIndex % players.length].name);
    }
  });

  it('targets a property this claim actually carries', () => {
    const present = ATOMS.filter((a) => claim.atoms[a]?.keywords?.length);
    for (let i = 0; i < 100; i++) {
      expect(present).toContain(pickImposter(claim, roomOf(3), 6, [], 1)!.targetAtom);
    }
  });

  /* Half the point of the mode is what the imposter learns from inside, so
     everybody has to get a turn at it. */
  it('rotates the role from round to round', () => {
    const players = roomOf(3);
    const played = [1, 2, 3].map(
      (round) => pickImposter(claim, players, 7, [], round)!.player,
    );
    expect(new Set(played).size).toBe(3);
    /* And comes back round rather than running out of people. */
    expect(pickImposter(claim, players, 7, [], 4)!.player).toBe(played[0]);
  });

  /* Rotation is the goal, but a round with an imposter beats a round that
     lost one because the rotation landed on somebody with no eligible hop. */
  it('still assigns somebody when the rotation has nowhere to land', () => {
    const players = roomOf(6);
    /* Chain of 4: only hops 1 and 2 are eligible, so players 3-5 never hold
       one. Round 4 is player 3's turn by rotation. */
    const assignment = pickImposter(claim, players, 4, [], 4);
    expect(assignment).not.toBeNull();
    expect([1, 2]).toContain(assignment!.hopIndex);
  });

  it('assigns nobody when the chain has no middle at all', () => {
    expect(pickImposter(claim, roomOf(3), 2, [], 1)).toBeNull();
  });

  it('assigns nobody when the machine has taken every middle hop', () => {
    expect(pickImposter(claim, roomOf(3), 4, [1, 2], 1)).toBeNull();
  });

  it('assigns nobody in an empty room', () => {
    expect(pickImposter(claim, [], 5, [], 1)).toBeNull();
  });
});

describe('pickTargetAtom', () => {
  it.each(CLAIMS.map((c) => [c.id, c] as const))('picks a real property of %s', (_id, c) => {
    const present = ATOMS.filter((a) => c.atoms[a]?.keywords?.length);
    for (let i = 0; i < 40; i++) expect(present).toContain(pickTargetAtom(c));
  });
});

describe('prepareRound', () => {
  const stateIn = (mode: GameState['settings']['mode'], players = roomOf(3)): GameState => ({
    ...initialState,
    players,
    settings: { ...settingsForPreset('standard', mode), aiHops: 0 },
  });

  it('deals an imposter in bad faith', () => {
    const setup = prepareRound(stateIn('badfaith'), CLAIMS);
    expect(setup.imposter).not.toBeNull();
    expect(setup.imposter!.hopIndex).toBeGreaterThan(0);
  });

  it('deals none in a plain chain', () => {
    expect(prepareRound(stateIn('chain'), CLAIMS).imposter).toBeNull();
  });

  /* Not a routing detail. The mode's lesson is that a group can fail to hold
     the truth between them with nobody working against it. */
  it('never deals one in crowd recall', () => {
    for (let i = 0; i < 50; i++) {
      expect(prepareRound(stateIn('crowd'), CLAIMS).imposter).toBeNull();
    }
  });

  it('keeps the imposter clear of the machine when both are in play', () => {
    const withAI: GameState = {
      ...initialState,
      players: roomOf(4),
      settings: { ...settingsForPreset('standard', 'badfaith'), aiHops: 1, chainLength: 6 },
    };
    for (let i = 0; i < 100; i++) {
      const setup = prepareRound(withAI, CLAIMS);
      expect(setup.aiHopIndexes).not.toContain(setup.imposter!.hopIndex);
    }
  });
});

describe('ASSIGN_IMPOSTER', () => {
  it('replaces rather than adds, because there is only ever one', () => {
    const first = { player: 'Ana', hopIndex: 1, targetAtom: 'HEDGE' as const };
    const second = { player: 'Ben', hopIndex: 2, targetAtom: 'SCOPE' as const };
    let state = gameReducer(initialState, { type: 'ASSIGN_IMPOSTER', assignment: first });
    state = gameReducer(state, { type: 'ASSIGN_IMPOSTER', assignment: second });
    expect(state.round.imposter).toEqual(second);
  });
});

/* The hop itself is stamped by SUBMIT_HOP, which the ledger then reads to
   separate what was done on purpose from what happened by accident. */
describe('the imposter’s hop', () => {
  it('is marked when that hop is submitted, and only that one', () => {
    let state: GameState = {
      ...initialState,
      players: roomOf(3),
      settings: { ...settingsForPreset('standard', 'badfaith'), chainLength: 4, aiHops: 0 },
      round: {
        ...initialState.round,
        claim,
        dealtCards: ['land', 'certain', 'land', 'certain'],
        imposter: { player: 'Ben', hopIndex: 1, targetAtom: 'HEDGE' },
      },
    };
    for (const text of ['One.', 'Two.', 'Three.', 'Four.']) {
      state = gameReducer(state, { type: 'SUBMIT_HOP', text });
    }
    expect(state.round.hops.map((h) => h.isImposter === true)).toEqual([false, true, false, false]);
  });
});
