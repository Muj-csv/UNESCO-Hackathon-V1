import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { Claim, GameState, ScreenId } from '../types/contracts';
import type { Action } from './gameReducer';
import { gameReducer, initialState, prepareRound } from './gameReducer';
import rawClaims from '../data/claims.en.json';

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
  /* T5 mounts persistence here: load before first render so there is no flash
     of the lobby, and save on change, debounced. */
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const claims = state.packClaims?.length ? state.packClaims : BUILT_IN_CLAIMS;

  const startRound = useCallback(() => {
    dispatch({ type: 'BEGIN_ROUND', setup: prepareRound(state, claims) });
  }, [state, claims]);

  const nextRound = useCallback(() => {
    /* prepareRound reads results and settings, neither of which NEXT_ROUND
       touches, so computing the setup from current state is safe. */
    const setup = prepareRound(state, claims);
    dispatch({ type: 'NEXT_ROUND' });
    dispatch({ type: 'BEGIN_ROUND', setup });
  }, [state, claims]);

  const value = useMemo<GameContextValue>(
    () => ({ state, dispatch, claims, startRound, nextRound }),
    [state, claims, startRound, nextRound],
  );

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
