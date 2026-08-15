import type { Atom, AtomTruth, Claim } from '../types/contracts';
import { ATOMS } from '../types/contracts';
import { containsPhrase } from './normalize';

/* ============================================================================
   OWNER: T10 (pack authoring).

   Validates a claim as an author builds it in Pack Studio. Readable errors,
   not stack traces — a student or a teacher hits these, not a developer.

   PURE. No DOM, no fetch, no state.
   ========================================================================== */

/** Working shape for one atom while it is still being authored. */
export interface AtomDraft {
  truth: string;
  phrase: string;
  keywords: string[];
  overreach: string[];
}

/** Working shape for a claim in progress. Converts to a real `Claim` via
    `draftToClaim` once it passes validation. */
export interface ClaimDraft {
  topic: string;
  originalText: string;
  atoms: Record<Atom, AtomDraft>;
  degraded: Record<Atom, string>;
}

export function emptyAtomDraft(): AtomDraft {
  return { truth: '', phrase: '', keywords: [], overreach: [] };
}

export function emptyClaimDraft(): ClaimDraft {
  const atoms = {} as Record<Atom, AtomDraft>;
  const degraded = {} as Record<Atom, string>;
  for (const atom of ATOMS) {
    atoms[atom] = emptyAtomDraft();
    degraded[atom] = '';
  }
  return { topic: '', originalText: '', atoms, degraded };
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const ATOM_LABEL: Record<Atom, string> = {
  SOURCE: 'Source',
  NUMBER: 'Number',
  HEDGE: 'Hedge',
  SCOPE: 'Scope',
  CAUSE: 'Cause',
};

export function validateClaim(draft: ClaimDraft): ValidationResult {
  const errors: ValidationIssue[] = [];
  const originalText = draft.originalText.trim();

  if (!originalText) {
    errors.push({
      field: 'originalText',
      message: 'Write the original claim before tagging anything.',
    });
  }

  for (const atom of ATOMS) {
    const label = ATOM_LABEL[atom];
    const a = draft.atoms[atom];
    const phrase = a?.phrase.trim() ?? '';

    if (!phrase) {
      errors.push({
        field: `atoms.${atom}.phrase`,
        message: `${label} needs a tagged phrase from the original text.`,
      });
    } else if (originalText && !containsPhrase(originalText, phrase)) {
      errors.push({
        field: `atoms.${atom}.phrase`,
        message: `The ${label} phrase isn't in the original text anymore — select it again.`,
      });
    }

    for (const kw of a?.keywords ?? []) {
      if (!kw.trim()) continue;
      if (originalText && !containsPhrase(originalText, kw)) {
        errors.push({
          field: `atoms.${atom}.keywords`,
          message: `${label}'s alternative phrasing "${kw.trim()}" doesn't appear in the original text.`,
        });
      }
    }

    const variant = draft.degraded[atom]?.trim() ?? '';
    if (!variant) {
      errors.push({
        field: `degraded.${atom}`,
        message: `Write the variant where ${label} is the one that degrades.`,
      });
      continue;
    }
    if (originalText && variant === originalText) {
      errors.push({
        field: `degraded.${atom}`,
        message: `The ${label} variant reads exactly like the original — it needs to actually degrade ${label}.`,
      });
    }

    for (const other of ATOMS) {
      if (other === atom) continue;
      const otherDraft = draft.atoms[other];
      const keywords = [otherDraft?.phrase, ...(otherDraft?.keywords ?? [])].filter(
        (k): k is string => !!k?.trim(),
      );
      if (!keywords.length) continue;
      const survives = keywords.some((kw) => containsPhrase(variant, kw));
      if (!survives) {
        errors.push({
          field: `degraded.${atom}`,
          message: `The ${label} variant should keep ${ATOM_LABEL[other]} intact, but none of its tagged phrasing appears in this variant.`,
        });
      }
    }
  }

  return { errors, warnings: suspiciousEntities(originalText) };
}

/* -------------------------------------------------------- entity flagging -- */
/* Heuristic only, and deliberately never blocking. Fabricated claims only —
   an author who names a real organisation or person needs to see it before
   sharing this pack, but a false positive here should never stop them. */

const CAPITALIZED_RUN = /\b([A-Z][a-zA-Z'.]*(?:\s+[A-Z][a-zA-Z'.]*)+)\b/g;

export function suspiciousEntities(text: string): ValidationIssue[] {
  if (!text) return [];
  const found = new Set<string>();
  const re = new RegExp(CAPITALIZED_RUN);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    found.add(match[1].trim());
  }
  return Array.from(found).map((entity) => ({
    field: 'originalText',
    message: `"${entity}" reads like a real name — double-check it's fabricated. No real people or organisations.`,
  }));
}

/* ------------------------------------------------------------- conversion -- */

function dedupeNonEmpty(values: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const trimmed = v?.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    out.push(trimmed);
  }
  return out;
}

/** A validated draft, given an id and language, becomes a real `Claim`. */
export function draftToClaim(draft: ClaimDraft, id: string, lang: Claim['lang'] = 'en'): Claim {
  const atoms = {} as Record<Atom, AtomTruth>;
  for (const atom of ATOMS) {
    const a = draft.atoms[atom];
    atoms[atom] = {
      truth: a.truth.trim(),
      phrase: a.phrase.trim(),
      keywords: dedupeNonEmpty([a.phrase, ...a.keywords]),
      overreach: dedupeNonEmpty(a.overreach),
    };
  }
  return {
    id,
    topic: draft.topic.trim() || 'Untitled',
    lang,
    originalText: draft.originalText.trim(),
    atoms,
    degraded: ATOMS.reduce(
      (acc, atom) => {
        acc[atom] = draft.degraded[atom]?.trim() ?? '';
        return acc;
      },
      {} as Record<Atom, string>,
    ),
  };
}

/** A stable, URL-safe id derived from the topic, for a claim authored fresh. */
export function makeClaimId(topic: string): string {
  const slug = topic
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'custom-claim'}-${Math.random().toString(36).slice(2, 7)}`;
}
