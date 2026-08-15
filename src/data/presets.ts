import type { CardId, ConstraintSet, ConstraintSetId, Preset } from '../types/contracts';
/* `.js` deliberately — see the note on the imports in src/state/gameReducer.ts.
   This module is reached from api/room.ts and Node resolves it at runtime. */
import { ALL_CARD_IDS } from './cards.js';

/* ============================================================================
   Pressure environments.

   A preset is a room to write in: which pressures are in the deck, how long
   the chain is, how long the clock runs.

   The prototype's standard preset claimed all six cards and then filtered the
   deck down to two, so four cards never appeared. Constraint sets are now the
   single source of truth for which cards are dealt, and nothing filters them
   again downstream.
   ========================================================================== */

export const CONSTRAINT_SETS: Record<ConstraintSetId, ConstraintSet> = {
  all: {
    id: 'all',
    name: 'All six',
    note: 'The mixed pressure of an ordinary day.',
    cards: ALL_CARD_IDS,
  },

  compression: {
    id: 'compression',
    name: 'Compression',
    note: 'Everything has to be shorter than it was.',
    cards: ['chars', 'headline', 'secs'],
  },

  engagement: {
    id: 'engagement',
    name: 'Engagement',
    note: 'Everything has to perform.',
    cards: ['land', 'audience', 'certain'],
  },

  speed: {
    id: 'speed',
    name: 'Speed',
    note: 'Everything has to be now.',
    cards: ['secs', 'chars', 'certain'],
  },
};

export const PRESETS: Preset[] = [
  {
    id: 'standard',
    name: 'Standard',
    note: 'Every card in the deck. Start here.',
    constraintSet: 'all',
    chainLength: 5,
    timerSeconds: 60,
    aiHops: 1,
    verifyBudget: 1,
    blackBox: false,
  },
  {
    id: 'groupchat',
    name: 'Group Chat',
    note: 'Short, fast, and already moving on.',
    constraintSet: 'compression',
    chainLength: 5,
    timerSeconds: 40,
    aiHops: 1,
    verifyBudget: 1,
    blackBox: false,
  },
  {
    id: 'feed',
    name: 'The Feed',
    note: 'Nothing travels unless it performs.',
    constraintSet: 'engagement',
    chainLength: 5,
    timerSeconds: 45,
    aiHops: 1,
    verifyBudget: 1,
    blackBox: false,
  },
  {
    id: 'deadline',
    name: 'Deadline',
    note: 'It ships now, at the length it has to be.',
    constraintSet: 'speed',
    chainLength: 5,
    timerSeconds: 35,
    aiHops: 1,
    verifyBudget: 0,
    blackBox: false,
  },
  {
    id: 'blackbox',
    name: 'Black Box',
    note: 'Nobody sees who wrote what until the end.',
    constraintSet: 'all',
    chainLength: 6,
    timerSeconds: 60,
    aiHops: 1,
    verifyBudget: 1,
    blackBox: true,
  },
];

export const DEFAULT_PRESET_ID = 'standard';

export function getPreset(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

/** The cards a preset actually deals. Resolved once, never filtered again. */
export function cardsForPreset(preset: Preset): CardId[] {
  return CONSTRAINT_SETS[preset.constraintSet].cards;
}
