import type { Atom } from '../types/contracts';
import { ATOMS } from '../types/contracts';
import { useGame } from '../state/GameContext';
import StageBar from '../components/StageBar';

/* Across the whole session. Room-level only — this screen never says which
   person lost the most, because that number does not exist anywhere in the
   application and adding it would teach the wrong thing. */

export default function SessionReadout() {
  const { state, dispatch, nextRound } = useGame();
  const results = state.session.results;

  const timesLost: Record<Atom, number> = { SOURCE: 0, NUMBER: 0, HEDGE: 0, SCOPE: 0, CAUSE: 0 };
  for (const r of results) for (const a of r.lostAtoms) timesLost[a] += 1;

  const rounds = results.length;
  const mostFragile = ATOMS.slice().sort((a, b) => timesLost[b] - timesLost[a])[0];
  const neverLost = ATOMS.filter((a) => timesLost[a] === 0);

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

      <div className="card">
        <p className="eyebrow">Not yet available</p>
        <p className="muted">
          Prediction accuracy across rounds, and how often this room spotted the machine, appear
          here once those parts are built.
        </p>
      </div>

      <button className="btn btn-primary btn-block" onClick={nextRound}>
        Play another round
      </button>
      <button className="btn btn-ghost btn-block" onClick={() => dispatch({ type: 'NEW_GAME' })}>
        Finish and start over
      </button>
    </div>
  );
}
