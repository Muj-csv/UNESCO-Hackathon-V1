import { describe, expect, it } from 'vitest';
import type { Atom } from '../types/contracts';
import { ATOMS } from '../types/contracts';
import {
  draftToClaim,
  emptyClaimDraft,
  suspiciousEntities,
  validateClaim,
} from './validateClaim';
import type { ClaimDraft } from './validateClaim';

/* A minimal draft that passes validation cleanly, so each test only needs to
   break the one thing it is checking. */
function validDraft(): ClaimDraft {
  const draft = emptyClaimDraft();
  draft.topic = 'Weather';
  draft.originalText =
    'The Lirano Weather Desk says early figures suggest heavier rain is linked to a 12 percent rise in flood alerts across Vindra district — 20 alerts last year, 22 this year.';

  draft.atoms.SOURCE = {
    truth: 'A named desk.',
    phrase: 'The Lirano Weather Desk',
    keywords: ['lirano weather desk'],
    overreach: ['officials'],
  };
  draft.atoms.NUMBER = {
    truth: '12 percent, base included.',
    phrase: '12 percent rise',
    keywords: ['12 percent', '20 alerts', '22 this year'],
    overreach: ['massive rise'],
  };
  draft.atoms.HEDGE = {
    truth: 'Early figures that suggest.',
    phrase: 'early figures suggest',
    keywords: ['early figures', 'suggest'],
    overreach: ['proves'],
  };
  draft.atoms.SCOPE = {
    truth: 'Vindra district only.',
    phrase: 'Vindra district',
    keywords: ['vindra district', 'vindra'],
    overreach: ['everywhere'],
  };
  draft.atoms.CAUSE = {
    truth: 'Linked to, not caused by.',
    phrase: 'linked to',
    keywords: ['linked to'],
    overreach: ['causes'],
  };

  /* Each variant degrades exactly the atom it's filed under and keeps every
     other atom's tagged phrasing intact. */
  draft.degraded.SOURCE =
    'Officials say early figures suggest heavier rain is linked to a 12 percent rise in flood alerts across Vindra district — 20 alerts last year, 22 this year.';
  draft.degraded.NUMBER =
    'The Lirano Weather Desk says early figures suggest heavier rain is linked to a massive rise in flood alerts across Vindra district.';
  draft.degraded.HEDGE =
    'The Lirano Weather Desk says heavier rain is linked to a 12 percent rise in flood alerts across Vindra district — 20 alerts last year, 22 this year.';
  draft.degraded.SCOPE =
    'The Lirano Weather Desk says early figures suggest heavier rain is linked to a 12 percent rise in flood alerts everywhere.';
  draft.degraded.CAUSE =
    'The Lirano Weather Desk says early figures suggest heavier rain causes a 12 percent rise in flood alerts across Vindra district — 20 alerts last year, 22 this year.';

  return draft;
}

describe('validateClaim — a well-formed draft', () => {
  it('passes with no errors', () => {
    const { errors } = validateClaim(validDraft());
    expect(errors).toEqual([]);
  });
});

describe('validateClaim — original text', () => {
  it('requires the original text', () => {
    const draft = validDraft();
    draft.originalText = '';
    const { errors } = validateClaim(draft);
    expect(errors.some((e) => e.field === 'originalText')).toBe(true);
  });
});

describe('validateClaim — atom tagging', () => {
  it('requires a non-empty phrase for every atom', () => {
    const draft = validDraft();
    draft.atoms.HEDGE.phrase = '';
    const { errors } = validateClaim(draft);
    expect(errors.some((e) => e.field === 'atoms.HEDGE.phrase')).toBe(true);
  });

  it('rejects a phrase that is not actually in the original text', () => {
    const draft = validDraft();
    draft.atoms.SCOPE.phrase = 'a place never mentioned';
    const { errors } = validateClaim(draft);
    expect(errors.some((e) => e.field === 'atoms.SCOPE.phrase')).toBe(true);
  });

  it('rejects a keyword that is not in the original text', () => {
    const draft = validDraft();
    draft.atoms.NUMBER.keywords.push('9000 percent');
    const { errors } = validateClaim(draft);
    expect(errors.some((e) => e.field === 'atoms.NUMBER.keywords')).toBe(true);
  });

  it('checks every atom independently, in one pass', () => {
    const draft = validDraft();
    for (const atom of ATOMS) draft.atoms[atom].phrase = '';
    const { errors } = validateClaim(draft);
    for (const atom of ATOMS) {
      expect(errors.some((e) => e.field === `atoms.${atom}.phrase`)).toBe(true);
    }
  });
});

