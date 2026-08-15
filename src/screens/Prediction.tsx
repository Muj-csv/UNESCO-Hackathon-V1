import { useEffect } from 'react';
import { useGameDispatch } from '../state/GameContext';
import PredictionPrompt from '../components/PredictionPrompt';

/* ============================================================================
   OWNER: T9 (prediction stake).

   Skips itself until the feature exists. Registered in the route from day one
   so T9 never has to touch routing.

   T9: drop the self-skip effect, collect a prediction from every player, then
   dispatch ADVANCE from a button. If you keep any effect that advances, pass
   `from: 'prediction'` — StrictMode runs effects twice and an unguarded
   ADVANCE steps two screens.
   ========================================================================== */

export default function Prediction() {
  const dispatch = useGameDispatch();

  useEffect(() => {
    dispatch({ type: 'ADVANCE', from: 'prediction' });
  }, [dispatch]);

  return <PredictionPrompt />;
}
