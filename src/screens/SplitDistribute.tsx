import { useState } from 'react';
import { useGame } from '../state/GameContext';
import StageBar from '../components/StageBar';

/* ============================================================================
   CROWD RECALL — handing out the pieces.

   Every player gets a different version of the same claim, each missing one
   property, and NOBODY IS TOLD THEIRS WAS ALTERED. Saying so would give the
   game away and destroy the lesson: the group cannot recover what nobody in
   the room is holding.

   There is deliberately no traitor in this mode. Never add one.
   ========================================================================== */

export default function SplitDistribute() {
  const { state, dispatch } = useGame();
  const assignments = state.round.splitAssignments;
  const [at, setAt] = useState(0);
  const [reading, setReading] = useState(false);

  if (!assignments.length) return null;
  const current = assignments[at];
  const last = at >= assignments.length - 1;

  return (
    <div className="screen">
      <StageBar label={`Reading ${at + 1} of ${assignments.length}`} />

      {!reading ? (
        <div className="handoff">
          <p className="eyebrow">Pass the device to</p>
          <h1>{current.player}</h1>
          <p className="muted">Read it once. Don't show anyone, and don't write anything down.</p>
          <button className="btn btn-primary btn-block" onClick={() => setReading(true)}>
            I'm {current.player}
          </button>
        </div>
      ) : (
        <>
          <p className="lede">Read this once, then pass it on. You'll rebuild it together after.</p>
          <div className="paper paper-original">
            <p className="paper-text">{current.text}</p>
          </div>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              if (last) {
                dispatch({ type: 'ADVANCE' });
              } else {
                setAt(at + 1);
                setReading(false);
              }
            }}
          >
            {last ? "Everyone's read it" : 'Done — pass it on'}
          </button>
        </>
      )}
    </div>
  );
}
