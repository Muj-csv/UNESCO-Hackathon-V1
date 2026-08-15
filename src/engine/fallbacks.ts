import type { CardId } from '../types/contracts';

/* ============================================================================
   Pre-generated rewrites, one per shipped claim per card.

   The room must never see an error at the emotional peak of a round. When the
   proxy times out, errors, rate-limits, runs out of budget or has no key at
   all, the machine's turn takes one of these instead and the chain continues
   with nobody the wiser.

   Every line here obeys the same rule the live model is held to: it may only
   compress or rephrase the claim it was given. No new facts, entities, names
   or numbers — every figure below appears in the claim it belongs to, and the
   tests assert it.

   These are NOT written to be careful. Under SOUND CERTAIN the hedge goes;
   under 90 CHARACTERS the source goes; under YOUR AUDIENCE BELIEVES… the
   scope narrows to the reader. That is the finding, not a bug: a summariser
   under a real pressure drops the same properties a person does, and the
   ledger audits it exactly as it audits everyone else.
   ========================================================================== */

/** Keyed by claim id, then card id. */
export type FallbackTable = Record<string, Partial<Record<CardId, string>>>;

export const FALLBACKS: FallbackTable = {
  'rainfall-alerts': {
    chars: 'Heavier upstream rain linked to a 15% rise in Malaya basin flood alerts.',
    headline: 'Upstream Rainfall Linked To 15 Percent Rise In Malaya Basin Flood Alerts',
    land: 'Flood alerts across the Malaya river basin are up 15 percent after heavier upstream rainfall — 40 last October, 46 this year.',
    secs: 'San Ramil bureau: heavier upstream rain, 15 percent more flood alerts in the Malaya basin.',
    audience:
      'For anyone living downstream in the Malaya basin: heavier upstream rainfall comes with 15 percent more flood alerts.',
    certain:
      'The San Ramil Weather Bureau confirms heavier upstream rainfall is driving a 15 percent rise in flood alerts across the Malaya river basin.',
  },

  'class-start-times': {
    chars: 'Later class start times linked to a 12-point rise in morning attendance.',
    headline: 'Later Class Start Times Linked To 12-Point Rise In Morning Attendance',
    land: 'Push class start times later and morning attendance climbs 12 points — 61 percent to 73 percent.',
    secs: 'Bulwagan State College study: later start times, morning attendance up from 61 to 73 percent.',
    audience:
      'If you have ever argued for later classes: attendance rose 12 points when Bulwagan State College pushed them back.',
    certain:
      'A study of 240 students at Bulwagan State College shows later class start times raise morning attendance by 12 points.',
  },

  'evening-phone-sleep': {
    chars: 'Evening phone use linked to a 9-point drop in student sleep quality.',
    headline: 'Evening Phone Use Linked To 9-Point Drop In Student Sleep Quality',
    land: 'Students on their phones late reported sleep quality 9 points lower — 54 percent down to 45.',
    secs: 'Perpetua City survey: heavier evening phone use, sleep quality down 9 points among senior high students.',
    audience:
      'You already suspected this: heavier evening phone use goes with a 9-point drop in how well students say they sleep.',
    certain:
      'A survey of 180 senior high students by the Perpetua City Youth Research Circle shows heavier evening phone use lowers sleep quality by 9 points.',
  },

  'bus-lane-travel-times': {
    chars: 'New Rosal Avenue bus lane linked to an 8% fall in morning travel times.',
    headline: 'New Bus Lane Linked To 8 Percent Fall In Rosal Avenue Travel Times',
    land: 'Morning trips along Rosal Avenue are 8 percent quicker since the bus lane went in — 34 minutes down to 31.',
    secs: 'Villareal transport office: new bus lane, morning travel on Rosal Avenue down from 34 minutes to 31.',
    audience:
      'For anyone stuck on Rosal Avenue every morning: the new bus lane comes with an 8 percent fall in travel times.',
    certain:
      'The Villareal City Transport Office reports the new bus lane has cut morning travel times along Rosal Avenue by 8 percent.',
  },
};

/**
 * A pre-generated rewrite, or null when there is none.
 * A null here means the caller should pass the previous text through
 * unchanged rather than showing anything resembling an error.
 */
export function fallbackFor(claimId: string, cardId: CardId | null): string | null {
  if (!cardId) return null;
  return FALLBACKS[claimId]?.[cardId] ?? null;
}
