import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { Claim, GameState, ScreenId } from '../types/contracts';
import type { Action } from './gameReducer';
import { gameReducer, initialState, prepareRound } from './gameReducer';
import { clearState, loadState, saveState } from './persistence';
import { sendRoomAction, useRoomSync } from './room';
import type { RoomSyncStatus } from './room';
import type { SharedGameState } from './roomProtocol';
import ResumePrompt from '../components/ResumePrompt';
import rawClaims from '../data/claims.en.json';

const SAVE_DEBOUNCE_MS = 300;
/* Separate, shorter debounce for pushing to the room — a round in progress
   changes state more often than the sessionStorage save needs to react to,
   and other devices are waiting on this one to move. */
const ROOM_PUSH_DEBOUNCE_MS = 150;

/** A saved lobby or a finished session isn't worth a resume prompt. */
function isResumable(state: GameState): boolean {
  return state.screen !== 'lobby' && state.screen !== 'sessionReadout';
}

/* The shipped claim library. A pack loaded from a URL fragment (T10) replaces
   it for that session only. */
const BUILT_IN_CLAIMS = rawClaims as Claim[];

interface GameContextValue {
  state: GameState;
  dispatch: Dispatch<Action>;
  /** What this session is playing from. */
  claims: Claim[];
  /** Deal a fresh round and enter the route. */
  startRound: () => void;
  /** Finish this round and deal the next one. */
  nextRound: () => void;
  /** T7 — polling status against the room, meaningless while offline. */
  roomStatus: RoomSyncStatus;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  /* Computed once, synchronously, before the first render — so a resumable
     round shows the resume prompt immediately instead of flashing the lobby
     and then swapping to it. */
  const [pendingRestore, setPendingRestore] = useState<GameState | null>(() => {
    const loaded = loadState();
    return loaded && isResumable(loaded) ? loaded : null;
  });

  const [state, rawDispatch] = useReducer(gameReducer, initialState);

  /* T7 — room sync bookkeeping. `hasSyncedOnce` guards the push effect below:
     a room's creator has nothing to receive, so it may push immediately, but
     a joiner must wait for the first poll before pushing anything, or its
     still-blank local state would race the host's and might overwrite it. */
  const hasSyncedOnceRef = useRef(false);
  const lastAppliedSeqRef = useRef(-1);

  const dispatch = useCallback<Dispatch<Action>>((action) => {
    rawDispatch(action);
    /* "New game" is the other explicit clear point besides the resume prompt's
       "start fresh", which clears directly where it's dispatched below. */
    if (action.type === 'NEW_GAME') clearState();
    if (action.type === 'JOIN_ROOM') {
      hasSyncedOnceRef.current = action.isHost;
      lastAppliedSeqRef.current = -1;
    }
  }, []);

  const roomStatus = useRoomSync({
    code: state.room.code,
    enabled: !!state.room.code,
    onSnapshot: useCallback(
      (snapshot) => {
        hasSyncedOnceRef.current = true;
        if (snapshot.seq <= lastAppliedSeqRef.current) return;
        lastAppliedSeqRef.current = snapshot.seq;
        dispatch({ type: 'SYNC_ROOM_STATE', payload: snapshot });
      },
      [dispatch],
    ),
  });

  /* Push the shared slice of state to the room, debounced, whenever it
     changes — the doc's "optimistic local update on submit, reconciled by
     the next poll." Best-effort: a failed push just waits for the next
     state change or the next poll to catch up, same as a dropped hop. */
  const roomPushTimeout = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const { code, playerId } = state.room;
    if (!code || !playerId || !hasSyncedOnceRef.current) return undefined;

    clearTimeout(roomPushTimeout.current);
    roomPushTimeout.current = setTimeout(() => {
      const shared: SharedGameState = {
        screen: state.screen,
        settings: state.settings,
        round: state.round,
        session: state.session,
        briefSeen: state.briefSeen,
        packClaims: state.packClaims,
      };
      sendRoomAction(code, playerId, { type: 'SYNC_GAME_STATE', payload: shared })
        .then((snapshot) => {
          if (snapshot.seq > lastAppliedSeqRef.current) lastAppliedSeqRef.current = snapshot.seq;
        })
        .catch(() => {
          /* Next state change or poll retries — never block on a dropped push. */
        });
    }, ROOM_PUSH_DEBOUNCE_MS);
    return () => clearTimeout(roomPushTimeout.current);
  }, [state]);

  /* Save on every state change, debounced so rapid dispatches don't thrash
     sessionStorage. Nothing to save while a resume decision is pending — the
     live state is still the placeholder `initialState`, and saving it now
     would clobber the round waiting to be resumed. */
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (pendingRestore) return;
    clearTimeout(saveTimeout.current);
    if (state.screen === 'sessionReadout') {
      clearState();
      return;
    }
    saveTimeout.current = setTimeout(() => saveState(state), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(saveTimeout.current);
  }, [state, pendingRestore]);

  const claims = state.packClaims?.length ? state.packClaims : BUILT_IN_CLAIMS;

  const startRound = useCallback(() => {
    dispatch({ type: 'BEGIN_ROUND', setup: prepareRound(state, claims) });
  }, [state, claims, dispatch]);

  const nextRound = useCallback(() => {
    /* prepareRound reads results and settings, neither of which NEXT_ROUND
       touches, so computing the setup from current state is safe. */
    const setup = prepareRound(state, claims);
    dispatch({ type: 'NEXT_ROUND' });
    dispatch({ type: 'BEGIN_ROUND', setup });
  }, [state, claims, dispatch]);

  const value = useMemo<GameContextValue>(
    () => ({ state, dispatch, claims, startRound, nextRound, roomStatus }),
    [state, claims, startRound, nextRound, dispatch, roomStatus],
  );

  if (pendingRestore) {
    return (
      <GameContext.Provider value={value}>
        <ResumePrompt
          onContinue={() => {
            dispatch({ type: 'RESTORE_STATE', state: pendingRestore });
            setPendingRestore(null);
          }}
          onStartFresh={() => {
            clearState();
            dispatch({ type: 'CLEAR_SAVED_STATE' });
            setPendingRestore(null);
          }}
        />
      </GameContext.Provider>
    );
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}

/** Read-only convenience. Screens read from context and dispatch actions. */
export function useGameState(): GameState {
  return useGame().state;
}

export function useGameDispatch(): Dispatch<Action> {
  return useGame().dispatch;
}

/**
 * Screens whose feature has not been built yet call this to step straight to
 * the next screen in the route. That is what keeps the full route registered
 * from day one without any later task editing the router.
 *
 * Pass your own ScreenId whenever you call this from an effect. StrictMode
 * runs effects twice, and an unguarded ADVANCE steps two screens — which is
 * how CROWD RECALL silently lost its distribute beat.
 */
export function useAdvance(from?: ScreenId): () => void {
  const dispatch = useGameDispatch();
  return useCallback(() => dispatch({ type: 'ADVANCE', from }), [dispatch, from]);
}
