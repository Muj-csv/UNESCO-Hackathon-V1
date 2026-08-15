import { useState } from 'react';
import type { Mode } from '../types/contracts';
import { useGame } from '../state/GameContext';
import { selectLobbyWarnings } from '../state/gameReducer';
import { PRESETS } from '../data/presets';
import { CARDS } from '../data/cards';
import Icon from '../components/Icon';
import type { IconName } from '../components/Icon';

/* ============================================================================
   The Control Deck.

   Three jobs, three panels: who is playing (Roster), what kind of round
   (Mode + Parameters), and the one control that starts it (Terminal).

   The mode cards are the hero because picking the mode is the only decision
   here that changes what the room learns. The Stitch prototype gave that
   choice its own screen; folding it in keeps the route unchanged — the game
   has no `modeSelect` screen and does not need one — while still letting the
   choice occupy the top of the page at full width.

   Copy note: the prototype described these modes as "asymmetric warfare",
   "purge their claims" and "wisdom of the swarm". None of that is this game.
   The descriptions below are what the modes actually do.
   ========================================================================== */

interface ModeCard {
  id: Mode;
  name: string;
  /** The structural fact about the mode, in two or three words. */
  sub: string;
  note: string;
  icon: IconName;
  tone: 'chain' | 'badfaith' | 'crowd';
}

const MODES: ModeCard[] = [
  {
    id: 'chain',
    name: 'Chain',
    sub: 'No villain',
    note: 'A true claim goes round the room, one person at a time. Everybody is trying to be accurate. Watch what happens anyway.',
    icon: 'link',
    tone: 'chain',
  },
  {
    id: 'badfaith',
    name: 'Bad Faith',
    sub: 'One hidden brief',
    note: 'One player is quietly handed a different brief. The room argues about who — then finds out the accidents did more damage than the sabotage.',
    icon: 'mask',
    tone: 'badfaith',
  },
  {
    id: 'crowd',
    name: 'Crowd Recall',
    sub: 'No chain, no traitor',
    note: 'Everyone holds a version missing one property, and nobody is told. Rebuild it together, and find out what nobody in the room was holding.',
    icon: 'people',
    tone: 'crowd',
  },
];

