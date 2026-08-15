import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { Claim, GameState, ScreenId } from '../types/contracts';
import type { Action } from './gameReducer';
import { gameReducer, initialState, prepareRound } from './gameReducer';
import { clearState, loadState, saveState } from './persistence';
import { beginSimRound as beginSimRoundRequest, sendRoomAction, useRoomSync } from './room';
import type { RoomSyncStatus } from './room';
import type { SharedGameState } from './roomProtocol';
import { projectSimView } from './simultaneousRound';
import { textInFrontOfPlayer } from './gameReducer';
import { getCard } from '../data/cards';
import ResumePrompt from '../components/ResumePrompt';
import rawClaims from '../data/claims.en.json';
import { PackDecodeError, decodePack, readPackFragment } from '../engine/packCodec';

const SAVE_DEBOUNCE_MS = 300;
/* Separate, shorter debounce for pushing to the room — a round in progress
   changes state more often than the sessionStorage save needs to react to,
   and other devices are waiting on this one to move. */
const ROOM_PUSH_DEBOUNCE_MS = 150;
/* T7 failure handling: how much longer than a hop's own timer the host waits
   before assuming a player's device is gone and auto-submitting on their
   behalf. Generous, because the real per-device timer (Round.tsx) and a poll
   round-trip both get to run first — this is the backstop for when neither
   of those ever fires (nobody ever claimed the stuck player's turn). */
const HOST_WATCHDOG_GRACE_SECONDS = 15;

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
  /** T7 — this room's round is a simultaneous chain being driven by
      per-player projections, not the single-shared-round mechanism. */
  simRoundActive: boolean;
  /** T10 — result of loading a pack found in the URL fragment on boot, if
      any. Null once there is nothing left to say about it. */
  packNotice: PackNotice | null;
  dismissPackNotice: () => void;
}

/** T10. */
export interface PackNotice {
  kind: 'loaded' | 'error';
  message: string;
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
  /* Simultaneous chains: whether this room's round is being driven by
     per-player `simView` projections (see simultaneousRound.ts) rather than
     the single-shared-blob mechanism above. A ref because it's read
     synchronously inside the stable poll callback below; mirrored into
     state so RoomStatusBar can show wave progress and repurpose its
     force-advance control. */
  const simRoundActiveRef = useRef(false);
  const [simRoundActive, setSimRoundActive] = useState(false);
  const lastPushedHopCountRef = useRef(0);
  /* Always-fresh state for the stable callbacks below, which intentionally
     don't depend on `state` directly — that would restart the poll's effect
     (and its backoff/focus-listener setup) on every single render. */
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback<Dispatch<Action>>((action) => {
    rawDispatch(action);
    /* "New game" is the other explicit clear point besides the resume prompt's
       "start fresh", which clears directly where it's dispatched below. */
    if (action.type === 'NEW_GAME') clearState();
    if (action.type === 'JOIN_ROOM') {
      hasSyncedOnceRef.current = action.isHost;
      lastAppliedSeqRef.current = -1;
      simRoundActiveRef.current = false;
      setSimRoundActive(false);
      lastPushedHopCountRef.current = 0;
    }
  }, []);

  const roomStatus = useRoomSync({
    code: state.room.code,
    playerId: state.room.playerId,
    enabled: !!state.room.code,
    onSnapshot: useCallback(
      (snapshot) => {
        hasSyncedOnceRef.current = true;
        const view = snapshot.simView;

        if (view && view.status !== 'not-in-round') {
          const s = stateRef.current;
          const me = snapshot.players.find((p) => p.id === s.room.playerId) ?? {
            id: s.room.playerId ?? '',
            name: '',
          };
          const projection = projectSimView(view, me, snapshot.players, {
            settings: s.settings,
            session: s.session,
            briefSeen: s.briefSeen,
            packClaims: s.packClaims,
          });
          if (projection) {
            if (!simRoundActiveRef.current) {
              lastPushedHopCountRef.current = projection.game.round.hops.length;
            }
            simRoundActiveRef.current = true;
            setSimRoundActive(true);
            dispatch({ type: 'SYNC_ROOM_STATE', payload: { players: projection.players, game: projection.game } });
            return;
          }
        }

        if (snapshot.seq <= lastAppliedSeqRef.current) return;
        lastAppliedSeqRef.current = snapshot.seq;
        dispatch({ type: 'SYNC_ROOM_STATE', payload: snapshot });
      },
      [dispatch],
    ),
  });

  /* Push local changes to the room, debounced — the doc's "optimistic local
     update on submit, reconciled by the next poll." Best-effort: a failed
     push just waits for the next state change or the next poll to catch up,
     same as a dropped hop.

     Two different things get pushed depending on the round: a simultaneous
     round only ever needs this player's own newly-submitted hop forwarded
     as `SUBMIT_CHAIN_HOP` (the server, not this push, owns chain/wave
     assignment); anything else — including a simultaneous round that
     hasn't started yet — pushes the whole shared blob, unchanged from
     phase 3/4. */
  const roomPushTimeout = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const { code, playerId } = state.room;
    if (!code || !playerId || !hasSyncedOnceRef.current) return undefined;

