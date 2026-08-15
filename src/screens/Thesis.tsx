import { useGameDispatch } from '../state/GameContext';
import StageBar from '../components/StageBar';

/* ============================================================================
   OWNER: T3 (thesis screen).

   Placeholder. This is the one moment the whole design exists to produce, and
   it should be built deliberately rather than grown out of a stub.

   T3: three elements, nothing more.
     1. the original claim in .paper, labelled "What entered play"
     2. the final version in .paper, labelled "What came out"
     3. one line in --font-display, large:
          Every player was told to be accurate. Nobody lied.
   Then one button: "See what it cost" → ledger.

   Keep it nearly empty. No stats, no recap, no atom counts — the ledger does
   all of that next. It has to hold on screen for two silent seconds and still
   land, because the pitch video is built on this shot.

   T8 supplies the BAD FAITH variant:
     One player was told to distort. Here's how little difference it made.
   ========================================================================== */

export default function Thesis() {
  const dispatch = useGameDispatch();
  return (
    <div className="screen">
      <StageBar label="Before the ledger" />
      <h2>The thesis</h2>
      <p className="muted">Not built yet — T3 fills this in.</p>
      <button className="btn btn-primary btn-block" onClick={() => dispatch({ type: 'ADVANCE' })}>
        See what it cost
      </button>
    </div>
  );
}
