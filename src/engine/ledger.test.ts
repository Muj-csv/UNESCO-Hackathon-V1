import { describe, expect, it } from 'vitest';
import type { Claim, Hop, Verification } from '../types/contracts';
import { ATOMS } from '../types/contracts';
import {
  computeLedger,
  firstLostAtom,
  lostAtoms,
  splitByIntent,
  survivingAtoms,
  uncertainAtoms,
} from './ledger';
import rawClaims from '../data/claims.en.json';

const CLAIMS = rawClaims as Claim[];
const rainfall = CLAIMS.find((c) => c.id === 'rainfall-alerts')!;

const hop = (text: string, over: Partial<Hop> = {}): Hop => ({
  player: 'Mika',
  text,
  cardId: 'certain',
  ...over,
});

describe('computeLedger — a claim that survives', () => {
  it('keeps every atom alive when the text is passed on unchanged', () => {
    const result = computeLedger(rainfall, [hop(rainfall.originalText)]);
    expect(survivingAtoms(result)).toEqual([...ATOMS]);
    expect(lostAtoms(result)).toEqual([]);
  });

  it('reports no deaths for an empty chain', () => {
    const result = computeLedger(rainfall, []);
    expect(lostAtoms(result)).toEqual([]);
    expect(firstLostAtom(result)).toBe(null);
  });

  it('carries the original phrase for every atom', () => {
    const result = computeLedger(rainfall, [hop(rainfall.originalText)]);
    expect(result.CAUSE.originalPhrase).toBe('is associated with');
    expect(result.SOURCE.originalPhrase).toBe('The San Ramil Weather Bureau');
  });
});

describe('computeLedger — death by overreach', () => {
  it('records the phrase that actually matched, not just that one did', () => {
    const result = computeLedger(rainfall, [hop(rainfall.degraded.CAUSE)]);
    expect(result.CAUSE.alive).toBe(false);
    expect(result.CAUSE.deathKind).toBe('overreach');
    expect(result.CAUSE.finalPhrase).toBe('causing');
    expect(result.CAUSE.originalPhrase).toBe('is associated with');
  });

  it('names the hop, the player and the card behind it', () => {
    const hops = [
      hop(rainfall.originalText, { player: 'Dan', cardId: 'chars' }),
      hop(rainfall.degraded.CAUSE, { player: 'Rowena', cardId: 'certain' }),
    ];
    const result = computeLedger(rainfall, hops);
    expect(result.CAUSE.deathHop).toBe(1);
    expect(result.CAUSE.deathPlayer).toBe('Rowena');
    expect(result.CAUSE.deathCardId).toBe('certain');
  });
});

describe('computeLedger — death by dropping', () => {
  const noSource =
    'Preliminary October figures suggest heavier upstream rainfall is associated with a 15 percent rise in flood alerts across the Malaya river basin — 40 alerts last October, 46 this year.';

  it('marks the atom dropped with no final phrase', () => {
    const result = computeLedger(rainfall, [hop(noSource)]);
    expect(result.SOURCE.alive).toBe(false);
    expect(result.SOURCE.deathKind).toBe('dropped');
    expect(result.SOURCE.finalPhrase).toBe(null);
  });

  it('leaves the other atoms untouched', () => {
    const result = computeLedger(rainfall, [hop(noSource)]);
    expect(lostAtoms(result)).toEqual(['SOURCE']);
  });
});

