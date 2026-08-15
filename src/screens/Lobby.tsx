import { useState } from 'react';
import type { Mode } from '../types/contracts';
import { useGame } from '../state/GameContext';
import { selectLobbyWarnings } from '../state/gameReducer';
import { PRESETS } from '../data/presets';
import { CARDS } from '../data/cards';

/* Modes the room can pick. BAD FAITH is registered but not built — shown
   disabled so the roadmap is visible without overstating what exists. */
const MODES: { id: Mode; name: string; note: string; ready: boolean }[] = [
  { id: 'chain', name: 'Chain', note: 'A true claim, passed along. No villain.', ready: true },
  {
    id: 'badfaith',
    name: 'Bad Faith',
    note: 'One player is quietly given a different brief.',
    ready: false,
  },
  {
    id: 'crowd',
    name: 'Crowd Recall',
    note: 'Everyone holds a different piece. Rebuild it together.',
    ready: true,
  },
];

export default function Lobby() {
  const { state, dispatch, startRound } = useGame();
  const { players, settings } = state;
  const [name, setName] = useState('');
  const warnings = selectLobbyWarnings(state);
  const canStart = players.length >= 2;

  const addPlayer = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    dispatch({ type: 'ADD_PLAYER', name: trimmed });
    setName('');
  };

  return (
    <div className="screen">
      <header>
        <p className="eyebrow eyebrow-amber">Media &amp; information literacy</p>
        <h1>TruthChain</h1>
        <p className="lede">
          A true claim goes round the room. Everybody tries to be accurate. Watch what happens
          anyway.
        </p>
      </header>

      <button className="btn btn-ghost btn-block" onClick={() => dispatch({ type: 'GO_TO', screen: 'howToPlay' })}>
        How to play
      </button>

      <section className="stack">
        <p className="eyebrow">Who is playing</p>
        <div className="row">
          <input
            className="field lobby-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
            placeholder="First name"
            maxLength={20}
            aria-label="Player name"
          />
          <button className="btn" onClick={addPlayer} disabled={!name.trim()}>
            Add
          </button>
        </div>
        {players.length > 0 && (
          <ul className="lobby-players">
            {players.map((p, i) => (
              <li key={p.id}>
                <span className="mono lobby-seat">{i + 1}</span>
                <span>{p.name}</span>
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => dispatch({ type: 'REMOVE_PLAYER', id: p.id })}
                  aria-label={`Remove ${p.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack">
        <p className="eyebrow">Mode</p>
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`lobby-option${settings.mode === m.id ? ' is-picked' : ''}`}
            disabled={!m.ready}
            onClick={() => dispatch({ type: 'SET_MODE', mode: m.id })}
          >
            <span className="lobby-option-name">
              {m.name}
              {!m.ready && <span className="lobby-soon">not yet available</span>}
            </span>
            <span className="lobby-option-note">{m.note}</span>
          </button>
        ))}
      </section>

      <section className="stack">
        <p className="eyebrow">Pressure</p>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`lobby-option${settings.presetId === p.id ? ' is-picked' : ''}`}
            onClick={() => dispatch({ type: 'SET_PRESET', presetId: p.id })}
          >
            <span className="lobby-option-name">{p.name}</span>
            <span className="lobby-option-note">{p.note}</span>
          </button>
        ))}
        <p className="muted">
          Cards in play: {settings.cardIds.map((id) => CARDS[id].name).join(' · ')}
        </p>
      </section>

      <section className="stack">
        <p className="eyebrow">Settings</p>
        <div className="lobby-setting">
          <label className="field-label" htmlFor="chain-length">
            Hops in the chain
          </label>
          <input
            id="chain-length"
            className="field"
            type="number"
            min={2}
            max={12}
            value={settings.chainLength}
            onChange={(e) =>
              dispatch({
                type: 'SET_SETTINGS',
                patch: { chainLength: clamp(Number(e.target.value), 2, 12) },
              })
            }
          />
        </div>
        <div className="lobby-setting">
          <label className="field-label" htmlFor="timer">
            Seconds per hop
          </label>
          <input
            id="timer"
            className="field"
            type="number"
            min={15}
            max={180}
            step={5}
            value={settings.timerSeconds}
            onChange={(e) =>
              dispatch({
                type: 'SET_SETTINGS',
                patch: { timerSeconds: clamp(Number(e.target.value), 15, 180) },
              })
            }
          />
        </div>
        <label className="lobby-toggle">
          <input
            type="checkbox"
            checked={settings.blackBox}
            onChange={(e) => dispatch({ type: 'SET_SETTINGS', patch: { blackBox: e.target.checked } })}
          />
          <span>
            <strong>Black box</strong>
            <span className="muted"> — nobody sees who wrote what until the end.</span>
          </span>
        </label>
        <label className="lobby-toggle is-disabled">
          <input type="checkbox" disabled checked={false} readOnly />
          <span>
            <strong>AI participant</strong>
            <span className="muted"> — one hop taken by a language model. Not yet available.</span>
          </span>
        </label>
      </section>

      {warnings.map((w) => (
        <div key={w.kind} className="lobby-warning">
          {w.message}
        </div>
      ))}

      <button className="btn btn-primary btn-block" disabled={!canStart} onClick={startRound}>
        {canStart ? 'Start the round' : 'Add at least two players'}
      </button>

      <div className="row lobby-later">
        <button className="btn btn-ghost btn-small" disabled>
          Create room
        </button>
        <button className="btn btn-ghost btn-small" disabled>
          Join room
        </button>
        <button className="btn btn-ghost btn-small" disabled>
          Pack Studio
        </button>
      </div>
      <p className="muted center">
        Every claim in this game is made up. No real people, organisations or events.
      </p>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
