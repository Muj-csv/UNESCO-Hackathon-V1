import { useEffect, useState } from 'react';
import { useGame } from '../state/GameContext';
import { textInFrontOfPlayer } from '../state/gameReducer';

/* ============================================================================
   OWNER: T7 (rooms and simultaneous play).

   Mounted globally from GameContext.tsx, not from a screen — Round.tsx is a
   frozen shared file, so a connection problem or a stuck turn has to stay
   visible and actionable no matter which screen the room is on.

   Covers three of T7's failure-handling requirements (docs/T7):
   - a connection indicator, always visible while in a room
   - "the host can force-advance a stuck round" — passes the current version
     on unchanged, the same fallback Round.tsx's own per-device timer uses
   - on prolonged failure, offer to continue in pass-and-play with current
     state, without losing the round already in progress
   ========================================================================== */

const PROLONGED_FAILURE_MS = 10_000;

export default function RoomStatusBar() {
  const { state, dispatch, roomStatus } = useGame();
  const { room, round, settings, screen } = state;
  const [showFallbackOffer, setShowFallbackOffer] = useState(false);

  useEffect(() => {
    if (roomStatus !== 'error') {
      setShowFallbackOffer(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShowFallbackOffer(true), PROLONGED_FAILURE_MS);
    return () => window.clearTimeout(timer);
  }, [roomStatus]);

  if (!room.code) return null;

  const inRound = screen === 'round' && round.currentHop < settings.chainLength;

  const forceAdvance = () => {
    dispatch({ type: 'SUBMIT_HOP', text: textInFrontOfPlayer(state) });
  };

  /* An empty code is gameReducer's JOIN_ROOM shorthand for "go offline" —
     see the reducer case for why this reuses the action rather than adding
     a new one. */
  const continueOffline = () => dispatch({ type: 'JOIN_ROOM', code: '', playerId: '', isHost: false });

  return (
    <div className="room-status" role="status">
      <span className="mono">{room.code}</span>
      <span className={`room-status-dot is-${roomStatus}`} aria-hidden="true" />
      <span>
        {roomStatus === 'connected'
          ? 'Connected'
          : roomStatus === 'error'
            ? 'Connection trouble'
            : 'Connecting…'}
      </span>
      <span className="spacer" />
      {room.isHost && inRound && (
        <button className="btn btn-ghost btn-small" onClick={forceAdvance}>
          Force advance
        </button>
      )}
      {showFallbackOffer && (
        <button className="btn btn-ghost btn-small" onClick={continueOffline}>
          Continue in pass-and-play
        </button>
      )}
    </div>
  );
}
