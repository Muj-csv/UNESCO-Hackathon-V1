import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_BACKOFF_MS,
  POLL_INTERVAL_MS,
  createRoom,
  fetchRoom,
  isValidRoomCode,
  joinRoom,
  nextBackoff,
  normalizeRoomCode,
  sendRoomAction,
} from './room';

/* ==========================================================================
   Pure/fetch-layer coverage only. `useRoomSync` itself needs a DOM and a
   React test renderer, neither of which this project pulls in — its retry
   and focus-resume logic is exercised end to end in Phase 4's failure-
   handling pass instead (see docs/T7).
   ========================================================================== */

describe('nextBackoff', () => {
  it('starts at the base poll interval', () => {
    expect(nextBackoff(0)).toBe(POLL_INTERVAL_MS);
  });

  it('doubles on each failure', () => {
    let wait = nextBackoff(0);
    wait = nextBackoff(wait);
    expect(wait).toBe(POLL_INTERVAL_MS * 2);
  });

  it('caps at the maximum', () => {
    let wait = 0;
    for (let i = 0; i < 20; i++) wait = nextBackoff(wait);
    expect(wait).toBe(MAX_BACKOFF_MS);
  });
});

describe('room code helpers', () => {
  it('accepts four-letter codes case-insensitively', () => {
    expect(isValidRoomCode('ABCD')).toBe(true);
    expect(isValidRoomCode('abcd')).toBe(true);
    expect(isValidRoomCode(' aBcD ')).toBe(true);
  });

  it('rejects anything that is not exactly four letters', () => {
    expect(isValidRoomCode('ABC')).toBe(false);
    expect(isValidRoomCode('ABCDE')).toBe(false);
    expect(isValidRoomCode('AB12')).toBe(false);
    expect(isValidRoomCode('')).toBe(false);
  });

  it('normalizes to trimmed uppercase', () => {
    expect(normalizeRoomCode(' abcd ')).toBe('ABCD');
  });
});

describe('fetch layer', () => {
  const jsonResponse = (body: unknown, ok = true, status = 200) => ({
    ok,
    status,
    json: () => Promise.resolve(body),
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('createRoom posts a name and returns the parsed body', async () => {
    const body = { code: 'ABCD', playerId: 'p1', room: {} };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(body));

    const result = await createRoom('Ana');

    expect(fetch).toHaveBeenCalledWith(
      '/api/room',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Ana' }) }),
    );
    expect(result).toEqual(body);
  });

  it('joinRoom hits the join op for the given code', async () => {
    const body = { playerId: 'p2', room: {} };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(body));

    await joinRoom('abcd', 'Ben');

    expect(fetch).toHaveBeenCalledWith(
      '/api/room?code=abcd&op=join',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Ben' }) }),
    );
  });

  it('fetchRoom issues a plain GET for the snapshot', async () => {
    const body = { code: 'ABCD' };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(body));

    const result = await fetchRoom('ABCD');

    expect(fetch).toHaveBeenCalledWith('/api/room?code=ABCD');
    expect(result).toEqual(body);
  });

  it('sendRoomAction posts the action for the act op', async () => {
    const body = { code: 'ABCD', seq: 3 };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(body));

    const result = await sendRoomAction('ABCD', 'p1', { type: 'SUBMIT_HOP', payload: { text: 'hi' } });

    expect(fetch).toHaveBeenCalledWith(
      '/api/room?code=ABCD&op=act',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ playerId: 'p1', action: { type: 'SUBMIT_HOP', payload: { text: 'hi' } } }),
      }),
    );
    expect(result).toEqual(body);
  });

  it('throws the server-provided message on a non-ok response', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: 'not_found', message: 'No room with that code.' }, false, 404),
    );

    await expect(fetchRoom('ZZZZ')).rejects.toThrow('No room with that code.');
  });

  it('falls back to a generic message when the error body is unparseable', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('bad json')),
    });

    await expect(fetchRoom('ZZZZ')).rejects.toThrow('Request failed (500)');
  });
});
