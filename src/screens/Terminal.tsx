import { useState } from 'react';
import type { Atom, TerminalDecision } from '../types/contracts';
import { useGame } from '../state/GameContext';
import { finalText } from '../state/gameReducer';
import { ATOM_ICON } from '../data/atoms';
import Icon from '../components/Icon';
import type { IconName } from '../components/Icon';
import StageBar from '../components/StageBar';

/* The last reader. They see only what reached them — no original, no chain.
   Exactly the position anyone is in when something lands in their feed. */

const CHOICES: { id: TerminalDecision; label: string; note: string; icon: IconName; tone: string }[] = [
  { id: 'share', label: 'Share it', note: 'Pass it on as it stands.', icon: 'send', tone: 'share' },
  {
    id: 'flag',
    label: 'Flag it',
    note: "Something about it doesn't sit right.",
    icon: 'alert',
    tone: 'flag',
  },
  {
    id: 'verify',
    label: 'Check it first',
    note: 'Find out before doing anything.',
    icon: 'search',
    tone: 'verify',
  },
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
  const [picked, setPicked] = useState<Atom | null>(null);

  const choose = (decision: TerminalDecision) => {
    dispatch({ type: 'SET_TERMINAL_DECISION', decision });
    if (decision === 'verify') {
      setAsking(true);
      return;
    }
    dispatch({ type: 'ADVANCE' });
  };

  /* BBB-008: picking an atom used to dispatch and advance in the same breath,
     so the only response to the tap was the screen changing to something else.
     The consequence still belongs in the ledger — it needs the whole chain to
     be meaningful — but the choice deserves an answer where it is made.

     What this must NOT do is say whether the pick was a good one. The reveal
     has not happened yet, and "SOURCE was the first thing this claim lost"
     here would answer the ledger's payoff several screens early. So it repeats
     the choice back and promises the answer, and nothing more. */
  const chooseAtom = (atom: Atom) => {
    dispatch({ type: 'SET_VERIFY_CHOICE', atom });
    setPicked(atom);
  };

  return (
    <div className="screen">
      <StageBar label="It reaches you" note="No chain, no original" />

      <p className="lede">This turned up on your phone. You have not seen anything else about it.</p>

      {/* The version that reached the end, alone on the screen — because that
          is all a real reader ever gets. */}
      <div className="paper paper-final terminal-claim">
        <p className="paper-text">{finalText(state)}</p>
      </div>

      {picked ? (
        <section className="neo-panel">
          <div className="neo-head neo-head-plain">
            Noted
            <span className="neo-tag">Your check</span>
          </div>
          <div className="neo-body stack">
            <p className="lede">
              You'd ask{' '}
              <strong>
                {VERIFY_QUESTIONS.find((q) => q.atom === picked)?.label.toLowerCase()}
              </strong>
            </p>
            <p className="muted">
              Hold on to that. The ledger at the end will show you what happened to {picked} on the
              way here — and whether asking would have caught it.
            </p>
            <button
              className="btn btn-primary btn-lg btn-block"
              onClick={() => dispatch({ type: 'ADVANCE' })}
            >
              See what happened <Icon name="arrowForward" />
            </button>
          </div>
        </section>
      ) : asking ? (
        <>
          <p className="eyebrow">You chose to check it first. What would you check?</p>
          <div className="atomgrid">
            {VERIFY_QUESTIONS.map((q) => (
              <button
                key={q.atom}
                type="button"
                className="atomcard"
                onClick={() => chooseAtom(q.atom)}
              >
                <span className={`atomcard-icon atomcard-${q.atom.toLowerCase()}`}>
                  <Icon name={ATOM_ICON[q.atom]} size={22} />
                </span>
                <span className="atomcard-name">{q.atom}</span>
                <span className="atomcard-note">{q.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="eyebrow">What do you do?</p>
          <div className="decisiongrid">
            {CHOICES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`decisioncard decisioncard-${c.tone}`}
                onClick={() => choose(c.id)}
              >
                <span className="decisioncard-icon">
                  <Icon name={c.icon} size={26} />
                </span>
                <span className="decisioncard-label">{c.label}</span>
                <span className="decisioncard-note">{c.note}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
