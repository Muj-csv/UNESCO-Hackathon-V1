import type {
  Atom,
  AtomTruth,
  AtomVerdict,
  Claim,
  Confidence,
  DeathKind,
  Hop,
  LedgerOverrides,
  LedgerResult,
  Verification,
} from '../types/contracts';
import { ATOMS } from '../types/contracts';
import { containsAny, findPhrase, shrinkRatio } from './normalize';

/* ============================================================================
   The Decay Ledger.

   PURE FUNCTION. Claim + hops + verifications + overrides in, verdicts out.
   No DOM, no fetch, no state — this is what makes the signature screen
   testable, and the ledger is the one part of this project that has to be
   defensible.

   It records what happened to the claim. It never scores a person, and there
   is no total anywhere in this file.
   ========================================================================== */

/** Below this, a loss is asserted. Above it, the room is asked. */
const WEAK_SIGNAL_SHRINK = 0.6;

export function computeLedger(
  claim: Claim,
  hops: Hop[],
  verifications: Verification[] = [],
  overrides: LedgerOverrides = {},
): LedgerResult {
  const result = {} as LedgerResult;
  for (const atom of ATOMS) {
    result[atom] = verdictForAtom(atom, claim, hops, verifications, overrides);
  }
  return result;
}

function verdictForAtom(
  atom: Atom,
  claim: Claim,
  hops: Hop[],
  verifications: Verification[],
  overrides: LedgerOverrides,
): AtomVerdict {
  const truth: AtomTruth | undefined = claim.atoms?.[atom];
  const originalPhrase = truth?.phrase ?? truth?.keywords?.[0] ?? null;
  const judgeable = Boolean(truth?.keywords?.length || truth?.overreach?.length);

  let alive = true;
  let recovered = false;
  let deathHop: number | null = null;
  let deathKind: DeathKind | null = null;
  let finalPhrase: string | null = null;
  let confidence: Confidence = judgeable ? 'matched' : 'uncertain';

  for (let i = 0; i < hops.length; i++) {
    const hop = hops[i];

    /* A mid-chain check restores the atom AT THIS HOP ONLY.
       The prototype skipped every hop from the check onward, which made the
       atom immortal for the rest of the chain. The loop continues. */
    if (isVerifiedAt(verifications, i, atom)) {
      if (!alive) recovered = true;
      alive = true;
      deathHop = null;
      deathKind = null;
      finalPhrase = null;
      confidence = 'matched';
      continue;
    }

    if (!alive) continue;

    /* A hard tag beats anything inferred from the text. */
    if (hop.atomsLost?.includes(atom)) {
      alive = false;
      deathHop = i;
      deathKind = 'dropped';
      finalPhrase = null;
      confidence = 'authored';
      continue;
    }

    /* Overreach: the claim now says more than it was entitled to.
       Capture WHICH phrase matched — the ledger's "Final:" line is exactly
       this string, and the prototype tested for it and threw it away. */
    const overreached = findPhrase(hop.text, truth?.overreach);
    if (overreached) {
      alive = false;
      deathHop = i;
      deathKind = 'overreach';
      finalPhrase = overreached;
      confidence = 'matched';
      continue;
    }

    /* Dropped: nothing carrying the atom survived into this version. */
    if (truth?.keywords?.length && !containsAny(hop.text, truth.keywords)) {
      alive = false;
      deathHop = i;
      deathKind = 'dropped';
      finalPhrase = null;

      /* A hop that cut most of the text may have paraphrased rather than
         dropped. Too weak to assert, so the room adjudicates it instead. */
      const previous = i === 0 ? claim.originalText : hops[i - 1].text;
      confidence = shrinkRatio(previous, hop.text) > WEAK_SIGNAL_SHRINK ? 'uncertain' : 'matched';
    }
  }

  /* The engine proposes, the room decides. An override is final. */
  const override = overrides[atom];
  if (override === 'alive') {
    alive = true;
    deathHop = null;
    deathKind = null;
    finalPhrase = null;
    confidence = 'override';
  } else if (override === 'lost') {
    if (alive) {
      alive = false;
      deathHop = hops.length ? hops.length - 1 : null;
      deathKind = 'dropped';
      finalPhrase = null;
    }
    confidence = 'override';
  }

  return {
    atom,
    alive,
    deathHop,
    deathPlayer: deathHop === null ? null : (hops[deathHop]?.player ?? null),
    deathCardId: deathHop === null ? null : (hops[deathHop]?.cardId ?? null),
    originalPhrase,
    finalPhrase,
    deathKind,
    recovered,
    confidence,
  };
}

function isVerifiedAt(verifications: Verification[], hopIndex: number, atom: Atom): boolean {
  return verifications.some((v) => v.hopIndex === hopIndex && v.atoms.includes(atom));
}

/* ------------------------------------------------------------- selectors -- */
/* Derived readings of a result. No counting that ranks a person.            */

export function lostAtoms(result: LedgerResult): Atom[] {
  return ATOMS.filter((a) => !result[a].alive);
}

export function survivingAtoms(result: LedgerResult): Atom[] {
  return ATOMS.filter((a) => result[a].alive);
}

/** The first thing this claim lost. T4's feedback is built on it. */
export function firstLostAtom(result: LedgerResult): Atom | null {
  let earliest: Atom | null = null;
  let earliestHop = Number.POSITIVE_INFINITY;
  for (const atom of ATOMS) {
    const v = result[atom];
    if (v.alive || v.deathHop === null) continue;
    if (v.deathHop < earliestHop) {
      earliestHop = v.deathHop;
      earliest = atom;
    }
  }
  return earliest;
}

/** Rows the engine is not confident about. Only these are worth asking about. */
export function uncertainAtoms(result: LedgerResult): Atom[] {
  return ATOMS.filter((a) => result[a].confidence === 'uncertain');
}

/**
 * BAD FAITH's payoff: the imposter killed one on purpose, the honest players
 * killed three by accident. Derived from which hop the loss happened on, so
 * it needs no separate bookkeeping.
 */
export function splitByIntent(
  result: LedgerResult,
  hops: Hop[],
): { deliberate: Atom[]; accidental: Atom[] } {
  const deliberate: Atom[] = [];
  const accidental: Atom[] = [];
  for (const atom of lostAtoms(result)) {
    const hop = result[atom].deathHop === null ? null : hops[result[atom].deathHop];
    if (hop?.isImposter) deliberate.push(atom);
    else accidental.push(atom);
  }
  return { deliberate, accidental };
}
