/* ============================================================================
   OWNER: T7 (rooms and simultaneous play).

   Server-side room storage for api/room.ts. Underscore-prefixed folders are
   excluded from Vercel's file-based routing, so this file is a plain module,
   never its own endpoint.

   Backed by Upstash Redis (REST API — works from a serverless function
   without holding a connection open) when UPSTASH_REDIS_REST_URL and
   UPSTASH_REDIS_REST_TOKEN are set. Falls back to an in-process Map
   otherwise, which is enough to exercise the API shape locally but does NOT
   share state across serverless instances or survive a cold start — do not
   rely on it in production. Provision a real Upstash Redis instance (Vercel
   Marketplace integration, or directly at upstash.com) and set those two env
   vars on the Vercel project before rooms work for real across devices.
   ========================================================================== */

import { Redis } from '@upstash/redis';
import type { CardId, Claim } from '../../src/types/contracts';
import type { SharedGameState } from '../../src/state/roomProtocol';
import type { SimRound } from './simRound';
import { applyTimeouts, forceAdvanceWave, startSimRound, submitChainHop, viewForPlayer } from './simRound';
import type { SimAssignmentView } from './simRound';

export const ROOM_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours — see docs/T7
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O — avoids look-alikes on a shared screen
const CODE_LENGTH = 4;
const MAX_NAME_LENGTH = 20;
const MAX_CODE_ATTEMPTS = 10;

export interface RoomPlayerRecord {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  lastSeenAt: number;
}

export interface RoomRecord {
  code: string;
  hostId: string;
  players: RoomPlayerRecord[];
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  /** Bumped on every accepted mutation, so a client can tell state moved on. */
  seq: number;
  /** Opaque shared game payload — the single-shared-round mechanism from
      phase 3/4. Still what drives crowd recall and lobby/menu screens; a
      client with an active `simRound` ignores this for the round itself
      and reads its per-player assignment instead (see `simView`, below). */
  game: unknown;
  /** Simultaneous chains (see simRound.ts). Null outside a chain-mode round. */
  simRound: SimRound | null;
}

export type RoomAction = { type: string; payload?: unknown };

/* --------------------------------------------------------------- storage -- */

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redisClient = url && token ? new Redis({ url, token }) : null;
  return redisClient;
}

/** Dev/demo fallback only — see file header. One process, no persistence. */
const memoryStore = new Map<string, RoomRecord>();

function storeKey(code: string): string {
  return `truthchain:room:${code}`;
}

async function readRoom(code: string): Promise<RoomRecord | null> {
  const client = getRedis();
  if (client) {
    const record = await client.get<RoomRecord>(storeKey(code));
    return record ?? null;
  }
  const record = memoryStore.get(code) ?? null;
  if (record && record.expiresAt < Date.now()) {
    memoryStore.delete(code);
    return null;
  }
  return record;
}

/** Persists with a TTL matching the room's fixed 4-hour lifetime, not a sliding one. */
async function saveRoom(record: RoomRecord): Promise<void> {
  const client = getRedis();
  const ttlSeconds = Math.max(1, Math.ceil((record.expiresAt - Date.now()) / 1000));
  if (client) {
    await client.set(storeKey(record.code), record, { ex: ttlSeconds });
    return;
  }
  memoryStore.set(record.code, record);
}

/* ------------------------------------------------------------- lifecycle -- */

function randomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function randomPlayerId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed || null;
}

/** Catches an active `simRound` up on any missed waves before returning it,
    persisting the result — the same lazy-timeout pattern as room expiry.
    Every read goes through this, so a stale wave gets caught up whether it's
    discovered by a poll or by an action. */
async function withSimTimeouts(record: RoomRecord): Promise<RoomRecord> {
  if (!record.simRound) return record;
  const advanced = applyTimeouts(record.simRound);
  if (advanced === record.simRound) return record;
  const updated: RoomRecord = { ...record, simRound: advanced, updatedAt: Date.now(), seq: record.seq + 1 };
  await saveRoom(updated);
  return updated;
}

