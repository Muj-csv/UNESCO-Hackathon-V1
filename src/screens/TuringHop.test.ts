import { describe, expect, it } from 'vitest';
import type { GameState, RoundResult } from '../types/contracts';
import { gameReducer, initialState } from '../state/gameReducer';
import { spottedTheMachine } from './SessionReadout';

/* ==========================================================================
   The vote, and what the session does with it.

   Nothing here is a score. The room does not win by finding the machine, and
   most rooms do not find it — so the one thing these tests guard hardest is
   that a wrong guess and a missing guess stay distinguishable, and that
   neither is counted against anybody.
   ========================================================================== */

const result = (over: Partial<RoundResult> = {}): RoundResult => ({
  claimId: 'rainfall-alerts',
  mode: 'chain',
  playedAt: 0,
  verdicts: {} as RoundResult['verdicts'],
  lostAtoms: [],
  firstLostAtom: null,
  deliberateAtoms: [],
  accidentalAtoms: [],
  predictions: {},
  turingCorrect: null,
  terminalDecision: null,
  verifyChoice: null,
  ...over,
});

const roundWith = (over: Partial<GameState['round']>): GameState => ({
  ...initialState,
  round: { ...initialState.round, ...over },
});

describe('SET_TURING_GUESS', () => {
  it('records which hop the room voted for', () => {
    const next = gameReducer(roundWith({ aiHopIndexes: [2] }), {
      type: 'SET_TURING_GUESS',
      hopIndex: 1,
    });
    expect(next.round.turingGuess).toBe(1);
  });

  it('lets a room that changed its mind change its vote', () => {
    let state = gameReducer(roundWith({ aiHopIndexes: [2] }), { type: 'SET_TURING_GUESS', hopIndex: 1 });
    state = gameReducer(state, { type: 'SET_TURING_GUESS', hopIndex: 2 });
    expect(state.round.turingGuess).toBe(2);
  });
});

describe('what the round records about the vote', () => {
  const record = (over: Partial<GameState['round']>): boolean | null =>
    gameReducer(roundWith(over), { type: 'RECORD_ROUND_RESULT', result: result() }).session
      .results[0].turingCorrect;

  it('marks a room that found the machine', () => {
    expect(record({ aiHopIndexes: [2], turingGuess: 2 })).toBe(true);
  });

  it('marks a room that did not', () => {
    expect(record({ aiHopIndexes: [2], turingGuess: 4 })).toBe(false);
  });

  /* Not the same as a wrong answer, and it must not be counted as one. */
  it('records nothing when the room never voted', () => {
    expect(record({ aiHopIndexes: [2], turingGuess: null })).toBeNull();
  });

  it('records nothing when no machine played', () => {
    expect(record({ aiHopIndexes: [], turingGuess: 1 })).toBeNull();
  });

  /* A preset may deal the machine more than one hop. Finding either is
     finding it — the question was "which one was a machine", not "which
     one of the machine's". */
  it('accepts either hop when the machine took two', () => {
    expect(record({ aiHopIndexes: [1, 3], turingGuess: 3 })).toBe(true);
    expect(record({ aiHopIndexes: [1, 3], turingGuess: 2 })).toBe(false);
  });
});

describe('spottedTheMachine', () => {
  it('counts only the rounds the room was actually asked about', () => {
    const results = [
      result({ turingCorrect: true }),
      result({ turingCorrect: false }),
      result({ turingCorrect: null }), // no machine played, or nobody voted
      result({ turingCorrect: false }),
    ];
    expect(spottedTheMachine(results)).toEqual({ correct: 1, asked: 3 });
  });

  it('says nothing was asked when no round had a machine in it', () => {
    expect(spottedTheMachine([result(), result()])).toEqual({ correct: 0, asked: 0 });
  });

  it('handles a session that has not played yet', () => {
    expect(spottedTheMachine([])).toEqual({ correct: 0, asked: 0 });
  });

  /* The usual result, and the one the copy has to handle without reading as
     a failure. */
  it('reports a room that never found it', () => {
    const results = [result({ turingCorrect: false }), result({ turingCorrect: false })];
    expect(spottedTheMachine(results)).toEqual({ correct: 0, asked: 2 });
  });
});