describe('computeLedger — confidence', () => {
  it('is confident when a hop dropped an atom without cutting much', () => {
    const noSource =
      'Preliminary October figures suggest heavier upstream rainfall is associated with a 15 percent rise in flood alerts across the Malaya river basin — 40 alerts last October, 46 this year.';
    const result = computeLedger(rainfall, [hop(noSource)]);
    expect(result.SOURCE.confidence).toBe('matched');
    expect(uncertainAtoms(result)).toEqual([]);
  });

  it('defers to the room when a hop cut most of the text away', () => {
    const result = computeLedger(rainfall, [hop('Flooding is up this year.')]);
    expect(result.SCOPE.confidence).toBe('uncertain');
    expect(uncertainAtoms(result).length).toBeGreaterThan(0);
  });

  it('trusts a hard tag over anything inferred from the text', () => {
    const result = computeLedger(rainfall, [hop(rainfall.originalText, { atomsLost: ['HEDGE'] })]);
    expect(result.HEDGE.alive).toBe(false);
    expect(result.HEDGE.confidence).toBe('authored');
    expect(result.HEDGE.deathKind).toBe('dropped');
  });
});

/* ==========================================================================
   Bug the prototype shipped: a mid-chain check skipped every hop from that
   point on, so a verified atom could never die again for the rest of the
   chain. A check restores it AT THAT HOP ONLY.
   ========================================================================== */
describe('computeLedger — mid-chain verification', () => {
  const kills = rainfall.degraded.CAUSE;

  it('restores an atom at the hop that was checked', () => {
    const hops = [hop(kills), hop(rainfall.originalText)];
    const verifications: Verification[] = [{ hopIndex: 1, atoms: ['CAUSE'] }];
    const result = computeLedger(rainfall, hops, verifications);
    expect(result.CAUSE.alive).toBe(true);
    expect(result.CAUSE.recovered).toBe(true);
    expect(result.CAUSE.deathHop).toBe(null);
  });

  it('does NOT make the atom immortal for the rest of the chain', () => {
    const hops = [hop(kills), hop(rainfall.originalText), hop(kills, { player: 'Kiel' })];
    const verifications: Verification[] = [{ hopIndex: 1, atoms: ['CAUSE'] }];
    const result = computeLedger(rainfall, hops, verifications);
    expect(result.CAUSE.alive).toBe(false);
    expect(result.CAUSE.deathHop).toBe(2);
    expect(result.CAUSE.deathPlayer).toBe('Kiel');
    /* it did come back once, and the ledger still says so */
    expect(result.CAUSE.recovered).toBe(true);
  });

  it('only restores the atoms the check actually covered', () => {
    const hops = [hop('Flooding causes chaos everywhere.'), hop('Flooding causes chaos everywhere.')];
    const result = computeLedger(rainfall, hops, [{ hopIndex: 1, atoms: ['CAUSE'] }]);
    expect(result.CAUSE.alive).toBe(true);
    expect(result.SOURCE.alive).toBe(false);
  });

  it('does not mark an atom recovered when it was never lost', () => {
    const result = computeLedger(rainfall, [hop(rainfall.originalText)], [
      { hopIndex: 0, atoms: ['CAUSE'] },
    ]);
    expect(result.CAUSE.recovered).toBe(false);
  });
});

describe('computeLedger — room overrides', () => {
  const kills = rainfall.degraded.CAUSE;

  it('lets the room bring an atom back', () => {
    const result = computeLedger(rainfall, [hop(kills)], [], { CAUSE: 'alive' });
    expect(result.CAUSE.alive).toBe(true);
    expect(result.CAUSE.confidence).toBe('override');
    expect(result.CAUSE.deathHop).toBe(null);
  });

  it('lets the room call an atom gone', () => {
    const hops = [hop(rainfall.originalText), hop(rainfall.originalText, { player: 'Ari' })];
    const result = computeLedger(rainfall, hops, [], { HEDGE: 'lost' });
    expect(result.HEDGE.alive).toBe(false);
    expect(result.HEDGE.confidence).toBe('override');
    expect(result.HEDGE.deathHop).toBe(1);
    expect(result.HEDGE.deathPlayer).toBe('Ari');
  });
});

