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

export function saveState(state: GameState): void {
  try {
    const envelope: Envelope = { version: STATE_VERSION, state };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    /* Private browsing, quota exceeded, storage disabled — never break the game. */
  }
}

export function loadState(): GameState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as Envelope;
    if (envelope.version !== STATE_VERSION) return null;
    if (!envelope.state) return null;
    return envelope.state;
  } catch {
    return null;
  }
}

export function clearState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Storage access can throw in private browsing — nothing to do here. */
  }
}

export type { Envelope };