    clearTimeout(roomPushTimeout.current);
    roomPushTimeout.current = setTimeout(() => {
      if (simRoundActiveRef.current) {
        const hopCount = state.round.hops.length;
        if (hopCount <= lastPushedHopCountRef.current) return;
        const text = state.round.hops[hopCount - 1]?.text ?? '';
        lastPushedHopCountRef.current = hopCount; // optimistic — avoids re-firing while in flight
        sendRoomAction(code, playerId, { type: 'SUBMIT_CHAIN_HOP', payload: { text } }).catch(() => {
          lastPushedHopCountRef.current = hopCount - 1; // let the next change or poll retry
        });
        return;
      }

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

  /* T7 failure handling: "if a player is gone at timeout, their hop
     auto-submits unchanged and the chain continues." Round.tsx's own timer
     only starts once someone on some device taps "I'm <player>" — if the
     player whose turn it is has no device in the room at all, nothing ever
     starts that timer anywhere. The host's context runs this as a backstop:
     one hop, one timer, restarted whenever `currentHop` changes, cleared by
     the effect's own cleanup the moment the hop actually advances (from a
     real submission, force-advance, or a previous firing of this same
     watchdog). Skipped for the machine's hop — AIHopBeat is unconditional
     (mounts on every device, no handoff to wait on) and already has its own
     fallback path; firing here too would race it with the wrong text.

     Also skipped entirely once a simultaneous round is active: that mode
     has its own server-side lazy timeout (simRound.ts's `applyTimeouts`,
     checked on every poll from *any* player, not just the host), and this
     watchdog's plain `SUBMIT_HOP` dispatch would write straight into the
     locally-projected virtual round instead of going through
     `SUBMIT_CHAIN_HOP` — corrupting it rather than advancing it. */
  useEffect(() => {
    const isMachineHop = state.round.aiHopIndexes.includes(state.round.currentHop);
    if (
      !state.room.isHost ||
      !state.room.code ||
      simRoundActive ||
      state.screen !== 'round' ||
      !state.round.claim ||
      isMachineHop ||
      state.round.currentHop >= state.settings.chainLength
    ) {
      return undefined;
    }

    const cardId = state.round.dealtCards[state.round.currentHop];
    const timerSeconds = (cardId && getCard(cardId)?.timerOverride) ?? state.settings.timerSeconds;
    const budgetMs = (timerSeconds + HOST_WATCHDOG_GRACE_SECONDS) * 1000;

    const timer = window.setTimeout(() => {
      dispatch({ type: 'SUBMIT_HOP', text: textInFrontOfPlayer(state) });
    }, budgetMs);
    return () => window.clearTimeout(timer);
  }, [
    dispatch,
    state,
    state.room.isHost,
    state.room.code,
    simRoundActive,
    state.screen,
    state.round.currentHop,
    state.round.claim,
    state.settings.timerSeconds,
    state.settings.chainLength,
  ]);

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

  /* T10 — a pack shared as a link arrives in the URL fragment, which never
     touches the server. Handled once per load: StrictMode's double effect
     would otherwise decode (and toast) it twice. The hash is cleared right
     after so a refresh doesn't reapply it and so an in-progress round saved
     under T5 isn't shadowed by a stale link sitting in the address bar. */
  const [packNotice, setPackNotice] = useState<PackNotice | null>(null);
  const packUrlHandledRef = useRef(false);
  useEffect(() => {
    if (packUrlHandledRef.current) return;
    packUrlHandledRef.current = true;
    const value = readPackFragment(window.location.hash);
    if (!value) return;

    decodePack(value)
      .then((loaded) => {
        dispatch({ type: 'LOAD_PACK', claims: loaded });
        setPackNotice({
          kind: 'loaded',
          message: `Loaded a shared pack — ${loaded.length} claim${loaded.length === 1 ? '' : 's'}. Start a round from the lobby to play it.`,
        });
      })
      .catch((err) => {
        setPackNotice({
          kind: 'error',
          message: err instanceof PackDecodeError ? err.message : 'This pack link could not be read.',
        });
      })
      .finally(() => {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      });
  }, [dispatch]);

  const startRound = useCallback(() => {
    /* T7: a room in chain mode runs a simultaneous round (see
       simultaneousRound.ts) — the host asks the server to start it, and
       every device (including this one) picks up its own assignment on the
       next poll. Crowd recall and pass-and-play are untouched: crowd has no
       chain to run in parallel, and pass-and-play never had a room to ask. */
    const { code, playerId, isHost } = state.room;
    if (code && playerId && isHost && state.settings.mode === 'chain') {
      beginSimRoundRequest(code, playerId, state.settings.cardIds, state.settings.timerSeconds).catch(() => {
        /* Best-effort — RoomStatusBar's connection indicator already
           surfaces trouble; the host can just try again. */
      });
      return;
    }
    dispatch({ type: 'BEGIN_ROUND', setup: prepareRound(state, claims) });
  }, [state, claims, dispatch]);

  const nextRound = useCallback(() => {
    /* prepareRound reads results and settings, neither of which NEXT_ROUND
       touches, so computing the setup from current state is safe. */
    const setup = prepareRound(state, claims);
    dispatch({ type: 'NEXT_ROUND' });
    dispatch({ type: 'BEGIN_ROUND', setup });
  }, [state, claims, dispatch]);

  const dismissPackNotice = useCallback(() => setPackNotice(null), []);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      dispatch,
      claims,
      startRound,
      nextRound,
      roomStatus,
      simRoundActive,
      packNotice,
      dismissPackNotice,
    }),
    [state, claims, startRound, nextRound, dispatch, roomStatus, simRoundActive, packNotice, dismissPackNotice],
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

  /* RoomStatusBar used to be mounted here so it could sit above every screen.
     It is now rendered by AppShell instead, which puts it under the top bar
     where a system message belongs — and lets it read `screen` to decide
     whether it has anything to say at all. */
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
