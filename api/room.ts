/* ============================================================================
   OWNER: T7 (rooms and simultaneous play).

   Vercel serverless function holding ephemeral room state, polled by clients
   every ~1.5s. See src/state/roomProtocol.ts for the wire types and
   src/state/room.ts for the client transport.

   This is one file, not a folder of dynamic routes (the task doc's
   `:code/join`-style paths are conceptual — see roomProtocol.ts for why the
   real shape uses `?op=`):

     POST /api/room                        create → { code, playerId, room }
     POST /api/room?code=XXXX&op=join      { name } → { playerId, room }
     GET  /api/room?code=XXXX              full room state   ← polled
     POST /api/room?code=XXXX&op=act       { playerId, action } → room

   ── Constraints ──
   - Rooms expire after 4 hours. No accounts, no history, nothing identifying
     beyond the display names players type. That claim does real work in the
     proposal, so keep it true (see api/_lib/roomStore.ts).
   - hop.isImposter must NEVER appear in a client payload before the reveal.
     `toPublicSnapshot` is the one chokepoint for that — T8 filters there.
   ========================================================================== */

import { addPlayer, applyAction, cleanName, createRoom, getRoom, toPublicSnapshot } from './_lib/roomStore';

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

    /* GET /api/room?code=XXXX — polled snapshot */
    if (method === 'GET') {
      const record = await getRoom(code);
      if (!record) return sendError(res, 404, 'not_found', 'No room with that code.');
      return res.status(200).json(toPublicSnapshot(record));
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
      return res.status(200).json(toPublicSnapshot(updated));
    }

    return sendError(res, 404, 'not_found', 'Unknown room operation.');
  } catch {
    return sendError(res, 500, 'server_error', 'Something went wrong.');
  }
}