describe('selectors', () => {
  it('finds the atom that went first', () => {
    const hops = [hop(rainfall.degraded.HEDGE), hop(rainfall.degraded.CAUSE)];
    const result = computeLedger(rainfall, hops);
    expect(firstLostAtom(result)).toBe('HEDGE');
  });

  /* The inversion BAD FAITH exists to produce: the imposter kills one atom on
     purpose while the honest players kill three by accident. */
  it('separates a deliberate loss from the accidental ones', () => {
    const hops = [
      /* honest — the named bureau does not survive the retelling */
      hop(
        'Preliminary October figures suggest heavier upstream rainfall is associated with a 15 percent rise in flood alerts across the Malaya river basin — 40 alerts last October, 46 this year.',
        { player: 'Dan' },
      ),
      /* the imposter, told to make one property die. One word does it. */
      hop(
        'Preliminary October figures suggest heavier upstream rainfall is causing a 15 percent rise in flood alerts across the Malaya river basin — 40 alerts last October, 46 this year.',
        { player: 'Rowena', isImposter: true },
      ),
      /* honest, under pressure — and more destructive than the saboteur */
      hop(
        'October figures show heavier upstream rainfall is causing more flood alerts across the Malaya river basin.',
        { player: 'Kiel' },
      ),
    ];

    const result = computeLedger(rainfall, hops);
    const { deliberate, accidental } = splitByIntent(result, hops);

    expect(deliberate).toEqual(['CAUSE']);
    expect(accidental.sort()).toEqual(['HEDGE', 'NUMBER', 'SOURCE']);
    expect(accidental.length).toBeGreaterThan(deliberate.length);
    /* and SCOPE came through all three hops intact */
    expect(survivingAtoms(result)).toEqual(['SCOPE']);
  });
});

describe('computeLedger is a pure function', () => {
  it('returns the same verdicts for the same inputs', () => {
    const hops = [hop(rainfall.degraded.CAUSE)];
    expect(computeLedger(rainfall, hops)).toEqual(computeLedger(rainfall, hops));
  });

  it('does not mutate what it was given', () => {
    const hops = [hop(rainfall.degraded.CAUSE)];
    const claimBefore = JSON.stringify(rainfall);
    const hopsBefore = JSON.stringify(hops);
    const verifications: Verification[] = [{ hopIndex: 0, atoms: ['CAUSE'] }];
    const overrides = { HEDGE: 'lost' } as const;

    computeLedger(rainfall, hops, verifications, overrides);

    expect(JSON.stringify(rainfall)).toBe(claimBefore);
    expect(JSON.stringify(hops)).toBe(hopsBefore);
    expect(verifications).toEqual([{ hopIndex: 0, atoms: ['CAUSE'] }]);
    expect(overrides).toEqual({ HEDGE: 'lost' });
  });
});

/* ==========================================================================
   The shipped claim library, checked against the engine that will audit it.
   Every authored variant must kill exactly the atom it names and leave the
   other four standing — otherwise CROWD RECALL deals a version that is
   missing two properties and the ledger blames the wrong pressure.
   ========================================================================== */
describe('shipped claims', () => {
  it.each(CLAIMS.map((c) => [c.id, c] as const))('%s has all five atoms authored', (_id, claim) => {
    for (const atom of ATOMS) {
      expect(claim.atoms[atom]?.truth, `${atom} truth`).toBeTruthy();
      expect(claim.atoms[atom]?.phrase, `${atom} phrase`).toBeTruthy();
      expect(claim.atoms[atom]?.keywords?.length, `${atom} keywords`).toBeGreaterThan(0);
    }
  });

  it.each(CLAIMS.map((c) => [c.id, c] as const))('%s survives its own original text', (_id, claim) => {
    const result = computeLedger(claim, [hop(claim.originalText)]);
    expect(lostAtoms(result)).toEqual([]);
  });

  it.each(
    CLAIMS.flatMap((c) => ATOMS.map((a) => [c.id, a, c] as const)),
  )('%s degraded.%s kills that atom and only that atom', (_id, atom, claim) => {
    const result = computeLedger(claim, [hop(claim.degraded[atom])]);
    expect(result[atom].alive, `${atom} should be lost`).toBe(false);
    expect(lostAtoms(result)).toEqual([atom]);
  });
});
