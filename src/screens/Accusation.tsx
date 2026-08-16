import { useEffect } from 'react';
import { useGame } from '../state/GameContext';
import { cardName } from '../data/cards';
import Icon from '../components/Icon';
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

   PHASE 5 NOTE: the Stitch prototype put a fifteen-second countdown on this
   screen. It is deliberately absent. A clock would end the argument, and the
   argument is the entire value of the beat — so the plate where the timer sat
   says so instead.

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
      <StageBar label="Who was it?" note={voted ? 'Revealed' : 'No clock on this'} />

      {/* Stitch's alert banner. Yellow, because in this palette yellow is
          pressure and attention — not red, which would read as a verdict on
          a person before the room has even argued. */}
      <div className={`verdict-banner${voted ? ' is-settled' : ''}`}>
        <span className="verdict-banner-mark" aria-hidden="true">
          <Icon name="mask" size={26} />
        </span>
        <div>
          <h2>
            {voted ? `It was ${imposter.player}.` : 'One of you was given a different brief.'}
          </h2>
          <p className="muted">
            {voted
              ? named
                ? `The room named ${imposter.player}, who was asked to make ${imposter.targetAtom} disappear at hop ${imposter.hopIndex + 1}.`
                : `The room named ${accused}. ${imposter.player} was asked to make ${imposter.targetAtom} disappear at hop ${imposter.hopIndex + 1}.`
              : 'They were asked to make one property disappear, and to keep it believable. Read the chain again and argue it out.'}
          </p>
        </div>
        {!voted && <span className="verdict-noclock">No clock<br />no points</span>}
      </div>

      <div className="chain">
        {round.hops.map((hop, i) => (
          <article
            key={i}
            className={`chainblock${voted && hop.isImposter ? ' accuse-hop' : ''}${
              hop.isAI ? ' is-machine' : ''
            }`}
          >
            <header className="chainblock-head">
              <span className="chainblock-n">{String(i + 1).padStart(2, '0')}</span>
              <span className="chainblock-card">{cardName(hop.cardId)}</span>
              <span className="chainblock-who">{hop.isAI ? 'AI participant' : hop.player}</span>
              {voted && hop.isImposter && (
                <span className="chainblock-flag">The different brief</span>
              )}
              {/* BBB-004, and the same rule as the other three chain screens:
                  never while a guess is pending. A forfeited hop passed its
                  text on untouched, so before the vote this badge is a
                  mechanical elimination and the argument is the point. */}
              {voted && hop.forfeited && (
                <span className="chainblock-forfeit">Time ran out</span>
              )}
            </header>
            <p className="paper-text">{hop.text}</p>
          </article>
        ))}
      </div>

      {!voted ? (
        <>
          <p className="eyebrow">The room's vote</p>
          <div className="suspects">
            {players.map((player, i) => (
              <button
                key={player.id}
                type="button"
                className="suspect"
                onClick={() => dispatch({ type: 'CAST_ACCUSATION', player: player.name })}
              >
                <span className="suspect-mark" aria-hidden="true">
                  {player.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="suspect-name">{player.name}</span>
                <span className="suspect-id">{seatId(player.name, i)}</span>
                <span className="suspect-vote">Name them</span>
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
        className="btn btn-primary btn-lg btn-block"
        disabled={!voted}
        onClick={() => dispatch({ type: 'ADVANCE', from: 'accusation' })}
      >
        {voted ? 'Continue' : 'Name someone to continue'}
        {voted && <Icon name="arrowForward" />}
      </button>
    </div>
  );
}

/**
 * A seat tag, in the machine-readable style the rest of the chrome uses.
 * Derived from the name and the seat, so it needs nothing stored and cannot
 * survive the round — there are no accounts in this game and no ids to leak.
 */
function seatId(name: string, index: number): string {
  const letters = name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  return `${letters}-${String(index + 1).padStart(2, '0')}`;
}
