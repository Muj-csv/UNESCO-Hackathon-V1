import type { Atom, RoundResult } from '../types/contracts';
import { ATOMS } from '../types/contracts';
import { useGame } from '../state/GameContext';
import StageBar from '../components/StageBar';

/* Across the whole session. Room-level only — this screen never says which
   person lost the most, because that number does not exist anywhere in the
   application and adding it would teach the wrong thing. */

/**
 * T6 — how often the room picked the machine out.
 *
 * Rounds where no machine played, or where nobody voted, are not counted
 * against the room: `turingCorrect` is null for those and they are skipped
 * entirely rather than folded in as misses.
 */
export function spottedTheMachine(results: RoundResult[]): { correct: number; asked: number } {
  const asked = results.filter((r) => r.turingCorrect !== null);
  return { correct: asked.filter((r) => r.turingCorrect).length, asked: asked.length };
}

/**
 * T9 — per round, how many predictions named the atom that actually went
 * first. Rounds nobody predicted in, or where nothing was lost, are skipped
 * rather than counted as a miss, same treatment as `spottedTheMachine`.
 */
export function predictionTrend(results: RoundResult[]): { round: number; correct: number; total: number }[] {
  return results
    .map((r, i) => ({ round: i + 1, result: r }))
    .filter(({ result }) => Object.keys(result.predictions).length > 0 && result.firstLostAtom !== null)
    .map(({ round, result }) => ({
      round,
      total: Object.keys(result.predictions).length,
      correct: Object.values(result.predictions).filter((a) => a === result.firstLostAtom).length,
    }));
}

export default function SessionReadout() {
  const { state, dispatch, nextRound } = useGame();
  const results = state.session.results;

  const timesLost: Record<Atom, number> = { SOURCE: 0, NUMBER: 0, HEDGE: 0, SCOPE: 0, CAUSE: 0 };
  for (const r of results) for (const a of r.lostAtoms) timesLost[a] += 1;

  const rounds = results.length;
  const mostFragile = ATOMS.slice().sort((a, b) => timesLost[b] - timesLost[a])[0];
  const neverLost = ATOMS.filter((a) => timesLost[a] === 0);
  const turing = spottedTheMachine(results);
  const prediction = predictionTrend(results);

  return (
    <div className="screen">
      <StageBar label="This session" note={`${rounds} round${rounds === 1 ? '' : 's'}`} />
      <h2>What this room kept losing</h2>

      <div className="card">
        {ATOMS.map((atom) => (
          <div className="readout-row" key={atom}>
            <span className="mono readout-atom">{atom}</span>
            <span className="readout-bar" aria-hidden="true">
              <span
                className="readout-fill"
                style={{ width: `${rounds ? (timesLost[atom] / rounds) * 100 : 0}%` }}
              />
            </span>
            <span className="mono readout-count">
              {timesLost[atom]}/{rounds}
            </span>
          </div>
        ))}
      </div>

      {rounds > 0 && (
        <p className="lede">
          {timesLost[mostFragile] > 0
            ? `${mostFragile} went in ${timesLost[mostFragile]} of ${rounds}. That is the one to check first when something reaches you.`
            : 'Nothing was lost in this session. Try a shorter chain or a harder card set.'}
        </p>
      )}

      {neverLost.length > 0 && rounds > 0 && (
        <p className="muted">Never lost here: {neverLost.join(' · ')}.</p>
      )}

      {/* Reported, not scored. A room that never found it has learned the
          thing this beat exists to teach. */}
      {turing.asked > 0 && (
        <div className="card">
          <p className="eyebrow">The machine</p>
          <p className="muted">
            This room picked the machine out {turing.correct}{' '}
            {turing.correct === 1 ? 'time' : 'times'} out of {turing.asked}.
          </p>
          <p className="muted">
            {turing.correct === 0
              ? 'Not once — which is the usual result. A summariser under a real pressure is not distinguishable from a person doing their honest best under the same one.'
              : 'Whatever gave it away, it was not the machine being careless. It was handed the same version and the same card as everyone else.'}
          </p>
        </div>
      )}

      {/* Room aggregate only, same rule as everywhere else — never who called it. */}
      {prediction.length > 0 && (
        <div className="card">
          <p className="eyebrow">Calling it in advance</p>
          <p className="muted">
            {prediction.map((p) => `${p.correct} of ${p.total} in round ${p.round}`).join(', ')}.
          </p>
          <p className="muted">
            {prediction.length > 1 &&
            prediction[prediction.length - 1].correct / prediction[prediction.length - 1].total >
              prediction[0].correct / prediction[0].total
              ? 'This room got better at predicting where it would break.'
              : 'Predicting which one goes first is hard even after watching it happen once.'}
          </p>
        </div>
      )}

      <button className="btn btn-primary btn-block" onClick={nextRound}>
        Play another round
      </button>
      <button className="btn btn-ghost btn-block" onClick={() => dispatch({ type: 'NEW_GAME' })}>
        Finish and start over
      </button>
    </div>
  );
}
