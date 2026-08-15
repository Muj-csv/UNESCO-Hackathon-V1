import { useGame } from '../state/GameContext';
import { hopsForLedger } from '../state/gameReducer';
import { computeLedger, firstLostAtom, lostAtoms } from '../engine/ledger';

/* ============================================================================
   OWNER: T4 (verify before you share).

   Ledger.tsx already composes this on a single line, so T2 can rewrite the
   death rows freely and T4 never opens that file.

   Reads round.verifyChoice and the ledger result, then states what happened
   — the atom the final reader would have checked, and whether this claim had
   already lost it. Four cases: chose the first loss, chose a later loss,
   chose a survivor, nothing was lost.

   Never scores this. No right/wrong marking, no points, no "correct!". State
   what happened and let the player draw the conclusion.
   ========================================================================== */

export default function VerifyFeedback() {
  const { state } = useGame();
  const { round } = state;
  const claim = round.claim;

  if (!claim || round.terminalDecision !== 'verify' || !round.verifyChoice) return null;

  const hops = hopsForLedger(state);
  const result = computeLedger(claim, hops, round.verifications, round.overrides);
  const choice = round.verifyChoice;
  const verdict = result[choice];
  const first = firstLostAtom(result);
  const anyLost = lostAtoms(result).length > 0;

  let message: string;

  if (!anyLost) {
    message = `You would have checked ${choice}. This claim made it through with everything intact.`;
  } else if (!verdict.alive && choice === first) {
    message = `You would have checked ${choice} first. ${choice} was the first thing this claim lost.`;
  } else if (!verdict.alive) {
    message = `You would have checked ${choice}. ${choice} did go, at hop ${
      (verdict.deathHop ?? 0) + 1
    } — though ${first} went first.`;
  } else {
    message = `You would have checked ${choice}. ${choice} actually made it through intact. ${first} was the one that went.`;
  }

  return <p className="muted">{message}</p>;
}
