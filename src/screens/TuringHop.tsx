import { useEffect } from 'react';
import { useGame } from '../state/GameContext';
import { cardName } from '../data/cards';
import StageBar from '../components/StageBar';

/* ============================================================================
   The Turing Hop.

   One of these was written by a machine. Which one?

   Most rooms cannot tell, and that failure is the lesson: a summariser's
   output is not distinguishable from a person doing their honest best under
   the same constraint. So nothing here is scored, nobody wins by finding it,
   and a room that guesses wrong is shown the same screen as a room that
   guesses right — because being wrong is the more common and more useful
   result, and treating it as a loss would teach the opposite.

   It is also the only beat in this design that is socially fun, because it
   produces arguing. The vote is deliberately one tap with no timer on it.
   ========================================================================== */

export default function TuringHop() {
  const { state, dispatch } = useGame();
  const { round, settings } = state;
  const hasMachineHop = round.aiHopIndexes.length > 0;
  const guess = round.turingGuess;

  /* No machine took a turn — nothing to ask. `from` keeps StrictMode's second
     effect run from stepping two screens. */
  useEffect(() => {
    if (!hasMachineHop) dispatch({ type: 'ADVANCE', from: 'turingHop' });
  }, [hasMachineHop, dispatch]);

  if (!hasMachineHop || !round.claim) return null;

  const voted = guess !== null;
  const found = voted && round.aiHopIndexes.includes(guess);

  return (
    <div className="screen">
      <StageBar label="One of these was a machine" />

      {!voted ? (
        <>
          <h2>Which one was the machine?</h2>
          <p className="muted">
            Say it out loud and argue about it first. There is no score on this — and no timer.
          </p>
        </>
      ) : (
        <>
          <h2>{found ? 'That was the machine.' : 'That one was a person.'}</h2>
          <p className="muted">
            {found
              ? 'Most rooms cannot pick it out. Whatever gave it away here, it was not the machine being careless.'
              : `The machine wrote ${machineLabel(round.aiHopIndexes)}. It was doing the same job as everyone else, under the same card.`}
          </p>
        </>
      )}

      {round.hops.map((hop, i) => {
        const isMachine = round.aiHopIndexes.includes(i);
        const picked = guess === i;

        return (
          <button
            key={i}
            type="button"
            className={`paper turing-option${picked ? ' is-picked' : ''}${
              voted && isMachine ? ' is-machine' : ''
            }`}
            disabled={voted}
            aria-pressed={picked}
            onClick={() => dispatch({ type: 'SET_TURING_GUESS', hopIndex: i })}
          >
            <span className="eyebrow">
              Hop {i + 1} · {cardName(hop.cardId)}
              {/* Authors stay hidden until the vote, black box or not — the
                  question is about the writing, not about who was holding
                  the device. */}
              {voted && <> · {isMachine ? 'AI participant' : hop.player}</>}
            </span>
            <span className="paper-text">{hop.text}</span>
            {voted && picked && <span className="turing-tag">The room picked this one</span>}
          </button>
        );
      })}

      {voted && (
        <p className="muted">
          {settings.chainLength} hops, one of them a language model, all of them written under a
          real pressure. Nobody in that chain was trying to mislead anyone.
        </p>
      )}

      <button
        className="btn btn-primary btn-block"
        disabled={!voted}
        onClick={() => dispatch({ type: 'ADVANCE', from: 'turingHop' })}
      >
        {voted ? 'Continue' : 'Pick one to continue'}
      </button>
    </div>
  );
}

/** "hop 3", or "hops 2 and 4" when a preset dealt the machine more than one. */
function machineLabel(indexes: number[]): string {
  const hops = indexes.map((i) => i + 1);
  if (hops.length === 1) return `hop ${hops[0]}`;
  return `hops ${hops.slice(0, -1).join(', ')} and ${hops[hops.length - 1]}`;
}
