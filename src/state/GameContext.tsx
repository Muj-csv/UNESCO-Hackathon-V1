import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { Claim, GameState, ScreenId } from '../types/contracts';
import type { Action } from './gameReducer';
import { gameReducer, initialState, prepareRound } from './gameReducer';
import { clearState, loadState, saveState } from './persistence';
import ResumePrompt from '../components/ResumePrompt';
import rawClaims from '../data/claims.en.json';

const SAVE_DEBOUNCE_MS = 300;

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

  const dispatch = useCallback<Dispatch<Action>>((action) => {
    rawDispatch(action);
    /* "New game" is the other explicit clear point besides the resume prompt's
       "start fresh", which clears directly where it's dispatched below. */
    if (action.type === 'NEW_GAME') clearState();
  }, []);

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
    () => ({ state, dispatch, claims, startRound, nextRound }),
    [state, claims, startRound, nextRound, dispatch],
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
