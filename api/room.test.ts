import { describe, expect, it } from 'vitest';
import handler from './room';

/* ==========================================================================
   Drives the actual handler (not just roomStore) with hand-rolled req/res
   doubles, since Vercel's Node runtime isn't running in this test process.
   Exercises the routing/query-param dispatch in api/room.ts end to end
   against the in-memory store fallback (no Upstash env vars in test env).
   ========================================================================== */

function mockReq(method: string, url: string, body?: unknown) {
  return { method, url, body };
}

function mockRes() {
  const res: { statusCode: number; body: unknown; status: (n: number) => typeof res; json: (b: unknown) => typeof res } = {
    statusCode: 0,
    body: undefined,
    status(n: number) {
      res.statusCode = n;
      return res;
    },
    json(b: unknown) {
      res.body = b;
      return res;
    },
  };
  return res;
}

describe('api/room handler', () => {
  it('creates a room, returns a code and playerId', async () => {
    const res = mockRes();
    await handler(mockReq('POST', '/api/room', { name: 'Ana' }), res);

    expect(res.statusCode).toBe(200);
    const body = res.body as { code: string; playerId: string; room: { players: unknown[] } };
    expect(body.code).toMatch(/^[A-Z]{4}$/);
    expect(body.playerId).toBeTruthy();
    expect(body.room.players).toHaveLength(1);
  });

  it('rejects create with a blank name', async () => {
    const res = mockRes();
    await handler(mockReq('POST', '/api/room', { name: '   ' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('joins an existing room by code', async () => {
    const createRes = mockRes();
    await handler(mockReq('POST', '/api/room', { name: 'Ana' }), createRes);
    const { code } = createRes.body as { code: string };

    const joinRes = mockRes();
    await handler(mockReq('POST', `/api/room?code=${code}&op=join`, { name: 'Ben' }), joinRes);

    expect(joinRes.statusCode).toBe(200);
    const body = joinRes.body as { playerId: string; room: { players: { name: string }[] } };
    expect(body.room.players.map((p) => p.name)).toEqual(['Ana', 'Ben']);
  });

  it('404s a join against a code nobody created', async () => {
    const res = mockRes();
    await handler(mockReq('POST', '/api/room?code=ZZZZ&op=join', { name: 'Ben' }), res);
    expect(res.statusCode).toBe(404);
  });

  it('gets the current snapshot by code, lowercase or upper', async () => {
    const createRes = mockRes();
    await handler(mockReq('POST', '/api/room', { name: 'Ana' }), createRes);
    const { code } = createRes.body as { code: string };

    const getRes = mockRes();
    await handler(mockReq('GET', `/api/room?code=${code.toLowerCase()}`), getRes);

    expect(getRes.statusCode).toBe(200);
    expect((getRes.body as { code: string }).code).toBe(code);
  });

  it('applies a SYNC_GAME_STATE action and reflects it on the next GET', async () => {
    const createRes = mockRes();
    await handler(mockReq('POST', '/api/room', { name: 'Ana' }), createRes);
    const { code, playerId } = createRes.body as { code: string; playerId: string };

    const actRes = mockRes();
    await handler(
      mockReq('POST', `/api/room?code=${code}&op=act`, {
        playerId,
        action: { type: 'SYNC_GAME_STATE', payload: { screen: 'round' } },
      }),
      actRes,
    );
    expect(actRes.statusCode).toBe(200);
    expect((actRes.body as { game: unknown }).game).toEqual({ screen: 'round' });

    const getRes = mockRes();
    await handler(mockReq('GET', `/api/room?code=${code}`), getRes);
    expect((getRes.body as { game: unknown }).game).toEqual({ screen: 'round' });
  });

  it('rejects an act from a playerId not in the room', async () => {
    const createRes = mockRes();
    await handler(mockReq('POST', '/api/room', { name: 'Ana' }), createRes);
    const { code } = createRes.body as { code: string };

    const actRes = mockRes();
    await handler(
      mockReq('POST', `/api/room?code=${code}&op=act`, {
        playerId: 'not-a-real-player',
        action: { type: 'HEARTBEAT' },
      }),
      actRes,
    );
    expect(actRes.statusCode).toBe(403);
  });

  it('404s a GET for an unknown code', async () => {
    const res = mockRes();
    await handler(mockReq('GET', '/api/room?code=ZZZZ'), res);
    expect(res.statusCode).toBe(404);
  });
});
