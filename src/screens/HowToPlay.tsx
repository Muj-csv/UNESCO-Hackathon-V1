import { useGameDispatch } from '../state/GameContext';
import StageBar from '../components/StageBar';

/* ============================================================================
   OWNER: T3 (onboarding).

   Placeholder. Reached from the lobby on request, not on the way into a round.

   T3: four beats, under 90 seconds to read — what happens, the five atoms,
   the one rule (*always try to be accurate*), and a sample ledger row.
   ========================================================================== */

export default function HowToPlay() {
  const dispatch = useGameDispatch();
  return (
    <div className="screen">
      <StageBar label="How to play" note="" />
      <h2>How to play</h2>
      <p className="lede">
        A true claim goes round the room. Each person rewrites it under a pressure, and only sees
        the version before theirs. At the end you find out what it cost.
      </p>
      <p className="muted">
        The one rule: <strong>always try to be accurate.</strong> No card ever asks you to do
        otherwise.
      </p>
      <button className="btn btn-primary btn-block" onClick={() => dispatch({ type: 'GO_TO', screen: 'lobby' })}>
        Back to the lobby
      </button>
    </div>
  );
}
