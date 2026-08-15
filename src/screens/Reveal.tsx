import { useGame } from '../state/GameContext';
import { cardName } from '../data/cards';
import Icon from '../components/Icon';
import StageBar from '../components/StageBar';
import ReactionBar from '../components/ReactionBar';

/* The chain, one version at a time. Watching it arrive in order is what makes
   the loss legible — a diff would show the same thing and land for nobody. */

export default function Reveal() {
  const { state, dispatch } = useGame();
  const { round, settings } = state;
  const hops = round.hops;
  const step = round.revealStep;
  const shown = hops.slice(0, step);
  const done = step >= hops.length;

  if (!round.claim) return null;

  return (
    <div className="screen">
      <StageBar label="What happened to it" note={`${step} of ${hops.length} shown`} />

      <div className="paper paper-original">
        <p className="eyebrow">What entered play</p>
        <p className="paper-text">{round.claim.originalText}</p>
      </div>

      <div className="chain">
        {shown.map((hop, i) => (
          <article
            key={i}
            className={`chainblock${i === hops.length - 1 ? ' is-final' : ''}${
              hop.isAI ? ' is-machine' : ''
            }`}
          >
            <header className="chainblock-head">
              <span className="chainblock-n">{String(i + 1).padStart(2, '0')}</span>
              <span className="chainblock-card">{cardName(hop.cardId)}</span>
              {/* Black box holds the authors back until the guessing beat. */}
              {!settings.blackBox && (
                <span className="chainblock-who">{hop.isAI ? 'AI participant' : hop.player}</span>
              )}
            </header>
            <p className="paper-text">{hop.text}</p>
          </article>
        ))}
      </div>

      {/* T9 — reactions as each version lands. */}
      <ReactionBar />

      {!done ? (
        <button
          className="btn btn-primary btn-lg btn-block"
          onClick={() => dispatch({ type: 'ADVANCE_REVEAL' })}
        >
          {step === 0 ? 'Show the first retelling' : 'Next'}
          <Icon name="arrowForward" />
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
