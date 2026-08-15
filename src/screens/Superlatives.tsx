import { useGame } from '../state/GameContext';
import { hopsForLedger } from '../state/gameReducer';
import { computeLedger, firstLostAtom, survivingAtoms } from '../engine/ledger';
import { shrinkRatio } from '../engine/normalize';
import { cardName } from '../data/cards';
import { ATOM_ICON } from '../data/atoms';
import Icon from '../components/Icon';
import StageBar from '../components/StageBar';

/* ============================================================================
   Superlatives about the CLAIM, never about the people.

   Every line here leads with the pressure and puts the player in parentheses,
   because the thesis is that nobody lied. There is no "most destructive
   player" and there must never be one — that is the scored version of this
   game, and removing scoring was deliberate and costly.
   ========================================================================== */

export default function Superlatives() {
  const { state, dispatch } = useGame();
  const { round } = state;
  const hops = hopsForLedger(state);
  if (!round.claim) return null;

  const result = computeLedger(round.claim, hops, round.verifications, round.overrides);
  const first = firstLostAtom(result);
  const survived = survivingAtoms(result);

  /* The single sharpest compression in the chain — a fact about the text. */
  let sharpest = { index: -1, ratio: 0 };
  hops.forEach((hop, i) => {
    const previous = i === 0 ? round.claim!.originalText : hops[i - 1].text;
    const ratio = shrinkRatio(previous, hop.text);
    if (ratio > sharpest.ratio) sharpest = { index: i, ratio };
  });

  return (
    <div className="screen">
      <StageBar label="What the round did" note="About the claim, not the room" />

      <div className="superlatives">
        {first && (
          <section className="super-card super-card-lost">
            <span className="super-icon">
              <Icon name={ATOM_ICON[first]} size={24} />
            </span>
            <p className="eyebrow">First to go</p>
            <h3 className="super-headline">{first}</h3>
            <p className="muted">
              Lost at hop {(result[first].deathHop ?? 0) + 1}, under{' '}
              <strong>{cardName(result[first].deathCardId)}</strong>
              {byline(hops, result[first].deathHop)}.
            </p>
          </section>
        )}

        {survived.length > 0 && (
          <section className="super-card super-card-held">
            <span className="super-icon">
              <Icon name="check" size={24} />
            </span>
            <p className="eyebrow">Held all the way</p>
            <h3 className="super-headline">{survived.join(' · ')}</h3>
            <p className="muted">
              {survived.length === 5
                ? 'The whole claim arrived intact. That is rarer than it looks.'
                : 'Whatever else happened, this made it to the end.'}
            </p>
          </section>
        )}

        {sharpest.index >= 0 && sharpest.ratio > 0 && (
          <section className="super-card super-card-cut">
            <span className="super-icon">
              <Icon name="split" size={24} />
            </span>
            <p className="eyebrow">Sharpest cut</p>
            <h3 className="super-headline">{Math.round(sharpest.ratio * 100)}% of the words gone</h3>
            <p className="muted">
              At hop {sharpest.index + 1}, under{' '}
              <strong>{cardName(hops[sharpest.index].cardId)}</strong>
              {byline(hops, sharpest.index)}.
            </p>
          </section>
        )}
      </div>

      <button
        className="btn btn-primary btn-lg btn-block"
        onClick={() => dispatch({ type: 'ADVANCE' })}
      >
        Continue <Icon name="arrowForward" />
      </button>
    </div>
  );
}

/** Player in parentheses, never as the subject of the sentence. */
function byline(hops: { player: string; isAI?: boolean }[], index: number | null): string {
  if (index === null) return '';
  const hop = hops[index];
  if (!hop) return '';
  return hop.isAI ? ' (AI participant)' : ` (${hop.player}'s turn)`;
}
