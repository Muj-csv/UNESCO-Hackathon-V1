import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Claim } from '../../src/types/contracts';
import {
  ROOM_TTL_MS,
  addPlayer,
  applyAction,
  beginSimRound,
  cleanName,
  createRoom,
  forceAdvanceSimRound,
  getRoom,
  toPublicSnapshot,
} from './roomStore';

const CLAIMS: Claim[] = [
  {
    id: 'test-claim',
    topic: 'Test',
    lang: 'en',
    originalText: 'Original text.',
    atoms: {
      SOURCE: { truth: 't' },
      NUMBER: { truth: 't' },
      HEDGE: { truth: 't' },
      SCOPE: { truth: 't' },
      CAUSE: { truth: 't' },
    },
    degraded: { SOURCE: 'x', NUMBER: 'x', HEDGE: 'x', SCOPE: 'x', CAUSE: 'x' },
  },
];

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
      simView: null,
    });
  });

  it('includes a per-player simView once a simultaneous round is active', async () => {
    const { record: created } = await createRoom('Ana');
    const { record: withBen, playerId: ben } = await addPlayer(created, 'Ben');
    const withRound = await beginSimRound(withBen, CLAIMS, ['chars'], 30);

    const snapshot = toPublicSnapshot(withRound, ben);
    expect(snapshot.simView?.status).toBe('active');
  });

  it('leaves simView null when no playerId is supplied', async () => {
    const { record: created } = await createRoom('Ana');
    const { record: withBen } = await addPlayer(created, 'Ben');
    const withRound = await beginSimRound(withBen, CLAIMS, ['chars'], 30);

    expect(toPublicSnapshot(withRound).simView).toBeNull();
  });
});

describe('simultaneous rounds via the room', () => {
  async function tworoom() {
    const { record: created, playerId: ana } = await createRoom('Ana');
    const { record: withBen, playerId: ben } = await addPlayer(created, 'Ben');
    return { ana, ben, room: withBen };
  }

  it('beginSimRound seats one chain per player and persists it', async () => {
    const { room, ana } = await tworoom();
    const started = await beginSimRound(room, CLAIMS, ['chars'], 30);
    expect(started.simRound?.chains).toHaveLength(2);

    const fetched = await getRoom(started.code);
    expect(fetched?.simRound?.chains).toHaveLength(2);
    expect(toPublicSnapshot(fetched!, ana).simView?.status).toBe('active');
  });

  it('SUBMIT_CHAIN_HOP advances the submitting player’s chain', async () => {
    const { room, ana, ben } = await tworoom();
    const started = await beginSimRound(room, CLAIMS, ['chars'], 30);

    const afterAna = await applyAction(started, ana, {
      type: 'SUBMIT_CHAIN_HOP',
      payload: { text: 'Ana wrote this.' },
    });
    expect(afterAna.simRound?.tick).toBe(0); // Ben hasn't gone yet this wave
    expect(toPublicSnapshot(afterAna, ana).simView?.status).toBe('waiting');
    expect(toPublicSnapshot(afterAna, ben).simView?.status).toBe('active');

    const afterBenWave0 = await applyAction(afterAna, ben, {
      type: 'SUBMIT_CHAIN_HOP',
      payload: { text: 'Ben wrote this.' },
    });
    expect(afterBenWave0.simRound?.tick).toBe(1); // wave 0 done, not finished — 2 players need 2 ticks
    expect(afterBenWave0.simRound?.finished).toBe(false);

    const afterAnaWave1 = await applyAction(afterBenWave0, ana, {
      type: 'SUBMIT_CHAIN_HOP',
      payload: { text: 'Ana again.' },
    });
    const afterBenWave1 = await applyAction(afterAnaWave1, ben, {
      type: 'SUBMIT_CHAIN_HOP',
      payload: { text: 'Ben again.' },
    });
    expect(afterBenWave1.simRound?.finished).toBe(true);
  });

  it('SUBMIT_CHAIN_HOP is ignored when no simRound is active', async () => {
    const { room, ana } = await tworoom();
    const result = await applyAction(room, ana, { type: 'SUBMIT_CHAIN_HOP', payload: { text: 'x' } });
    expect(result.simRound).toBeNull();
  });

  it('forceAdvanceSimRound fills the current wave immediately', async () => {
    const { room } = await tworoom();
    const started = await beginSimRound(room, CLAIMS, ['chars'], 300);
    const forced = await forceAdvanceSimRound(started);
    expect(forced.simRound?.tick).toBe(1);
  });

  afterEach(() => vi.useRealTimers());

  it('getRoom lazily catches up an overdue wave and persists the result', async () => {
    const { room } = await tworoom();
    const started = await beginSimRound(room, CLAIMS, ['chars'], 5);

    vi.useFakeTimers();
    vi.setSystemTime(started.simRound!.waveStartedAt + 60_000);

    const fetched = await getRoom(started.code);
    expect(fetched?.simRound?.tick).toBeGreaterThan(0);

    vi.useRealTimers();
    const fetchedAgain = await getRoom(started.code);
    expect(fetchedAgain?.simRound?.tick).toBe(fetched?.simRound?.tick); // persisted, not recomputed from scratch
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
