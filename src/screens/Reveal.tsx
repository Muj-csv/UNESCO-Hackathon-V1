import { useGame } from '../state/GameContext';
import { cardName } from '../data/cards';
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
      <StageBar label="What happened to it" />

      <div className="paper paper-original">
        <p className="eyebrow">What entered play</p>
        <p className="paper-text">{round.claim.originalText}</p>
      </div>

      {shown.map((hop, i) => (
        <div key={i} className={`paper${i === hops.length - 1 ? ' paper-final' : ''}`}>
          <p className="eyebrow">
            Hop {i + 1} · {cardName(hop.cardId)}
            {!settings.blackBox && <> · {hop.isAI ? 'AI participant' : hop.player}</>}
          </p>
          <p className="paper-text">{hop.text}</p>
        </div>
      ))}

      {/* T9 fills this in — reactions as each version lands. */}
      <ReactionBar />

      {!done ? (
        <button
          className="btn btn-primary btn-block"
          onClick={() => dispatch({ type: 'ADVANCE_REVEAL' })}
        >
          {step === 0 ? 'Show the first retelling' : 'Next'}
        </button>
      ) : (
        <button className="btn btn-primary btn-block" onClick={() => dispatch({ type: 'ADVANCE' })}>
          Continue
        </button>
      )}
    </div>
  );
}
