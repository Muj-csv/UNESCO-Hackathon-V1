/* ============================================================================
   OWNER: T7 (rooms and simultaneous play).

   Vercel serverless function holding ephemeral room state, polled by clients
   every ~1.5s. See src/state/roomProtocol.ts for the wire types and
   src/state/room.ts for the client transport.

   This is one file, not a folder of dynamic routes (the task doc's
   `:code/join`-style paths are conceptual — see roomProtocol.ts for why the
   real shape uses `?op=`):

     POST /api/room                          create → { code, playerId, room }
     POST /api/room?code=XXXX&op=join        { name } → { playerId, room }
     GET  /api/room?code=XXXX[&playerId=Y]   full room state   ← polled
     POST /api/room?code=XXXX&op=act         { playerId, action } → room
     POST /api/room?code=XXXX&op=beginSim    { playerId, cardIds, timerSeconds } → room  (host only)
     POST /api/room?code=XXXX&op=forceAdvance { playerId } → room                        (host only)

   `playerId` on the GET is what makes the per-player `simView` in the
   snapshot possible (see roomStore.ts's `toPublicSnapshot`) — the whole
   point of simultaneous chains is that different devices are shown
   different things from the same room.

   ── Constraints ──
   - Rooms expire after 4 hours. No accounts, no history, nothing identifying
     beyond the display names players type. That claim does real work in the
     proposal, so keep it true (see api/_lib/roomStore.ts).
   - hop.isImposter must NEVER appear in a client payload before the reveal.
     `toPublicSnapshot` is the one chokepoint for that — T8 filters there.
   ========================================================================== */

import type { CardId } from '../src/types/contracts';
import { CARDS } from '../src/data/cards.js';
import rawClaims from '../src/data/claims.en.json' with { type: 'json' };
import {
  addPlayer,
  applyAction,
  beginSimRound,
  cleanName,
  createRoom,
  forceAdvanceSimRound,
  getRoom,
  toPublicSnapshot,
} from './_lib/roomStore.js';

const CLAIMS = rawClaims as import('../src/types/contracts').Claim[];
const VALID_CARD_IDS = new Set(Object.keys(CARDS));
const DEFAULT_TIMER_SECONDS = 60;
const MIN_TIMER_SECONDS = 15;
const MAX_TIMER_SECONDS = 180;

function cleanCardIds(raw: unknown): CardId[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is CardId => typeof id === 'string' && VALID_CARD_IDS.has(id));
}

function cleanTimerSeconds(raw: unknown): number {
  const n = typeof raw === 'number' ? Math.round(raw) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_TIMER_SECONDS;
  return Math.min(MAX_TIMER_SECONDS, Math.max(MIN_TIMER_SECONDS, n));
}

function sendError(res: any, status: number, error: string, message: string): void {
  res.status(status).json({ error, message });
}

async function readBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req: any, res: any) {
  try {
    const url = new URL(req.url ?? '/', 'http://internal');
    const code = (url.searchParams.get('code') || '').toUpperCase().trim();
    const op = url.searchParams.get('op');
    const method = req.method ?? 'GET';

    /* POST /api/room — create */
    if (method === 'POST' && !code) {
      const body = await readBody(req);
      const name = cleanName(body?.name);
      if (!name) return sendError(res, 400, 'invalid_name', 'A display name is required.');

      const { record, playerId } = await createRoom(name);
      return res.status(200).json({ code: record.code, playerId, room: toPublicSnapshot(record) });
    }

    if (!code) return sendError(res, 400, 'missing_code', 'A room code is required.');

    /* GET /api/room?code=XXXX[&playerId=Y] — polled snapshot */
    if (method === 'GET') {
      const record = await getRoom(code);
      if (!record) return sendError(res, 404, 'not_found', 'No room with that code.');
      const playerId = url.searchParams.get('playerId') ?? undefined;
      return res.status(200).json(toPublicSnapshot(record, playerId));
    }

    if (method !== 'POST') return sendError(res, 405, 'method_not_allowed', 'Unsupported method.');

    /* POST /api/room?code=XXXX&op=join */
    if (op === 'join') {
      const body = await readBody(req);
      const name = cleanName(body?.name);
      if (!name) return sendError(res, 400, 'invalid_name', 'A display name is required.');

      const record = await getRoom(code);
      if (!record) return sendError(res, 404, 'not_found', 'No room with that code.');

      const { record: updated, playerId } = await addPlayer(record, name);
      return res.status(200).json({ playerId, room: toPublicSnapshot(updated) });
    }

    /* POST /api/room?code=XXXX&op=act */
    if (op === 'act') {
      const body = await readBody(req);
      const playerId = typeof body?.playerId === 'string' ? body.playerId : null;
      const action = body?.action;
      if (!playerId || !action || typeof action.type !== 'string') {
        return sendError(res, 400, 'invalid_action', 'playerId and action.type are required.');
      }

      const record = await getRoom(code);
      if (!record) return sendError(res, 404, 'not_found', 'No room with that code.');
      if (!record.players.some((p) => p.id === playerId)) {
        return sendError(res, 403, 'not_in_room', 'That player is not in this room.');
      }

      const updated = await applyAction(record, playerId, action);
      return res.status(200).json(toPublicSnapshot(updated, playerId));
    }

    /* POST /api/room?code=XXXX&op=beginSim — host-only, starts a
       simultaneous round (see api/_lib/simRound.ts). */
    if (op === 'beginSim') {
      const body = await readBody(req);
      const playerId = typeof body?.playerId === 'string' ? body.playerId : null;
      if (!playerId) return sendError(res, 400, 'invalid_request', 'playerId is required.');

      const record = await getRoom(code);
      if (!record) return sendError(res, 404, 'not_found', 'No room with that code.');
      if (record.hostId !== playerId) return sendError(res, 403, 'not_host', 'Only the host can start a round.');

      const cardIds = cleanCardIds(body?.cardIds);
      const timerSeconds = cleanTimerSeconds(body?.timerSeconds);
      const updated = await beginSimRound(record, CLAIMS, cardIds, timerSeconds);
      return res.status(200).json(toPublicSnapshot(updated, playerId));
    }

    /* POST /api/room?code=XXXX&op=forceAdvance — host-only. */
    if (op === 'forceAdvance') {
      const body = await readBody(req);
      const playerId = typeof body?.playerId === 'string' ? body.playerId : null;
      if (!playerId) return sendError(res, 400, 'invalid_request', 'playerId is required.');

      const record = await getRoom(code);
      if (!record) return sendError(res, 404, 'not_found', 'No room with that code.');
      if (record.hostId !== playerId) return sendError(res, 403, 'not_host', 'Only the host can force-advance.');

      const updated = await forceAdvanceSimRound(record);
      return res.status(200).json(toPublicSnapshot(updated, playerId));
    }

    return sendError(res, 404, 'not_found', 'Unknown room operation.');
  } catch (error) {
    /* Server-side only — this lands in the Vercel function log and never in
       the response, which stays the same opaque shape it always was. A room
       that breaks at 9am on a Saturday should not need a redeploy to say why. */
    console.error('[api/room]', error);
    return sendError(res, 500, 'server_error', 'Something went wrong.');
  }
}
