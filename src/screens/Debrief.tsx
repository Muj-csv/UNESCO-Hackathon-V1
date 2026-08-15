import type { Atom } from '../types/contracts';
import { useGame } from '../state/GameContext';
import { hopsForLedger } from '../state/gameReducer';
import { computeLedger, firstLostAtom, lostAtoms, survivingAtoms } from '../engine/ledger';
import { cardName } from '../data/cards';
import StageBar from '../components/StageBar';

/* The talking part. A facilitator with no MIL training should be able to run
   this off the screen, so the prompts have to carry the session on their own. */

const ATOM_QUESTION: Record<Atom, string> = {
  SOURCE: 'At what point did it stop mattering who said it?',
  NUMBER: 'The figure survived, but did the thing it was measured against?',
  HEDGE: 'Who decided it was settled? Nobody chose that — so how did it happen?',
  SCOPE: 'When did this stop being about the people it was actually about?',
  CAUSE: 'Which retelling turned "goes with" into "makes"?',
};

/**
 * T9 — how many of the room's predictions named the atom that actually went
 * first. Room aggregate only: this never says who was right, only how many.
 */
export function predictionAccuracy(
  predictions: Record<string, Atom>,
  first: Atom | null,
): { correct: number; total: number } {
  const total = Object.keys(predictions).length;
  if (first === null) return { correct: 0, total };
  return { correct: Object.values(predictions).filter((a) => a === first).length, total };
}

export default function Debrief() {
  const { state, dispatch } = useGame();
  const { round } = state;
  const hops = hopsForLedger(state);
  if (!round.claim) return null;

  const result = computeLedger(round.claim, hops, round.verifications, round.overrides);
  const lost = lostAtoms(result);
  const survived = survivingAtoms(result);
  const first = firstLostAtom(result);
  const prediction = predictionAccuracy(round.predictions, first);

  return (
    <div className="screen">
      <StageBar label="Talk about it" />
      <h2>Nobody was told to lie</h2>
      <p className="lede">
        Every card in that chain named a pressure. Not one of them asked anyone to distort
        anything.
      </p>

      <div className="row">
        {lost.map((a) => (
          <span key={a} className="atom-chip is-lost">
            {a}
          </span>
        ))}
        {survived.map((a) => (
          <span key={a} className="atom-chip is-alive">
            {a}
          </span>
        ))}
      </div>

      <div className="card">
        <p className="eyebrow">Questions for the room</p>
        <ol className="debrief-questions">
          {first && <li>{ATOM_QUESTION[first]}</li>}
          {first && result[first].deathCardId && (
            <li>
              {first} went under <strong>{cardName(result[first].deathCardId)}</strong>. Where have
              you felt that same pressure this week?
            </li>
          )}
          {survived.length > 0 && (
            <li>
              {survived.join(' and ')} came through. What was it about {survived.length > 1 ? 'those' : 'that'}{' '}
              that made {survived.length > 1 ? 'them' : 'it'} harder to lose?
            </li>
          )}
          <li>Nobody in this chain was trying to mislead anyone. Does that change what you'd do about it?</li>
        </ol>
      </div>

      {prediction.total > 0 && (
        <div className="card">
          <p className="eyebrow">What the room called it</p>
          <p className="muted">
            {first
              ? `${prediction.correct} of ${prediction.total} predicted ${first}. ${first} went first, at hop ${
                  (result[first].deathHop ?? 0) + 1
                }.`
              : `${prediction.total} of ${prediction.total} predicted something would go first. Nothing did — every atom survived.`}
          </p>
        </div>
      )}

      <button className="btn btn-primary btn-block" onClick={() => dispatch({ type: 'ADVANCE' })}>
        Continue
      </button>
    </div>
  );
}
