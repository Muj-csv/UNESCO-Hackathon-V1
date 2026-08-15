import { describe, expect, it } from 'vitest';
import type { RoundResult } from '../types/contracts';
import { predictionTrend, spottedTheMachine } from './SessionReadout';

const result = (over: Partial<RoundResult> = {}): RoundResult => ({
  claimId: 'c1',
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

describe('spottedTheMachine', () => {
  it('sanity check — untouched by this task', () => {
    expect(spottedTheMachine([])).toEqual({ correct: 0, asked: 0 });
  });
});

describe('predictionTrend', () => {
  it('one entry per round that had predictions and a loss', () => {
    const results = [
      result({ predictions: { P1: 'HEDGE', P2: 'SCOPE' }, firstLostAtom: 'HEDGE' }),
      result({ predictions: { P1: 'HEDGE', P2: 'HEDGE' }, firstLostAtom: 'HEDGE' }),
    ];
    expect(predictionTrend(results)).toEqual([
      { round: 1, correct: 1, total: 2 },
      { round: 2, correct: 2, total: 2 },
    ]);
  });

  it('skips a round nobody predicted in', () => {
    const results = [result({ predictions: {}, firstLostAtom: 'HEDGE' })];
    expect(predictionTrend(results)).toEqual([]);
  });

  it('skips a round where nothing was lost — no atom to have called', () => {
    const results = [result({ predictions: { P1: 'HEDGE' }, firstLostAtom: null })];
    expect(predictionTrend(results)).toEqual([]);
  });

  it('keeps round numbers aligned to position even when earlier rounds are skipped', () => {
    const results = [
      result({ predictions: {}, firstLostAtom: null }),
      result({ predictions: { P1: 'CAUSE' }, firstLostAtom: 'CAUSE' }),
    ];
    expect(predictionTrend(results)).toEqual([{ round: 2, correct: 1, total: 1 }]);
  });
});
