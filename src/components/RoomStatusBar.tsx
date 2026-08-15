import { useEffect, useState } from 'react';
import { useGame } from '../state/GameContext';
import { textInFrontOfPlayer } from '../state/gameReducer';
import { forceAdvanceSimRound } from '../state/room';
import Icon from './Icon';

/* ============================================================================
   OWNER: T7 (rooms and simultaneous play).

   Mounted from AppShell, not from a screen — a connection problem or a stuck
   turn has to stay visible and actionable no matter which screen the room is
   on. It's also what makes a simultaneous round's "wave" legible at all: the
   wait between waves renders as a blank Round.tsx (see simultaneousRound.ts
   — there's no claim to show yet), so this bar is what tells a player that's
   expected.

   PHASE 2 CHANGE: the room code and the connection dot moved into the top
   bar, which is on screen at all times and is where a player now looks for
   "am I connected". What is left here is only what the bar can DO — so it
   renders nothing at all on the happy path, instead of sitting under the
   chrome permanently repeating a fact the chrome already states.

   Covers T7's failure-handling requirements (docs/T7):
   - a connection indicator, always visible while in a room
   - "the host can force-advance a stuck round" — in a simultaneous round,
     fills the current wave server-side (simRound.ts); otherwise passes the
     current version on unchanged, the same fallback Round.tsx's own
     per-device timer uses
   - on prolonged failure, offer to continue in pass-and-play with current
     state, without losing the round already in progress
   ========================================================================== */

const PROLONGED_FAILURE_MS = 10_000;

export default function RoomStatusBar() {
  const { state, dispatch, roomStatus, simRoundActive } = useGame();
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
    if (simRoundActive && room.code && room.playerId) {
      forceAdvanceSimRound(room.code, room.playerId).catch(() => {
        /* Next wave's own deadline, or a retry tap, catches this up. */
      });
      return;
    }
    dispatch({ type: 'SUBMIT_HOP', text: textInFrontOfPlayer(state) });
  };

  /* An empty code is gameReducer's JOIN_ROOM shorthand for "go offline" —
     see the reducer case for why this reuses the action rather than adding
     a new one. Whatever chain this device was last showing keeps playing
     locally from here, same as any other pass-and-play round. */
  const continueOffline = () => dispatch({ type: 'JOIN_ROOM', code: '', playerId: '', isHost: false });

  const canForceAdvance = room.isHost && inRound;
  const troubled = roomStatus === 'error';
  const showWave = simRoundActive && inRound;

  /* Nothing to say and nothing to do — stay out of the way. */
  if (!canForceAdvance && !showFallbackOffer && !troubled && !showWave) return null;

  return (
    <div className={`room-status${troubled ? ' is-troubled' : ''}`} role="status">
      {troubled && (
        <span className="room-status-msg">
          <Icon name="alert" />
          Connection trouble — retrying
        </span>
      )}
      {showWave && (
        <span className="mono">
          Wave {Math.min(round.currentHop + 1, settings.chainLength)} of {settings.chainLength}
        </span>
      )}
      <span className="spacer" />
      {canForceAdvance && (
        <button className="btn btn-small" onClick={forceAdvance}>
          Force advance
        </button>
      )}
      {showFallbackOffer && (
        <button className="btn btn-small" onClick={continueOffline}>
          Continue in pass-and-play
        </button>
      )}
    </div>
  );
}
