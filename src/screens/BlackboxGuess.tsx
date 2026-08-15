import { useEffect, useState } from 'react';
import { useGame } from '../state/GameContext';
import { cardName } from '../data/cards';
import Icon from '../components/Icon';
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
      <StageBar label="Black box" note={revealed ? 'Revealed' : 'Authors hidden'} />

      <div className="verdict-banner">
        <span className="verdict-banner-mark" aria-hidden="true">
          <Icon name="search" size={26} />
        </span>
        <div>
          <h2>Who wrote which one?</h2>
          <p className="muted">Say it out loud before anyone taps anything.</p>
        </div>
      </div>

      <div className="chain">
        {round.hops.map((hop, i) => (
          <article
            key={i}
            className={`chainblock${revealed && hop.isAI ? ' is-machine' : ''}`}
          >
            <header className="chainblock-head">
              <span className="chainblock-n">{String(i + 1).padStart(2, '0')}</span>
              <span className="chainblock-card">{cardName(hop.cardId)}</span>
              {revealed && (
                <span className="chainblock-who">{hop.isAI ? 'AI participant' : hop.player}</span>
              )}
            </header>
            <p className="paper-text">{hop.text}</p>
          </article>
        ))}
      </div>

      {!revealed ? (
        <button className="btn btn-primary btn-lg btn-block" onClick={() => setRevealed(true)}>
          Show who wrote what
        </button>
      ) : (
        <button
          className="btn btn-primary btn-lg btn-block"
          onClick={() => dispatch({ type: 'ADVANCE' })}
        >
          Continue <Icon name="arrowForward" />
        </button>
      )}
    </div>
  );
}
