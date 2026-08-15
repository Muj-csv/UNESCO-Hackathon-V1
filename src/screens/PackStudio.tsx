import { useGameDispatch } from '../state/GameContext';
import StageBar from '../components/StageBar';

/* ============================================================================
   OWNER: T10 (pack authoring).

   Placeholder. Reached from the lobby, not from the round route.

   T10: one claim at a time — original text, the five atoms tagged by selecting
   text rather than retyping, and five degraded variants. Validate with
   readable errors, then share by URL FRAGMENT (#pack=...) so claim text never
   reaches the server.

   This is where the theme stops being a metaphor: young people stop being the
   audience for an MIL tool and become the authors of one.

   Do not use AI to generate claims. The authoring is the learning.
   ========================================================================== */

export default function PackStudio() {
  const dispatch = useGameDispatch();
  return (
    <div className="screen">
      <StageBar label="Pack Studio" note="" />
      <h2>Write your own claim</h2>
      <p className="muted">Not built yet — T10 fills this in.</p>
      <button
        className="btn btn-primary btn-block"
        onClick={() => dispatch({ type: 'GO_TO', screen: 'lobby' })}
      >
        Back to the lobby
      </button>
    </div>
  );
}
