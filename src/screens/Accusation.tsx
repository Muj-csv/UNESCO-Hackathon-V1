import { useEffect } from 'react';
import { useGameState, useGameDispatch } from '../state/GameContext';

/* ============================================================================
   OWNER: T8 (BAD FAITH).

   Skips itself unless the round actually had an imposter. CHAIN and CROWD
   RECALL never reach it, and CROWD RECALL must never gain one — its whole
   lesson requires the absence of a traitor.

   T8: show every hop with its author, let the room argue with no countdown,
   then vote. Dispatch CAST_ACCUSATION, then REVEAL_ROLES.

   No points for a correct vote. The room does not "beat" the imposter — the
   ledger is still the payoff, and it is about to show that the saboteur killed
   one property on purpose while the honest players killed three by accident.

   The condition below already works: populate round.imposter and this screen
   stops skipping. Keep `from` on any effect that advances.
   ========================================================================== */

export default function Accusation() {
  const { round } = useGameState();
  const dispatch = useGameDispatch();
  const hasImposter = round.imposter !== null;

  useEffect(() => {
    if (!hasImposter) dispatch({ type: 'ADVANCE', from: 'accusation' });
  }, [hasImposter, dispatch]);

  return null;
}