export async function getRoom(code: string): Promise<RoomRecord | null> {
  const record = await readRoom(code.toUpperCase());
  if (!record) return null;
  return withSimTimeouts(record);
}

/** Retries on the rare code collision rather than trusting one draw. */
export async function createRoom(name: string): Promise<{ record: RoomRecord; playerId: string }> {
  const playerId = randomPlayerId();
  const now = Date.now();

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomCode();
    if (await readRoom(code)) continue;

    const record: RoomRecord = {
      code,
      hostId: playerId,
      players: [{ id: playerId, name, isHost: true, connected: true, lastSeenAt: now }],
      createdAt: now,
      updatedAt: now,
      expiresAt: now + ROOM_TTL_MS,
      seq: 0,
      game: null,
      simRound: null,
    };
    await saveRoom(record);
    return { record, playerId };
  }
  throw new Error('Could not allocate a room code — try again.');
}

export async function addPlayer(
  record: RoomRecord,
  name: string,
): Promise<{ record: RoomRecord; playerId: string }> {
  const playerId = randomPlayerId();
  const now = Date.now();
  const player: RoomPlayerRecord = { id: playerId, name, isHost: false, connected: true, lastSeenAt: now };
  const updated: RoomRecord = {
    ...record,
    players: [...record.players, player],
    updatedAt: now,
    seq: record.seq + 1,
  };
  await saveRoom(updated);
  return { record: updated, playerId };
}

/**
 * Starts a simultaneous-chains round: one chain per player, seeded from
 * `claimsPool`, per simRound.ts. Overwrites any previous `simRound` — the
 * caller (api/room.ts) is what checks this is the host asking.
 */
export async function beginSimRound(
  record: RoomRecord,
  claimsPool: Claim[],
  cardIds: CardId[],
  timerSeconds: number,
): Promise<RoomRecord> {
  const players = record.players.map((p) => ({ id: p.id, name: p.name }));
  const simRound = startSimRound(players, claimsPool, cardIds, timerSeconds);
  const updated: RoomRecord = { ...record, simRound, updatedAt: Date.now(), seq: record.seq + 1 };
  await saveRoom(updated);
  return updated;
}

/** Host-only "force advance" for a simultaneous round — fills the current
    wave immediately rather than waiting out its deadline. The caller checks
    the host precondition, same as `beginSimRound`. */
export async function forceAdvanceSimRound(record: RoomRecord): Promise<RoomRecord> {
  if (!record.simRound) return record;
  const simRound = forceAdvanceWave(record.simRound);
  if (simRound === record.simRound) return record;
  const updated: RoomRecord = { ...record, simRound, updatedAt: Date.now(), seq: record.seq + 1 };
  await saveRoom(updated);
  return updated;
}

/**
 * `SYNC_GAME_STATE` replaces the shared blob wholesale, last write wins —
 * the single-shared-round mechanism from phase 3/4, still used for crowd
 * recall and menu-level state. `SUBMIT_CHAIN_HOP` instead applies to
 * whichever chain `playerId` is currently assigned to in `simRound`
 * (simRound.ts validates the assignment; a stale or repeated submission is
 * a no-op, not an error).
 */
export async function applyAction(
  record: RoomRecord,
  playerId: string,
  action: RoomAction,
): Promise<RoomRecord> {
  const now = Date.now();
  const players = record.players.map((p) =>
    p.id === playerId ? { ...p, connected: true, lastSeenAt: now } : p,
  );

  let game = record.game;
  let simRound = record.simRound;
  if (action.type === 'SYNC_GAME_STATE') {
    /* Wholesale replace, except for what this client was never shown — see
       preserveHiddenRoles. Without it the first push from a redacted device
       deletes the imposter for the whole room. */
    game = preserveHiddenRoles(record.game as SharedGameState | null, action.payload as SharedGameState);
  } else if (action.type === 'SUBMIT_CHAIN_HOP' && simRound) {
    const text = typeof (action.payload as { text?: unknown })?.text === 'string'
      ? (action.payload as { text: string }).text
      : '';
    simRound = submitChainHop(simRound, playerId, text);
  }

  const updated: RoomRecord = { ...record, players, game, simRound, updatedAt: now, seq: record.seq + 1 };
  await saveRoom(updated);
  return updated;
}

