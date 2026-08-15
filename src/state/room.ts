/* ============================================================================
   OWNER: T7 (rooms and simultaneous play).

   Client-side transport for multiplayer rooms: fetch wrappers over
   `api/room.ts`, plus `useRoomSync`, the poll loop. No game-state reducing
   happens here — that's `gameReducer`'s `JOIN_ROOM` / `SYNC_ROOM_STATE`
   cases. This module only moves bytes.

   Polling, not WebSockets — see docs/T7-rooms-and-simultaneous-play.md.
   A 1.5s interval is imperceptible for a turn-based game with ~30s between
   real updates, and it sidesteps reconnection state machines on flaky
   campus wifi, which is exactly where the users are.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardId } from '../types/contracts';
import type {
  CreateRoomResponse,
  JoinRoomResponse,
  RoomAction,
  RoomErrorBody,
  RoomSnapshot,
} from './roomProtocol';

export const POLL_INTERVAL_MS = 1500;
export const MAX_BACKOFF_MS = 15000;
export const ROOM_CODE_LENGTH = 4;

/* ------------------------------------------------------------- fetch layer */

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body as RoomErrorBody | null;
    throw new Error(err?.message ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export async function createRoom(name: string): Promise<CreateRoomResponse> {
  const res = await fetch('/api/room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return parseJson<CreateRoomResponse>(res);
}

export async function joinRoom(code: string, name: string): Promise<JoinRoomResponse> {
  const res = await fetch(`/api/room?code=${encodeURIComponent(code)}&op=join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return parseJson<JoinRoomResponse>(res);
}

/** `playerId` is what makes `snapshot.simView` come back populated — see
    roomProtocol.ts. Omit it for a bare pre-join lookup. */
export async function fetchRoom(code: string, playerId?: string): Promise<RoomSnapshot> {
  const qs = playerId ? `&playerId=${encodeURIComponent(playerId)}` : '';
  const res = await fetch(`/api/room?code=${encodeURIComponent(code)}${qs}`);
  return parseJson<RoomSnapshot>(res);
}

export async function sendRoomAction(
  code: string,
  playerId: string,
  action: RoomAction,
): Promise<RoomSnapshot> {
  const res = await fetch(`/api/room?code=${encodeURIComponent(code)}&op=act`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, action }),
  });
  return parseJson<RoomSnapshot>(res);
}

/** Host-only. Starts a simultaneous-chains round — see api/_lib/simRound.ts. */
export async function beginSimRound(
  code: string,
  playerId: string,
  cardIds: CardId[],
  timerSeconds: number,
): Promise<RoomSnapshot> {
  const res = await fetch(`/api/room?code=${encodeURIComponent(code)}&op=beginSim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, cardIds, timerSeconds }),
  });
  return parseJson<RoomSnapshot>(res);
}

/** Host-only. Fills the current wave immediately rather than waiting out its timer. */
export async function forceAdvanceSimRound(code: string, playerId: string): Promise<RoomSnapshot> {
  const res = await fetch(`/api/room?code=${encodeURIComponent(code)}&op=forceAdvance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId }),
  });
  return parseJson<RoomSnapshot>(res);
}

/* --------------------------------------------------------------- helpers -- */

/** Doubles the previous wait, capped, for retry after a failed poll. */
export function nextBackoff(current: number): number {
  if (current <= 0) return POLL_INTERVAL_MS;
  return Math.min(current * 2, MAX_BACKOFF_MS);
}

export function isValidRoomCode(code: string): boolean {
  return new RegExp(`^[A-Z]{${ROOM_CODE_LENGTH}}$`).test(code.trim().toUpperCase());
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

/* --------------------------------------------------------------- polling -- */

export type RoomSyncStatus = 'connecting' | 'connected' | 'error';

interface UseRoomSyncOptions {
  code: string | null;
  /** Passed through to the GET so `snapshot.simView` comes back populated. */
  playerId: string | null;
  /** Poll only while true — off in pass-and-play, off once a room is abandoned. */
  enabled: boolean;
  onSnapshot: (snapshot: RoomSnapshot) => void;
}

/**
 * Polls `GET /api/room?code=...` every `POLL_INTERVAL_MS` while `enabled`.
 * Backs off exponentially on failure and resets on the next success, then
 * re-polls immediately on window focus — a phone's screen locking mid-round
 * on campus wifi shouldn't leave the room waiting out a stale backoff after
 * it wakes back up.
 */
export function useRoomSync({ code, playerId, enabled, onSnapshot }: UseRoomSyncOptions): RoomSyncStatus {
  const [status, setStatus] = useState<RoomSyncStatus>('connecting');
  const backoffRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;

  const poll = useCallback(async (roomCode: string, id: string | null) => {
    try {
      const snapshot = await fetchRoom(roomCode, id ?? undefined);
      backoffRef.current = 0;
      setStatus('connected');
      onSnapshotRef.current(snapshot);
    } catch {
      backoffRef.current = nextBackoff(backoffRef.current);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!enabled || !code) return undefined;
    let cancelled = false;

    const tick = () => {
      poll(code, playerId).finally(() => {
        if (cancelled) return;
        timerRef.current = setTimeout(tick, backoffRef.current || POLL_INTERVAL_MS);
      });
    };
    tick();

    const onFocus = () => {
      clearTimeout(timerRef.current);
      backoffRef.current = 0;
      tick();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, [code, playerId, enabled, poll]);

  return status;
}
