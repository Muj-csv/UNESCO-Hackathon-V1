import { useGameDispatch } from '../state/GameContext';
import StageBar from '../components/StageBar';

/* ============================================================================
   OWNER: T3 (pre-hop brief).

   Placeholder. It advances on a tap so a round is playable, but it does not
   yet do the job.

   T3 still owns all of this:
   - the ~30 second brief that says the card is a PRESSURE, not an instruction
     to distort, and that the next player will not see the original
   - showing it once per session (state.briefSeen exists and nothing sets it)
   - making it unskippable on first run
   - a per-player variant slot, so T8 can hand one player a different brief
     without restructuring the screen

   A learner who misunderstands that the card is a pressure takes the wrong
   lesson from the entire session, so this screen gates everything after it.
   ========================================================================== */

export default function Brief() {
  const dispatch = useGameDispatch();
  return (
    <div className="screen">
      <StageBar label="Before you start" />
      <h2>The brief</h2>
      <p className="muted">Not built yet — T3 fills this in.</p>
      <button className="btn btn-primary btn-block" onClick={() => dispatch({ type: 'ADVANCE' })}>
        Continue
      </button>
    </div>
  );
}
