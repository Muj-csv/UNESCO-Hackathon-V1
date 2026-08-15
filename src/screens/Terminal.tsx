import { useState } from 'react';
import type { Atom, TerminalDecision } from '../types/contracts';
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

/* T4 — worded as a person would actually ask it, not as the atom's name.
   This is the takeaway a player leaves with. */
const VERIFY_QUESTIONS: { atom: Atom; label: string }[] = [
  { atom: 'SOURCE', label: 'Who is the source?' },
  { atom: 'NUMBER', label: 'What is the number, and out of what?' },
  { atom: 'HEDGE', label: 'How certain is the evidence?' },
  { atom: 'SCOPE', label: 'Who, where, and when does this apply to?' },
  { atom: 'CAUSE', label: 'Is this correlation, or causation?' },
];

export default function Terminal() {
  const { state, dispatch } = useGame();
  const [asking, setAsking] = useState(false);

  const choose = (decision: TerminalDecision) => {
    dispatch({ type: 'SET_TERMINAL_DECISION', decision });
    if (decision === 'verify') {
      setAsking(true);
      return;
    }
    dispatch({ type: 'ADVANCE' });
  };

  const chooseAtom = (atom: Atom) => {
    dispatch({ type: 'SET_VERIFY_CHOICE', atom });
    dispatch({ type: 'ADVANCE' });
  };

  return (
    <div className="screen">
      <StageBar label="It reaches you" />
      <p className="lede">This turned up on your phone. You have not seen anything else about it.</p>

      <div className="paper paper-final">
        <p className="paper-text">{finalText(state)}</p>
      </div>

      {asking ? (
        <>
          <p className="eyebrow">You chose to check it first. What would you check?</p>
          {VERIFY_QUESTIONS.map((q) => (
            <button key={q.atom} className="lobby-option" onClick={() => chooseAtom(q.atom)}>
              <span className="lobby-option-name">{q.label}</span>
            </button>
          ))}
        </>
      ) : (
        <>
          <p className="eyebrow">What do you do?</p>
          {CHOICES.map((c) => (
            <button key={c.id} className="lobby-option" onClick={() => choose(c.id)}>
              <span className="lobby-option-name">{c.label}</span>
              <span className="lobby-option-note">{c.note}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
