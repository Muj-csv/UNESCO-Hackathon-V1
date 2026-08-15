import { useState } from 'react';
import { useGame } from '../state/GameContext';
import StageBar from '../components/StageBar';

/* CROWD RECALL — rebuilding it together.

   One device, one text box, everybody talking. What the group cannot put back
   is the point: the person holding the version missing that property had no
   way to supply it, and nobody in the room did anything wrong. */

export default function SplitReconstruct() {
  const { state, dispatch } = useGame();
  const [draft, setDraft] = useState(state.round.splitReconstruction);

  return (
    <div className="screen">
      <StageBar label="Put it back together" />
      <p className="lede">
        Between you, you read the whole thing. Write down the claim as accurately as the room can
        manage.
      </p>

      <div className="stack">
        <label className="field-label" htmlFor="reconstruction">
          The room's version
        </label>
        <textarea
          id="reconstruction"
          className="field split-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say it out loud first, then write what you agree on."
          spellCheck={false}
        />
      </div>

      <button
        className="btn btn-primary btn-block"
        disabled={!draft.trim()}
        onClick={() => {
          dispatch({ type: 'SET_SPLIT_RECONSTRUCTION', text: draft.trim() });
          dispatch({ type: 'ADVANCE' });
        }}
      >
        This is what we've got
      </button>
    </div>
  );
}
