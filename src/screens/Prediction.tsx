import { useEffect } from 'react';
import { useGame } from '../state/GameContext';
import PredictionPrompt from '../components/PredictionPrompt';

/* ============================================================================
   OWNER: T9 (prediction stake).

   Only self-skips when there's nobody to ask — an empty lobby shouldn't be
   reachable in real play, but the route still has to survive it rather than
   stall on a screen with no player to hand off to.
   ========================================================================== */

export default function Prediction() {
  const { state, dispatch } = useGame();
  const hasPlayers = state.players.length > 0;

  useEffect(() => {
    if (!hasPlayers) dispatch({ type: 'ADVANCE', from: 'prediction' });
  }, [hasPlayers, dispatch]);

  if (!hasPlayers) return null;

  return <PredictionPrompt />;
}
