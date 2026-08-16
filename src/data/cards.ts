import type { CardId, ConstraintCard } from '../types/contracts';

/* ============================================================================
   The six constraint cards.

   Each names a real pressure a person actually writes under. NONE of them
   instructs a player to distort anything, and none of them uses the word
   "lie". That restraint is the whole design — if a card told someone to
   mislead, the round would prove nothing about how true information decays.

   `targets` records which atoms a pressure tends to endanger. It is used for
   dealing a varied chain. It is never used to score anyone.
   ========================================================================== */

export const CARDS: Record<CardId, ConstraintCard> = {
  chars: {
    id: 'chars',
    name: '90 Characters',
    note: 'It has to fit in one short message.',
    targets: ['SOURCE', 'HEDGE', 'SCOPE'],
    input: 'redact',
    charLimit: 90,
  },

  headline: {
    id: 'headline',
    name: 'Headline Only',
    note: 'Cut it back to the one line that would sit at the top of a page.',
    targets: ['SOURCE', 'HEDGE', 'CAUSE'],
    input: 'redact',
  },

  land: {
    id: 'land',
    name: 'Make It Land',
    note: 'Make it worth reading. Someone should want to pass it on.',
    targets: ['NUMBER', 'HEDGE', 'SCOPE'],
    input: 'free',
  },

  secs: {
    id: 'secs',
    name: '25 Seconds',
    note: 'The clock is short. Send what you have when it runs out.',
    targets: ['SOURCE', 'NUMBER', 'SCOPE'],
    input: 'redact',
    /* The prototype named this pressure and never changed the clock. */
    timerOverride: 25,
  },

  audience: {
    id: 'audience',
    name: 'Your Audience Believes…',
    note: 'The people reading this already have a view on it. Write it for them.',
    targets: ['HEDGE', 'SCOPE', 'CAUSE'],
    input: 'free',
  },

  certain: {
    id: 'certain',
    name: 'Sound Certain',
    note: 'No wobble. Write it the way someone who is sure would write it.',
    targets: ['HEDGE', 'CAUSE'],
    input: 'free',
  },
};

export const ALL_CARD_IDS: CardId[] = ['chars', 'headline', 'land', 'secs', 'audience', 'certain'];

export const CARD_LIST: ConstraintCard[] = ALL_CARD_IDS.map((id) => CARDS[id]);

export function getCard(id: CardId | null): ConstraintCard | null {
  return id ? (CARDS[id] ?? null) : null;
}

/** Display name for a card, or a neutral label when a hop had no card. */
export function cardName(id: CardId | null): string {
  return getCard(id)?.name ?? 'No card';
}
