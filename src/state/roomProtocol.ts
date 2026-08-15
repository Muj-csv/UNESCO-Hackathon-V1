/* ============================================================================
   OWNER: T7 (rooms and simultaneous play).

   Wire protocol shared between the client transport (`room.ts`) and the
   serverless endpoint (`api/room.ts`). Kept separate from `types/contracts.ts`
   because that file is frozen — these shapes are T7's alone to change.

   `api/room.ts` is a single file (see docs/T7), not a folder of dynamic
   routes, so sub-operations are addressed with a `?op=` query param rather
   than the `:code/join`-style paths sketched in the task doc. Same shape,
   one file.
   ========================================================================== */

import type { CardId, Claim, GameState, Hop } from '../types/contracts';

export interface RoomPlayerPublic {
  id: string;
  name: string;
  isHost: boolean;
  /** False once the server hasn't heard from this player in a while. */
  connected: boolean;
}

/**
 * The slice of `GameState` a room syncs across devices. Connection info
 * (`room`) and the player roster (`players`, sourced from the room's own
 * join records — see `RoomSnapshot.players`) are deliberately excluded;
 * they're owned elsewhere and would fight the server for authority.
 *
 * This is single-chain today. N-parallel simultaneous chains (the biggest
 * piece of T7) will very likely reshape `round` here — see docs/T7.
 */
export type SharedGameState = Pick<
  GameState,
  'screen' | 'settings' | 'round' | 'session' | 'briefSeen' | 'packClaims'
>;

export function isSharedGameState(value: unknown): value is SharedGameState {
  return !!value && typeof value === 'object' && 'screen' in value && 'settings' in value;
}

/**
 * A player's own view into a simultaneous-chains round (see
 * api/_lib/simRound.ts, which is what actually computes this) — never
 * another player's in-progress chain. `hopIndex`/`tick` are the same
 * number: which wave this is.
 */
export type SimAssignmentView =
  | {
      status: 'active';
      tick: number;
      totalTicks: number;
      claim: Claim;
      hops: Hop[];
      dealtCards: (CardId | null)[];
      hopIndex: number;
    }
  | { status: 'waiting'; tick: number; totalTicks: number }
  | { status: 'finished'; tick: number; totalTicks: number; finalChain: { claim: Claim; hops: Hop[]; dealtCards: (CardId | null)[] } }
  | { status: 'not-in-round' };

/**
 * Server-authoritative room snapshot as seen by a client. Never carries
 * `hop.isImposter` before the reveal — the server strips it per player.
 */
export interface RoomSnapshot {
  code: string;
  hostId: string;
  players: RoomPlayerPublic[];
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  /** Bumped on every accepted action, so a client can tell state moved on. */
  seq: number;
  game: SharedGameState | null;
  /** Only populated when the GET that produced this snapshot supplied a
      playerId and a simultaneous round is active — see room.ts. */
  simView: SimAssignmentView | null;
}

export interface CreateRoomResponse {
  code: string;
  playerId: string;
  room: RoomSnapshot;
}

export interface JoinRoomResponse {
  playerId: string;
  room: RoomSnapshot;
}

export interface RoomErrorBody {
  error: string;
  message: string;
}

/** A client-originated mutation, forwarded to the server and echoed back via SYNC_ROOM_STATE. */
export interface RoomAction {
  type: string;
  payload?: unknown;
}
