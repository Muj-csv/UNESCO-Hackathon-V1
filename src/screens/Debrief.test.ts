import { describe, expect, it } from 'vitest';
import { predictionAccuracy } from './Debrief';

describe('predictionAccuracy', () => {
  it('counts how many predictions named the atom that actually went first', () => {
    const predictions = { P1: 'HEDGE', P2: 'HEDGE', P3: 'SCOPE', P4: 'HEDGE' } as const;
    expect(predictionAccuracy(predictions, 'HEDGE')).toEqual({ correct: 3, total: 4 });
  });

  it('is zero-correct, not a crash, when nothing was lost', () => {
    const predictions = { P1: 'HEDGE', P2: 'SCOPE' } as const;
    expect(predictionAccuracy(predictions, null)).toEqual({ correct: 0, total: 2 });
  });

  it('is zero-total with no predictions made', () => {
    expect(predictionAccuracy({}, 'CAUSE')).toEqual({ correct: 0, total: 0 });
  });
});
