import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ROOM_TTL_MS,
  addPlayer,
  applyAction,
  cleanName,
  createRoom,
  getRoom,
  toPublicSnapshot,
} from './roomStore';

/* ==========================================================================
   No UPSTASH_REDIS_REST_URL / TOKEN in the test env, so every case here
   exercises the in-process Map fallback — which is also what local dev runs
   against. Production behavior against real Upstash is the same code path
   through the Redis client and isn't covered by unit tests.
   ========================================================================== */

describe('createRoom', () => {
  it('returns a four-letter code and seats the creator as host', async () => {
    const { record, playerId } = await createRoom('Ana');

    expect(record.code).toMatch(/^[A-Z]{4}$/);
    expect(record.hostId).toBe(playerId);
    expect(record.players).toHaveLength(1);
    expect(record.players[0]).toMatchObject({ id: playerId, name: 'Ana', isHost: true });
    expect(record.seq).toBe(0);
    expect(record.expiresAt - record.createdAt).toBe(ROOM_TTL_MS);
  });

  it('is retrievable by getRoom in either case', async () => {
    const { record } = await createRoom('Ben');

    expect(await getRoom(record.code)).toEqual(record);
    expect(await getRoom(record.code.toLowerCase())).toEqual(record);
  });

  it('returns null for a code nobody created', async () => {
    expect(await getRoom('ZZZZ')).toBeNull();
  });
});

describe('addPlayer', () => {
  it('appends a non-host player and bumps seq', async () => {
    const { record: created } = await createRoom('Ana');
    const { record: updated, playerId } = await addPlayer(created, 'Ben');

    expect(updated.players).toHaveLength(2);
    expect(updated.players[1]).toMatchObject({ id: playerId, name: 'Ben', isHost: false });
    expect(updated.seq).toBe(created.seq + 1);
    expect(updated.hostId).toBe(created.hostId);
  });

  it('persists the join so a fresh read sees it', async () => {
    const { record: created } = await createRoom('Ana');
    await addPlayer(created, 'Ben');

    const fetched = await getRoom(created.code);
    expect(fetched?.players).toHaveLength(2);
  });
});

describe('applyAction', () => {
  it('replaces game state on SYNC_GAME_STATE and bumps seq', async () => {
    const { record, playerId } = await createRoom('Ana');
    const updated = await applyAction(record, playerId, { type: 'SYNC_GAME_STATE', payload: { screen: 'round' } });

    expect(updated.game).toEqual({ screen: 'round' });
    expect(updated.seq).toBe(record.seq + 1);
  });

  it('leaves game state untouched for an action it does not recognize', async () => {
    const { record, playerId } = await createRoom('Ana');
    const first = await applyAction(record, playerId, { type: 'SYNC_GAME_STATE', payload: { screen: 'round' } });
    const second = await applyAction(first, playerId, { type: 'HEARTBEAT' });

    expect(second.game).toEqual(first.game);
    expect(second.seq).toBe(first.seq + 1);
  });

  it('marks the acting player connected and touches lastSeenAt', async () => {
    const { record, playerId } = await createRoom('Ana');
    const before = record.players[0].lastSeenAt;

    vi.useFakeTimers();
    vi.setSystemTime(before + 5000);
    const updated = await applyAction(record, playerId, { type: 'HEARTBEAT' });
    vi.useRealTimers();

    expect(updated.players[0].connected).toBe(true);
    expect(updated.players[0].lastSeenAt).toBe(before + 5000);
  });
});

describe('toPublicSnapshot', () => {
  it('carries the fields a client needs and nothing more', async () => {
    const { record } = await createRoom('Ana');
    const snapshot = toPublicSnapshot(record);

    expect(snapshot).toEqual({
      code: record.code,
      hostId: record.hostId,
      players: record.players,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      expiresAt: record.expiresAt,
      seq: record.seq,
      game: record.game,
    });
  });
});

describe('cleanName', () => {
  it('trims and caps length', () => {
    expect(cleanName('  Ana  ')).toBe('Ana');
    expect(cleanName('x'.repeat(30))).toBe('x'.repeat(20));
  });

  it('rejects empty or non-string input', () => {
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('')).toBeNull();
    expect(cleanName(42)).toBeNull();
    expect(cleanName(undefined)).toBeNull();
  });
});

describe('room expiry', () => {
  afterEach(() => vi.useRealTimers());

  it('is gone once the TTL has passed', async () => {
    const { record } = await createRoom('Ana');

    vi.useFakeTimers();
    vi.setSystemTime(record.createdAt + ROOM_TTL_MS + 1000);

    expect(await getRoom(record.code)).toBeNull();
  });
});