export default function Lobby() {
  const { state, dispatch, startRound, roomStatus, packNotice, dismissPackNotice } = useGame();
  const { players, settings, room } = state;
  const [name, setName] = useState('');
  const warnings = selectLobbyWarnings(state);
  const canStart = players.length >= 2;
  const inRoom = !!room.code;

  const addPlayer = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    dispatch({ type: 'ADD_PLAYER', name: trimmed });
    setName('');
  };

  const goCreateRoom = () => {
    window.location.hash = '';
    dispatch({ type: 'GO_TO', screen: 'joinRoom' });
  };

  const goJoinRoom = () => {
    window.location.hash = 'join';
    dispatch({ type: 'GO_TO', screen: 'joinRoom' });
  };

  return (
    <div className="screen">
      {packNotice && (
        <div className={`lobby-warning row${packNotice.kind === 'loaded' ? ' pack-notice-loaded' : ''}`}>
          <span style={{ flex: 1 }}>{packNotice.message}</span>
          <button className="btn btn-small" onClick={dismissPackNotice}>
            Dismiss
          </button>
        </div>
      )}

      {state.packClaims?.length ? (
        <div className="lobby-warning row pack-notice-loaded">
          <span style={{ flex: 1 }}>
            Playing a custom pack — {state.packClaims.length} claim
            {state.packClaims.length === 1 ? '' : 's'}.
          </span>
          <button className="btn btn-small" onClick={() => dispatch({ type: 'CLEAR_PACK' })}>
            Use built-in
          </button>
        </div>
      ) : null}

      {/* ------------------------------------------------------------ hero -- */}
      <header className="lobby-hero">
        <span className="lobby-chip">Session ready</span>
        <h1>Select operation mode</h1>
        <p className="lede">
          A true claim goes round the room. Everybody tries to be accurate. Watch what happens
          anyway.
        </p>
      </header>

      <div className="modegrid">
        {MODES.map((m) => {
          const picked = settings.mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              className={`modecard modecard-${m.tone}${picked ? ' is-picked' : ''}`}
              aria-pressed={picked}
              onClick={() => dispatch({ type: 'SET_MODE', mode: m.id })}
            >
              <span className="modecard-accent" aria-hidden="true" />
              <span className="modecard-icon">
                <Icon name={m.icon} size={32} />
              </span>
              <span className="modecard-name">{m.name}</span>
              <span className="modecard-sub">{m.sub}</span>
              <span className="modecard-note">{m.note}</span>
              <span className="modecard-pick">
                {picked ? (
                  <>
                    <Icon name="check" /> Selected
                  </>
                ) : (
                  'Choose'
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* ----------------------------------------------------------- panels -- */}
      <div className="lobby-cols">
        {/* -- roster -- */}
        <section className="neo-panel lobby-panel">
          <div className="neo-head neo-head-amber">
            Roster
            <span className="neo-tag">{players.length} in</span>
          </div>
          <div className="neo-body stack">
            {inRoom ? (
              <p className="muted">
                Players join with the room code. This list updates as they arrive.
              </p>
            ) : (
              <div className="row lobby-addrow">
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
                  <Icon name="add" /> Add
                </button>
              </div>
            )}

            {players.length > 0 && (
              <ul className="lobby-players">
                {players.map((p, i) => (
                  <li key={p.id}>
                    <span className="lobby-seat">{String(i + 1).padStart(2, '0')}</span>
                    <span>{p.name}</span>
                    {inRoom ? (
                      p.id === room.playerId && <span className="lobby-you">You</span>
                    ) : (
                      <button
                        className="btn btn-small"
                        onClick={() => dispatch({ type: 'REMOVE_PLAYER', id: p.id })}
                        aria-label={`Remove ${p.name}`}
                      >
                        <Icon name="close" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Stitch's "awaiting signal" slot. A chain needs three before the
                decay is worth reading, so the gap is worth showing. */}
            {players.length < 3 && (
              <p className="lobby-empty">
                {players.length < 2 ? 'Awaiting players…' : 'Room for more'}
              </p>
            )}
          </div>
        </section>

        {/* -- parameters -- */}
        <section className="neo-panel lobby-panel">
          <div className="neo-head">
            Parameters
            <span className="neo-tag">{settings.presetId}</span>
          </div>
          <div className="neo-body stack">
            <p className="eyebrow">Pressure environment</p>
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

            <p className="muted lobby-deck">
              <strong>In the deck:</strong> {settings.cardIds.map((id) => CARDS[id].name).join(' · ')}
            </p>

            <hr className="rule" />

            <div className="row lobby-numbers">
              <div className="lobby-setting">
                <label className="field-label" htmlFor="chain-length">
                  Hops
                </label>
                <input
                  id="chain-length"
                  className="field mono"
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
                  Seconds / hop
                </label>
                <input
                  id="timer"
                  className="field mono"
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
            </div>

            <label className="lobby-toggle">
              <input
                type="checkbox"
                checked={settings.blackBox}
                onChange={(e) =>
                  dispatch({ type: 'SET_SETTINGS', patch: { blackBox: e.target.checked } })
                }
              />
              <span>
                <strong>Black box</strong>
                <span className="muted"> — nobody sees who wrote what until the end.</span>
              </span>
            </label>

            {/* CROWD RECALL has no chain, so there is no hop for a machine to
                take. Saying so beats a toggle that quietly does nothing. */}
            <label className={`lobby-toggle${settings.mode === 'crowd' ? ' is-disabled' : ''}`}>
              <input
                type="checkbox"
                disabled={settings.mode === 'crowd'}
                checked={settings.mode !== 'crowd' && settings.aiHops > 0}
                onChange={(e) =>
                  dispatch({ type: 'SET_SETTINGS', patch: { aiHops: e.target.checked ? 1 : 0 } })
                }
              />
              <span>
                <strong>AI participant</strong>
                <span className="muted">
                  {settings.mode === 'crowd'
                    ? ' — Crowd Recall has no chain, so nothing is passed to a machine.'
                    : ' — one hop is taken by a language model, never the first or the last.'}
                </span>
              </span>
            </label>
          </div>
        </section>
      </div>

      {/* --------------------------------------------------------- terminal -- */}
      <section className="neo-panel lobby-terminal">
        <div className="neo-head">
          <span className="neo-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="lobby-uplink mono">
            {inRoom
              ? roomStatus === 'connected'
                ? 'Uplink established'
                : roomStatus === 'error'
                  ? 'Uplink trouble'
                  : 'Uplink opening…'
              : 'Local session'}
          </span>
        </div>

        <div className="neo-body lobby-terminal-body">
          <p className="eyebrow">{inRoom ? 'Access sequence' : 'Play style'}</p>
          <div className={`lobby-code${inRoom ? '' : ' is-local'}`}>
            {inRoom ? room.code : 'PASS & PLAY'}
          </div>
          <p className="muted center">
            {inRoom
              ? 'Everyone joins with this code, on their own device.'
              : 'One device, passed around the room.'}
          </p>

          {warnings.map((w) => (
            <div key={w.kind} className="lobby-warning">
              <Icon name="alert" /> {w.message}
            </div>
          ))}

          {inRoom && !room.isHost ? (
            <button className="btn btn-primary btn-lg btn-block" disabled>
              Waiting for the host…
            </button>
          ) : (
            <button
              className="btn btn-primary btn-lg btn-block"
              disabled={!canStart}
              onClick={startRound}
            >
              {canStart ? 'Initiate round' : 'Add at least two players'}
              {canStart && <Icon name="arrowForward" />}
            </button>
          )}

          <div className="row lobby-later">
            {inRoom ? (
              <button className="btn btn-small" onClick={() => dispatch({ type: 'NEW_GAME' })}>
                Leave room
              </button>
            ) : (
              <>
                <button className="btn btn-small" onClick={goCreateRoom}>
                  Create room
                </button>
                <button className="btn btn-small" onClick={goJoinRoom}>
                  Join room
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
