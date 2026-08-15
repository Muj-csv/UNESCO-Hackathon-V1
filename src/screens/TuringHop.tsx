import { useEffect } from 'react';
import { useGameState, useGameDispatch } from '../state/GameContext';

/* ============================================================================
   OWNER: T6 (AI participants).

   Skips itself while no hop was taken by a machine.

   T6: "One of these hops was written by a machine. Which one?" Show every
   version, let the room vote, then reveal. Dispatch SET_TURING_GUESS.

   Most rooms cannot tell, and that failure IS the lesson: a summariser's
   output is not distinguishable from a person doing their honest best under
   the same constraint. It is also the only mechanic here that is socially
   fun, because it produces arguing.

   The condition below already works — once round.aiHopIndexes is populated
   the screen stops skipping itself. Keep `from` on any effect that advances.
   ========================================================================== */

export default function TuringHop() {
  const { round } = useGameState();
  const dispatch = useGameDispatch();
  const hasMachineHop = round.aiHopIndexes.length > 0;

  useEffect(() => {
    if (!hasMachineHop) dispatch({ type: 'ADVANCE', from: 'turingHop' });
  }, [hasMachineHop, dispatch]);

  return null;
}