describe('validateClaim — degraded variants', () => {
  it('requires all five variants', () => {
    const draft = validDraft();
    draft.degraded.CAUSE = '';
    const { errors } = validateClaim(draft);
    expect(errors.some((e) => e.field === 'degraded.CAUSE')).toBe(true);
  });

  it('rejects a variant identical to the original', () => {
    const draft = validDraft();
    draft.degraded.HEDGE = draft.originalText;
    const { errors } = validateClaim(draft);
    expect(errors.some((e) => e.field === 'degraded.HEDGE')).toBe(true);
  });

  it('rejects a variant that drops an atom it was not supposed to touch', () => {
    const draft = validDraft();
    /* The NUMBER variant should keep SOURCE, HEDGE, SCOPE and CAUSE intact —
       strip SOURCE out of it too. */
    draft.degraded.NUMBER =
      'Early figures suggest heavier rain is linked to a massive rise in flood alerts across Vindra district.';
    const { errors } = validateClaim(draft);
    expect(errors.some((e) => e.field === 'degraded.NUMBER')).toBe(true);
  });

  it('accepts a variant that keeps the other four atoms via any tagged keyword, not just the phrase', () => {
    const draft = validDraft();
    draft.atoms.SOURCE.keywords.push('the desk');
    /* Swap SOURCE's canonical phrase for a keyword-only mention. */
    draft.degraded.NUMBER =
      'The desk says early figures suggest heavier rain is linked to a massive rise in flood alerts across Vindra district.';
    const { errors } = validateClaim(draft);
    expect(errors.some((e) => e.field === 'degraded.NUMBER')).toBe(false);
  });
});

describe('validateClaim — real-entity flagging', () => {
  it('flags a suspicious capitalised run as a warning, not an error', () => {
    const draft = validDraft();
    const rename = (s: string) => s.replace(/The Lirano Weather Desk/g, 'The World Health Organization');
    draft.originalText = rename(draft.originalText);
    for (const atom of ATOMS) draft.degraded[atom] = rename(draft.degraded[atom]);
    draft.atoms.SOURCE.phrase = 'The World Health Organization';
    draft.atoms.SOURCE.keywords = ['world health organization'];
    const { errors, warnings } = validateClaim(draft);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.message.includes('World Health Organization'))).toBe(true);
  });

  it('never blocks on a flagged entity', () => {
    const issues = suspiciousEntities('The United Nations released new data yesterday.');
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.field === 'originalText')).toBe(true);
  });

  it('finds nothing to flag in an ordinary sentence', () => {
    expect(suspiciousEntities('rain fell across the district yesterday')).toEqual([]);
  });
});

describe('draftToClaim', () => {
  it('produces a Claim whose atoms carry the phrase as a keyword too', () => {
    const claim = draftToClaim(validDraft(), 'test-id', 'en');
    expect(claim.id).toBe('test-id');
    expect(claim.atoms.SOURCE.keywords).toContain('The Lirano Weather Desk');
  });

  it('round-trips every atom and every degraded variant', () => {
    const draft = validDraft();
    const claim = draftToClaim(draft, 'test-id');
    for (const atom of ATOMS as Atom[]) {
      expect(claim.atoms[atom].phrase).toBe(draft.atoms[atom].phrase);
      expect(claim.degraded[atom]).toBe(draft.degraded[atom]);
    }
  });

  it('dedupes keywords case-insensitively', () => {
    const draft = validDraft();
    draft.atoms.SOURCE.keywords.push('The Lirano Weather Desk');
    const claim = draftToClaim(draft, 'test-id');
    const lower = claim.atoms.SOURCE.keywords.map((k) => k.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });
});
