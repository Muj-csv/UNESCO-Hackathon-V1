import type { TerminalDecision } from '../types/contracts';
import { useGame } from '../state/GameContext';
import { finalText } from '../state/gameReducer';
import StageBar from '../components/StageBar';

/* The last reader. They see only what reached them — no original, no chain.
   Exactly the position anyone is in when something lands in their feed. */

const CHOICES: { id: TerminalDecision; label: string; note: string }[] = [
  { id: 'share', label: 'Share it', note: 'Pass it on as it stands.' },
  { id: 'flag', label: 'Flag it', note: "Something about it doesn't sit right." },
  { id: 'verify', label: 'Check it first', note: 'Find out before doing anything.' },
];

export default function Terminal() {
  const { state, dispatch } = useGame();

  const choose = (decision: TerminalDecision) => {
    dispatch({ type: 'SET_TERMINAL_DECISION', decision });
    /* T4 replaces this for `verify` with the "what would you check first?"
       question. Share and Flag keep behaving exactly as they do now. */
    dispatch({ type: 'ADVANCE' });
  };

  return (
    <div className="screen">
      <StageBar label="It reaches you" />
      <p className="lede">This turned up on your phone. You have not seen anything else about it.</p>

      <div className="paper paper-final">
        <p className="paper-text">{finalText(state)}</p>
      </div>

      <p className="eyebrow">What do you do?</p>
      {CHOICES.map((c) => (
        <button key={c.id} className="lobby-option" onClick={() => choose(c.id)}>
          <span className="lobby-option-name">{c.label}</span>
          <span className="lobby-option-note">{c.note}</span>
        </button>
      ))}
    </div>
  );
}
