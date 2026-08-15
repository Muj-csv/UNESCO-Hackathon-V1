import type { Atom } from '../types/contracts';
import type { IconName } from '../components/Icon';

/* ============================================================================
   How the five atoms are PRESENTED. Not what they mean — that lives in the
   claim library, per claim, as `AtomTruth.truth`.

   One icon and one short gloss each, defined once so that the same property
   is recognisable by the same mark wherever it appears: the how-to-play list,
   the prediction cards, the terminal reader's questions, the debrief grid.
   A player should be able to spot SCOPE by its shape before reading the word.
   ========================================================================== */

export const ATOM_ICON: Record<Atom, IconName> = {
  SOURCE: 'search',
  NUMBER: 'analytics',
  HEDGE: 'alert',
  SCOPE: 'target',
  CAUSE: 'link',
};

/** Three or four words. Used where the name alone is too terse to act on. */
export const ATOM_SHORT: Record<Atom, string> = {
  SOURCE: 'who says so',
  NUMBER: 'the figure and its base',
  HEDGE: 'may / suggests / preliminary',
  SCOPE: 'who, where, when',
  CAUSE: 'correlational vs. causal',
};
