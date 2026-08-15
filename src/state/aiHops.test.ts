import { describe, expect, it } from 'vitest';
import type { Claim, GameState } from '../types/contracts';
import {
  gameReducer,
  initialState,
  pickAIHopIndexes,
  prepareRound,
  settingsForPreset,
} from './gameReducer';
import rawClaims from '../data/claims.en.json';

const CLAIMS = rawClaims as Claim[];

/* ==========================================================================
   Where the machine takes its turn, and how its text gets in.

   Both halves are load-bearing for the Turing Hop: a machine hop that always
   landed in the same place, or that could overwrite a person's hop, would
   give the answer away before the room is asked the question.
   ========================================================================== */

describe('pickAIHopIndexes', () => {
  it('never takes the first hop or the last one', () => {
    /* Run it enough times that a bad boundary shows up rather than hides. */
    for (let i = 0; i < 200; i++) {
      for (const chainLength of [3, 4, 5, 6, 8, 12]) {
        for (const indexes of [pickAIHopIndexes(1, chainLength), pickAIHopIndexes(3, chainLength)]) {
          for (const index of indexes) {
            expect(index).toBeGreaterThan(0);
            expect(index).toBeLessThan(chainLength - 1);
          }
        }
      }
    }
  });

  it('places as many hops as the preset asked for', () => {
    expect(pickAIHopIndexes(1, 6)).toHaveLength(1);
    expect(pickAIHopIndexes(3, 6)).toHaveLength(3);
  });

  it('never places the same hop twice', () => {
    for (let i = 0; i < 100; i++) {
      const indexes = pickAIHopIndexes(4, 6);
      expect(new Set(indexes).size).toBe(indexes.length);
    }
  });

  it('gives back what it can when the chain has fewer middles than asked', () => {
    expect(pickAIHopIndexes(5, 4)).toHaveLength(2); // hops 1 and 2 only
  });

  /* A chain of two is all first-and-last. Rather than bend the rule, the
     round simply has no machine hop — and TuringHop skips itself. */
  it('leaves a chain with no middle alone', () => {
    expect(pickAIHopIndexes(1, 2)).toEqual([]);
    expect(pickAIHopIndexes(1, 1)).toEqual([]);
  });

  it('places nothing when the room turned the participant off', () => {
    expect(pickAIHopIndexes(0, 6)).toEqual([]);
  });

  it('reports the hops in the order they will be played', () => {
    const indexes = pickAIHopIndexes(3, 8);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });
});

describe('prepareRound', () => {
  const stateWith = (over: Partial<GameState['settings']>): GameState => ({
    ...initialState,
    settings: { ...settingsForPreset('standard', 'chain'), ...over },
  });

  it('deals the machine a hop in a chain round', () => {
    const setup = prepareRound(stateWith({ aiHops: 1, chainLength: 5 }), CLAIMS);
    expect(setup.aiHopIndexes).toHaveLength(1);
    expect(setup.aiHopIndexes[0]).toBeGreaterThan(0);
    expect(setup.aiHopIndexes[0]).toBeLessThan(4);
  });

  /* CROWD RECALL has no chain — everyone reads at the same time, so there is
     no hop for a machine to take. */
  it('deals none in crowd recall', () => {
    const crowd: GameState = {
      ...initialState,
      settings: { ...settingsForPreset('standard', 'crowd'), aiHops: 1 },
    };
    expect(prepareRound(crowd, CLAIMS).aiHopIndexes).toEqual([]);
  });
});

describe('SET_AI_HOP', () => {
  const midRound = (over: Partial<GameState['round']> = {}): GameState => ({
    ...initialState,
    settings: { ...settingsForPreset('standard', 'chain'), chainLength: 5 },
    round: {
      ...initialState.round,
      claim: CLAIMS[0],
      dealtCards: ['chars', 'certain', 'land', 'secs', 'headline'],
      aiHopIndexes: [2],
      currentHop: 2,
      hops: [
        { player: 'Ana', text: 'One.', cardId: 'chars' },
        { player: 'Ben', text: 'Two.', cardId: 'certain' },
      ],
      ...over,
    },
  });

  it('records the rewrite as the machine\'s, with the card it was written under', () => {
    const next = gameReducer(midRound(), { type: 'SET_AI_HOP', hopIndex: 2, text: 'A shorter version.' });
    const hop = next.round.hops[2];
    expect(hop.text).toBe('A shorter version.');
    expect(hop.isAI).toBe(true);
    expect(hop.cardId).toBe('land');
    expect(next.round.currentHop).toBe(3);
  });

  /* The machine's turn is the only one that arrives over the network. A slow
     response landing after the room moved on must not overwrite a person. */
  it('drops a response that arrives after the round has moved on', () => {
    const moved = midRound({ currentHop: 3, hops: [
      { player: 'Ana', text: 'One.', cardId: 'chars' },
      { player: 'Ben', text: 'Two.', cardId: 'certain' },
      { player: 'Cara', text: 'Three.', cardId: 'land' },
    ] });
    const next = gameReducer(moved, { type: 'SET_AI_HOP', hopIndex: 2, text: 'Too late.' });
    expect(next).toBe(moved);
  });

  it('refuses to write a machine hop where no machine hop was dealt', () => {
    const noMachine = midRound({ aiHopIndexes: [] });
    const next = gameReducer(noMachine, { type: 'SET_AI_HOP', hopIndex: 2, text: 'Not mine.' });
    expect(next).toBe(noMachine);
  });

  it('sends the room to the terminal when the machine took the last hop', () => {
    const last = midRound({ currentHop: 4, aiHopIndexes: [4], hops: [
      { player: 'Ana', text: 'One.', cardId: 'chars' },
      { player: 'Ben', text: 'Two.', cardId: 'certain' },
      { player: 'Cara', text: 'Three.', cardId: 'land' },
      { player: 'Ana', text: 'Four.', cardId: 'secs' },
    ] });
    const next = gameReducer(last, { type: 'SET_AI_HOP', hopIndex: 4, text: 'Five.' });
    expect(next.screen).toBe('terminal');
    expect(next.round.hops).toHaveLength(5);
  });
});
