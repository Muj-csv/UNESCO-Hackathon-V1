import { useEffect, useState } from 'react';
import { useGame } from '../state/GameContext';
import { cardName } from '../data/cards';
import StageBar from '../components/StageBar';

/* Only reached when the room played with authors hidden. The room argues about
   who wrote which version before anything is confirmed.

   Nothing here is scored. The arguing is the point — it is the room reasoning
   about evidence, which is the same skill the ledger is about to name. */

export default function BlackboxGuess() {
  const { state, dispatch } = useGame();
  const { round, settings } = state;
  const [revealed, setRevealed] = useState(false);

  /* Self-skip: this beat only exists when the room hid the authors.
     `from` keeps StrictMode's second effect run from stepping twice. */
  useEffect(() => {
    if (!settings.blackBox) dispatch({ type: 'ADVANCE', from: 'blackboxGuess' });
  }, [settings.blackBox, dispatch]);

  if (!settings.blackBox || !round.claim) return null;

  return (
    <div className="screen">
      <StageBar label="Black box" />
      <p className="lede">Who wrote which one? Say it out loud before anyone taps anything.</p>

      {round.hops.map((hop, i) => (
        <div key={i} className="paper">
          <p className="eyebrow">
            Hop {i + 1} · {cardName(hop.cardId)}
            {revealed && <> · {hop.isAI ? 'AI participant' : hop.player}</>}
          </p>
          <p className="paper-text">{hop.text}</p>
        </div>
      ))}

      {!revealed ? (
        <button className="btn btn-primary btn-block" onClick={() => setRevealed(true)}>
          Show who wrote what
        </button>
      ) : (
        <button className="btn btn-primary btn-block" onClick={() => dispatch({ type: 'ADVANCE' })}>
          Continue
        </button>
      )}
    </div>
  );
}
