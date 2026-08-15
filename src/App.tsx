/* Phase 3 state harness.
   Phase 5 replaces this with the screen registry that reads `screen` from
   context. Until then it drives the reducer directly so the transitions,
   the bug fixes, and the derived warnings can be exercised in a browser. */

import { useGame } from './state/GameContext';
import { currentCardId, hopPlayerName, selectLobbyWarnings, textInFrontOfPlayer } from './state/gameReducer';
import { cardName } from './data/cards';
import { PRESETS } from './data/presets';

const SAMPLE_NAMES = ['Mika', 'Dan', 'Rowena', 'Kiel', 'Ari', 'Noel', 'Trish', 'Paolo'];

export default function App() {
  const { state, dispatch, claims, startRound } = useGame();
  const { round, settings, session } = state;
  const warnings = selectLobbyWarnings(state);
  const chainDone = round.currentHop >= settings.chainLength;

  return (
    <div className="shell">
      <div className="screen">
        <div>
          <p className="eyebrow eyebrow-amber">State harness · phase 3</p>
          <h1>TruthChain</h1>
        </div>

        <div className="card">
          <p className="eyebrow">Reducer</p>
          <p className="mono muted">
            screen <strong>{state.screen}</strong> · mode <strong>{settings.mode}</strong> · round{' '}
            <strong>{session.roundNumber}</strong> · hop{' '}
            <strong>
              {Math.min(round.currentHop + 1, settings.chainLength)}/{settings.chainLength}
            </strong>{' '}
            · results <strong>{session.results.length}</strong> · checks left{' '}
            <strong>{round.verificationsLeft}</strong>
          </p>
          <div className="wire">
            {Array.from({ length: settings.chainLength }).map((_, i) => (
              <span key={i} style={{ display: 'contents' }}>
                {i > 0 && <span className={`wire-link${i <= round.currentHop ? ' is-done' : ''}`} />}
                <span
                  className={`wire-node${
                    i < round.currentHop ? ' is-done' : i === round.currentHop ? ' is-current' : ''
                  }`}
                />
              </span>
            ))}
          </div>
        </div>

        <div className="row">
          <button
            className="btn btn-small"
            onClick={() => dispatch({ type: 'ADD_PLAYER', name: SAMPLE_NAMES[state.players.length % 8] })}
          >
            + player ({state.players.length})
          </button>
          <button className="btn btn-small btn-primary" onClick={startRound}>
            Begin round
          </button>
          <button className="btn btn-small btn-ghost" onClick={() => dispatch({ type: 'ADVANCE' })}>
            Advance
          </button>
          <button className="btn btn-small btn-ghost" onClick={() => dispatch({ type: 'NEW_GAME' })}>
            New game
          </button>
        </div>

        <div className="row">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className={`btn btn-small ${settings.presetId === p.id ? '' : 'btn-ghost'}`}
              onClick={() => dispatch({ type: 'SET_PRESET', presetId: p.id })}
            >
              {p.name}
            </button>
          ))}
        </div>

        {warnings.map((w) => (
          <div key={w.kind} className="constraint">
            <span className="constraint-name">{w.kind}</span>
            <span className="constraint-note">{w.message}</span>
          </div>
        ))}

        {round.claim && (
          <>
            <div className="paper paper-original">
              <p className="eyebrow">In front of {hopPlayerName(state, round.currentHop)}</p>
              <p className="paper-text">{textInFrontOfPlayer(state)}</p>
            </div>

            {!chainDone && (
              <div className="constraint">
                <span className="constraint-name">{cardName(currentCardId(state))}</span>
                <span className="constraint-note">
                  Dealt: {round.dealtCards.map((c) => cardName(c)).join(' · ')}
                </span>
              </div>
            )}

            <div className="row">
              <button
                className="btn btn-small btn-primary"
                disabled={chainDone}
                onClick={() =>
                  dispatch({
                    type: 'SUBMIT_HOP',
                    text: `${textInFrontOfPlayer(state)} (hop ${round.currentHop + 1})`,
                  })
                }
              >
                Submit hop
              </button>
              <button
                className="btn btn-small btn-ghost"
                disabled={round.verificationsLeft <= 0}
                onClick={() =>
                  dispatch({
                    type: 'SPEND_VERIFICATION',
                    hopIndex: round.currentHop,
                    atoms: ['HEDGE'],
                  })
                }
              >
                Spend check
              </button>
            </div>

            {round.hops.map((h, i) => (
              <div key={i} className="paper">
                <p className="eyebrow">
                  Hop {i + 1} · {h.player} · {cardName(h.cardId)}
                </p>
                <p className="muted">{h.text}</p>
              </div>
            ))}
          </>
        )}

        <p className="muted mono">
          {claims.length} claims loaded · {state.players.map((p) => p.name).join(', ') || 'no players'}
        </p>
      </div>
    </div>
  );
}