/* ------------------------------------------------------ T8 hidden roles -- */
/* BAD FAITH hides one thing from everyone but its owner, and the room polls a
   shared blob — so without this the imposter is one DevTools tab away from
   being public, and the mode is over before the argument starts.

   Both directions are needed. Stripping alone would be worse than not
   stripping: every client pushes the whole shared blob back with
   SYNC_GAME_STATE, so the first poll from a stripped device would write
   `imposter: null` over the server's copy and quietly delete the role. */

/** Everything hidden is visible again the moment the room has voted. */
function rolesAreRevealed(game: SharedGameState | null): boolean {
  return !!game?.round?.accusation;
}

/**
 * One player's view of the round's hidden roles.
 *
 * The imposter sees their own assignment, because that is how their brief is
 * written. Everybody else sees `imposter: null`, and nobody sees which hop
 * carries `isImposter` until the accusation is in.
 */
function redactRolesFor(
  game: SharedGameState | null,
  players: RoomPlayerRecord[],
  playerId?: string,
): SharedGameState | null {
  if (!game?.round?.imposter || rolesAreRevealed(game)) return game;

  const me = players.find((p) => p.id === playerId)?.name ?? null;
  const isTheirs = game.round.imposter.player === me;

  return {
    ...game,
    round: {
      ...game.round,
      imposter: isTheirs ? game.round.imposter : null,
      /* Drop the key rather than set it false — an explicit `false` on
         exactly one hop would be as good as a signpost. */
      hops: game.round.hops.map(({ isImposter: _hidden, ...hop }) => hop),
    },
  };
}

/**
 * Keep the server's copy of the hidden role when a client that could not see
 * it pushes state back.
 *
 * A push carrying an imposter is trusted — that is the device that dealt the
 * round, or the imposter's own. A push from a redacted device is missing one,
 * and for the same round the server's own assignment wins.
 */
function preserveHiddenRoles(
  previous: SharedGameState | null,
  incoming: SharedGameState,
): SharedGameState {
  const held = previous?.round?.imposter;
  if (!held || incoming.round?.imposter) return incoming;

  /* Only BAD FAITH has a role to protect. A push that says the room is now
     playing something else is a mode change, and holding a stale imposter
     against it would resurrect one in a mode that must not have one. */
  if (incoming.settings?.mode !== 'badfaith') return incoming;

  /* A new deal owns its own roles, including having none at all. */
  const sameRound =
    previous?.session?.roundNumber === incoming.session?.roundNumber &&
    previous?.round?.claim?.id === incoming.round?.claim?.id;
  if (!sameRound) return incoming;

  return {
    ...incoming,
    round: {
      ...incoming.round,
      imposter: held,
      /* Re-stamp the hop too: the pushing client had it stripped, so without
         this the ledger's deliberate/accidental split would come out empty. */
      hops: incoming.round.hops.map((hop, i) =>
        i === held.hopIndex ? { ...hop, isImposter: true } : hop,
      ),
    },
  };
}

/**
 * What a client is allowed to see.
 *
 * `playerId` is optional (a bare GET with no player context still needs a
 * snapshot, e.g. before joining) — `simView` is only computed when it's
 * supplied, and stays `null` for a room with no active simultaneous round.
 * A snapshot with no player context is treated as nobody's, so it never
 * carries the imposter.
 */
export function toPublicSnapshot(record: RoomRecord, playerId?: string) {
  const { code, hostId, players, createdAt, updatedAt, expiresAt, seq, game, simRound } = record;
  const simView: SimAssignmentView | null = simRound && playerId ? viewForPlayer(simRound, playerId) : null;
  return {
    code,
    hostId,
    players,
    createdAt,
    updatedAt,
    expiresAt,
    seq,
    game: redactRolesFor(game as SharedGameState | null, players, playerId),
    simView,
  };
}
