import { useState } from 'react';
import { useGame } from '../state/GameContext';
import { createRoom, isValidRoomCode, joinRoom, normalizeRoomCode } from '../state/room';

/* ============================================================================
   T7. Reached from the lobby's "Create room" / "Join room" buttons. Both
   land here — it's one screen with a tab, not two, so there's nowhere for a
   half-finished form to get stranded.

   Which tab opens by default follows the button that was clicked, carried
   through `location.hash` rather than a new field on GameState (frozen).
   ========================================================================== */

type Tab = 'create' | 'join';

function initialTab(): Tab {
  return window.location.hash === '#join' ? 'join' : 'create';
}

export default function JoinRoom() {
  const { dispatch } = useGame();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = () => dispatch({ type: 'GO_TO', screen: 'lobby' });

  const submitCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const { code: roomCode, playerId } = await createRoom(trimmed);
      dispatch({ type: 'JOIN_ROOM', code: roomCode, playerId, isHost: true });
      dispatch({ type: 'GO_TO', screen: 'lobby' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a room.');
    } finally {
      setBusy(false);
    }
  };

  const submitJoin = async () => {
    const trimmedName = name.trim();
    const normalizedCode = normalizeRoomCode(code);
    if (!trimmedName || !isValidRoomCode(normalizedCode)) return;
    setBusy(true);
    setError(null);
    try {
      const { playerId } = await joinRoom(normalizedCode, trimmedName);
      dispatch({ type: 'JOIN_ROOM', code: normalizedCode, playerId, isHost: false });
      dispatch({ type: 'GO_TO', screen: 'lobby' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join that room.');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = tab === 'create' ? !!name.trim() : !!name.trim() && isValidRoomCode(code);

  return (
    <div className="screen">
      <header>
        <p className="eyebrow eyebrow-amber">TruthChain</p>
        <h1>{tab === 'create' ? 'Create a room' : 'Join a room'}</h1>
        <p className="lede">
          {tab === 'create'
            ? 'Everyone plays from their own device. Share the code that comes up.'
            : 'Enter the four-letter code the host is showing.'}
        </p>
      </header>

      <div className="row">
        <button
          className={`btn ${tab === 'create' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('create')}
        >
          Create
        </button>
        <button
          className={`btn ${tab === 'join' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('join')}
        >
          Join
        </button>
      </div>

      <section className="stack">
        <label className="field-label" htmlFor="room-name">
          Your name
        </label>
        <input
          id="room-name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="First name"
          autoFocus
        />

        {tab === 'join' && (
          <>
            <label className="field-label" htmlFor="room-code">
              Room code
            </label>
            <input
              id="room-code"
              className="field mono"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
              maxLength={4}
              placeholder="ABCD"
            />
          </>
        )}
      </section>

      {error && <div className="lobby-warning">{error}</div>}

      <button
        className="btn btn-primary btn-block"
        disabled={busy || !canSubmit}
        onClick={tab === 'create' ? submitCreate : submitJoin}
      >
        {busy ? 'Please wait…' : tab === 'create' ? 'Create room' : 'Join room'}
      </button>

      <button className="btn btn-ghost btn-block" onClick={back}>
        Back
      </button>
    </div>
  );
}
