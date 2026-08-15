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

export interface RoomPlayerPublic {
  id: string;
  name: string;
  isHost: boolean;
  /** False once the server hasn't heard from this player in a while. */
  connected: boolean;
}

/**
 * Server-authoritative room snapshot as seen by a client. Never carries
 * `hop.isImposter` before the reveal — the server strips it per player.
 *
 * `game` is `unknown` here (not `GameState`) because what a room actually
 * syncs — one shared round vs. N parallel chains — is decided in the
 * simultaneous-chains phase. Phase 1 only needs players/host/lifecycle.
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
  game: unknown;
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
