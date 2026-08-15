import type { Atom } from '../types/contracts';
import { useGame } from '../state/GameContext';
import { hopsForLedger } from '../state/gameReducer';
import { computeLedger, firstLostAtom, lostAtoms, survivingAtoms } from '../engine/ledger';
import { cardName } from '../data/cards';
import Icon from '../components/Icon';
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
      <StageBar label="Talk about it" note="Facilitator prompts" />

      {/* The finding, stated once and large. Everything below is the room
          working out what to do with it. */}
      <section className="debrief-hero">
        <p className="eyebrow">The finding</p>
        <h2 className="debrief-hero-line">Nobody was told to lie.</h2>
        <p className="muted">
          Every card in that chain named a pressure. Not one of them asked anyone to distort
          anything.
        </p>
      </section>

      <div className="debrief-cols">
        <section className="neo-panel">
          <div className="neo-head neo-head-amber">
            Questions for the room
            <span className="neo-tag">Say these out loud</span>
          </div>
          <div className="neo-body">
            {/* Each question's content is wrapped in a single span. The <li>
                is a flex row (marker + question), so an inline <strong> left
                as a direct child would become its own flex item and the card
                name would stack into a narrow column of its own. */}
            <ol className="debrief-questions">
              {first && (
                <li>
                  <span className="debrief-q">{ATOM_QUESTION[first]}</span>
                </li>
              )}
              {first && result[first].deathCardId && (
                <li>
                  <span className="debrief-q">
                    {first} went under <strong>{cardName(result[first].deathCardId)}</strong>. Where
                    have you felt that same pressure this week?
                  </span>
                </li>
              )}
              {survived.length > 0 && (
                <li>
                  <span className="debrief-q">
                    {survived.join(' and ')} came through. What was it about{' '}
                    {survived.length > 1 ? 'those' : 'that'} that made{' '}
                    {survived.length > 1 ? 'them' : 'it'} harder to lose?
                  </span>
                </li>
              )}
              <li>
                <span className="debrief-q">
                  Nobody in this chain was trying to mislead anyone. Does that change what you'd do
                  about it?
                </span>
              </li>
            </ol>
          </div>
        </section>

        <aside className="stack">
          <section className="neo-panel">
            <div className="neo-head">Round telemetry</div>
            <div className="neo-body stack">
              <p className="eyebrow">Did not survive</p>
              <div className="row">
                {lost.length ? (
                  lost.map((a) => (
                    <span key={a} className="atom-chip is-lost">
                      {a}
                    </span>
                  ))
                ) : (
                  <span className="muted">Nothing — all five held.</span>
                )}
              </div>

              <p className="eyebrow">Held all the way</p>
              <div className="row">
                {survived.length ? (
                  survived.map((a) => (
                    <span key={a} className="atom-chip is-alive">
                      {a}
                    </span>
                  ))
                ) : (
                  <span className="muted">None of the five.</span>
                )}
              </div>
            </div>
          </section>

          {/* Room aggregate only. This never says who called it. */}
          {prediction.total > 0 && (
            <section className="neo-panel">
              <div className="neo-head neo-head-plain">Calling it in advance</div>
              <div className="neo-body">
                <p className="muted">
                  {first
                    ? `${prediction.correct} of ${prediction.total} predicted ${first}. ${first} went first, at hop ${
                        (result[first].deathHop ?? 0) + 1
                      }.`
                    : `${prediction.total} of ${prediction.total} predicted something would go first. Nothing did — every atom survived.`}
                </p>
              </div>
            </section>
          )}
        </aside>
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
