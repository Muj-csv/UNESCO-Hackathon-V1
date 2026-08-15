import { useEffect } from 'react';
import { useGame } from '../state/GameContext';
import { cardName } from '../data/cards';
import StageBar from '../components/StageBar';

/* ============================================================================
   The Accusation.

   Somebody was handed a different brief. The room argues about who, out loud,
   with no countdown — the arguing is the fun and it is also the teaching,
   because a room reasoning about where meaning went is doing the thing this
   whole game is for.

   Then it votes, and finds out.

   Nothing is scored. The room does not beat the imposter by naming them, and
   naming them correctly earns nothing, because the payoff is one screen away:
   the ledger is about to show that the person they hunted did less damage
   than the people who were trying to help. Marking the vote right or wrong
   would put a small win in front of that and let the room stop there.

   CROWD RECALL never reaches this screen, and must never gain one.
   ========================================================================== */

export default function Accusation() {
  const { state, dispatch } = useGame();
  const { round, players } = state;
  const hasImposter = round.imposter !== null;

  useEffect(() => {
    if (!hasImposter) dispatch({ type: 'ADVANCE', from: 'accusation' });
  }, [hasImposter, dispatch]);

  if (!hasImposter || !round.claim) return null;

  const imposter = round.imposter!;
  const accused = round.accusation;
  const voted = accused !== null;
  const named = voted && accused === imposter.player;

  return (
    <div className="screen">
      <StageBar label="Who was it?" />

      {!voted ? (
        <>
          <h2>One of you was given a different brief.</h2>
          <p className="muted">
            They were asked to make one property disappear, and to keep it believable. Read the
            chain again and argue it out. There is no clock on this, and no points for getting it
            right.
          </p>
        </>
      ) : (
        <>
          <h2>It was {imposter.player}.</h2>
          <p className="muted">
            {named
              ? `The room named ${imposter.player}, who was asked to make ${imposter.targetAtom} disappear at hop ${imposter.hopIndex + 1}.`
              : `The room named ${accused}. ${imposter.player} was asked to make ${imposter.targetAtom} disappear at hop ${imposter.hopIndex + 1}.`}
          </p>
        </>
      )}

      {round.hops.map((hop, i) => (
        <div key={i} className={`paper${voted && hop.isImposter ? ' accuse-hop' : ''}`}>
          <p className="eyebrow">
            Hop {i + 1} · {cardName(hop.cardId)} · {hop.isAI ? 'AI participant' : hop.player}
            {voted && hop.isImposter && <> · the different brief</>}
          </p>
          <p className="paper-text">{hop.text}</p>
        </div>
      ))}

      {!voted ? (
        <>
          <p className="eyebrow">The room's vote</p>
          <div className="accuse-options">
            {players.map((player) => (
              <button
                key={player.id}
                type="button"
                className="accuse-option"
                onClick={() => dispatch({ type: 'CAST_ACCUSATION', player: player.name })}
              >
                {player.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="muted">
          Whatever {imposter.player} did, they did it once and on purpose. The next screen counts
          what the rest of the chain did without meaning to.
        </p>
      )}

      <button
        className="btn btn-primary btn-block"
        disabled={!voted}
        onClick={() => dispatch({ type: 'ADVANCE', from: 'accusation' })}
      >
        {voted ? 'Continue' : 'Name someone to continue'}
      </button>
    </div>
  );
}
