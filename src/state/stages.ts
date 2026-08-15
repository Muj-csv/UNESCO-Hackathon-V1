import type { Mode, ScreenId } from '../types/contracts';

/* ============================================================================
   Stages — what the shell shows instead of free navigation.

   The route in gameReducer.ts is a list of SCREENS. A player does not think
   in screens: `reveal`, `blackboxGuess`, `turingHop` and `accusation` are one
   beat to them ("we're looking at what happened"), and `thesis` + `ledger`
   are another. So the rail groups screens into the handful of stages a room
   would actually name out loud.

   Pure derivation, no state. The rail cannot navigate anywhere — it reports
   where the room is, which is the whole reason a linear game can wear a
   dashboard chrome without the chrome breaking it.
   ========================================================================== */

export interface Stage {
  id: string;
  /** Shown in the rail and, uppercased, as the top bar's badge. */
  label: string;
  /** Every screen that belongs to this beat, in route order. */
  screens: ScreenId[];
}

/* The screens that are not part of playing a round. Reaching one of these
   means the rail steps aside and the sidebar offers navigation instead. */
const OUT_OF_PLAY: ScreenId[] = ['lobby', 'joinRoom', 'howToPlay', 'packStudio'];

export const CHAIN_STAGES: Stage[] = [
  { id: 'brief', label: 'Brief', screens: ['brief'] },
  { id: 'predict', label: 'Call it', screens: ['prediction'] },
  { id: 'chain', label: 'The chain', screens: ['round'] },
  { id: 'terminal', label: 'It reaches you', screens: ['terminal'] },
  {
    id: 'reveal',
    label: 'What happened',
    screens: ['reveal', 'blackboxGuess', 'turingHop', 'accusation'],
  },
  { id: 'ledger', label: 'Decay ledger', screens: ['thesis', 'ledger'] },
  { id: 'debrief', label: 'Debrief', screens: ['debrief', 'superlatives', 'sessionReadout'] },
];

/* CROWD RECALL has no chain, no terminal reader and no villain — so it has
   no hop rail, no "it reaches you", and never an accusation beat. */
export const CROWD_STAGES: Stage[] = [
  { id: 'brief', label: 'Brief', screens: ['brief'] },
  { id: 'read', label: 'Read your piece', screens: ['splitDistribute'] },
  { id: 'rebuild', label: 'Rebuild it', screens: ['splitReconstruct'] },
  { id: 'ledger', label: 'Decay ledger', screens: ['thesis', 'ledger'] },
  { id: 'debrief', label: 'Debrief', screens: ['debrief', 'superlatives', 'sessionReadout'] },
];

export function stagesFor(mode: Mode): Stage[] {
  return mode === 'crowd' ? CROWD_STAGES : CHAIN_STAGES;
}

/** Whether the room is mid-round, and the shell should stop offering exits. */
export function isInPlay(screen: ScreenId): boolean {
  return !OUT_OF_PLAY.includes(screen);
}

/** Index of the stage this screen belongs to, or -1 when out of play. */
export function activeStageIndex(stages: Stage[], screen: ScreenId): number {
  return stages.findIndex((stage) => stage.screens.includes(screen));
}

/**
 * The short label for the top bar.
 *
 * Out-of-play screens name themselves; in-play screens borrow their stage's
 * label, so the badge and the rail never disagree about what beat this is.
 */
export function badgeFor(mode: Mode, screen: ScreenId): string | null {
  if (screen === 'lobby') return null;
  if (screen === 'joinRoom') return 'Room';
  if (screen === 'howToPlay') return 'How to play';
  if (screen === 'packStudio') return 'Pack Studio';

  const stages = stagesFor(mode);
  const at = activeStageIndex(stages, screen);
  return at < 0 ? null : stages[at].label;
}
