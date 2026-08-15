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
  /** Opaque shared game payload. Shape settles in the simultaneous-chains phase. */
  game: unknown;
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

export async function getRoom(code: string): Promise<RoomRecord | null> {
  return readRoom(code.toUpperCase());
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
 * `SYNC_GAME_STATE` is the only action semantics this phase defines: the
 * room is a shared blob, and the payload replaces it wholesale, last write
 * wins. Real per-action reducing (simultaneous chains, host force-advance,
 * conflict resolution) lands in later phases — see docs/T7.
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
  const game = action.type === 'SYNC_GAME_STATE' ? action.payload : record.game;

  const updated: RoomRecord = { ...record, players, game, updatedAt: now, seq: record.seq + 1 };
  await saveRoom(updated);
  return updated;
}

/**
 * What a client is allowed to see. Nothing sensitive to strip yet — reserved
 * for T8, which must never let `hop.isImposter` reach a client before the
 * reveal.
 */
export function toPublicSnapshot(record: RoomRecord) {
  const { code, hostId, players, createdAt, updatedAt, expiresAt, seq, game } = record;
  return { code, hostId, players, createdAt, updatedAt, expiresAt, seq, game };
}
