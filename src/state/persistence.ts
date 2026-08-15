import type { GameState } from '../types/contracts';
import { STATE_VERSION } from './gameReducer';

/* ============================================================================
   OWNER: T5 (session persistence).

   Reserved path — signatures are the contract T5 builds against.

   On a phone being passed round a room, one back-swipe, one low-memory tab
   reclaim, or one accidental refresh destroys a five-hop round with no
   recovery. This will happen in a classroom, and it can happen in a demo.

   T5:
   - sessionStorage, NOT localStorage. State must not survive a closed tab —
     a classroom device gets handed to a different group, and a stale game is
     worse than none. It also keeps the no-persistent-user-data claim clean.
   - Discard on version mismatch rather than rehydrating a stale shape.
   - Strip transient fields (timer handles, in-flight requests).
   - Wrap every call in try/catch. Private browsing throws on storage access,
     and a storage failure must never break the game.
   - Do not restore silently. Ask: "You have a round in progress. Continue
     where you left off?" — the previous group may have left.
   ========================================================================== */

export const STORAGE_KEY = 'truthchain:session';

interface Envelope {
  version: number;
  state: GameState;
}

export function saveState(_state: GameState): void {
  /* T5: serialise { version: STATE_VERSION, state } under STORAGE_KEY. */
  void STATE_VERSION;
}

export function loadState(): GameState | null {
  /* T5: parse, check version, return null on mismatch or any failure. */
  return null;
}

export function clearState(): void {
  /* T5: remove STORAGE_KEY. Called on "start fresh" and session completion. */
}

export type { Envelope };
