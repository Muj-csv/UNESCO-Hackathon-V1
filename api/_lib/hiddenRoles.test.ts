import { beforeEach, describe, expect, it } from 'vitest';
import { addPlayer, applyAction, createRoom, toPublicSnapshot } from './roomStore';
import type { RoomRecord } from './roomStore';

/* ==========================================================================
   T8 in a room.

   BAD FAITH hides one thing, and a room hands every device the same polled
   blob. Without a filter the imposter is one DevTools tab away from being
   public and the mode is over before the argument starts.

   The filter alone would be worse than nothing, though: every client pushes
   the whole shared state back, so a device that was never shown the imposter
   would write that absence over the server's copy. Both halves are tested
   here, in the order they bite.
   ========================================================================== */

const gameWith = ({ round = {}, ...over }: Record<string, any> = {}) => ({
  screen: 'round',
  settings: { mode: 'badfaith' },
  session: { results: [], roundNumber: 1 },
  briefSeen: true,
  packClaims: null,
  ...over,
  round: {
    claim: { id: 'rainfall-alerts' },
    accusation: null,
    imposter: { player: 'Ben', hopIndex: 2, targetAtom: 'HEDGE' },
    hops: [
      { player: 'Ana', text: 'One.', cardId: 'land' },
      { player: 'Ben', text: 'Two.', cardId: 'certain' },
      { player: 'Ben', text: 'Three.', cardId: 'land', isImposter: true },
    ],
    ...round,
  },
});

describe('what a room lets a player see', () => {
  let room: RoomRecord;
  let ana: string;
  let ben: string;

  beforeEach(async () => {
    const created = await createRoom('Ana');
    ana = created.playerId;
    const joined = await addPlayer(created.record, 'Ben');
    ben = joined.playerId;
    room = await applyAction(joined.record, ana, { type: 'SYNC_GAME_STATE', payload: gameWith() });
  });

  it('shows the imposter their own assignment', () => {
    const snapshot = toPublicSnapshot(room, ben);
    expect((snapshot.game as any).round.imposter).toEqual({
      player: 'Ben',
      hopIndex: 2,
      targetAtom: 'HEDGE',
    });
  });

  it('shows everybody else nothing', () => {
    expect((toPublicSnapshot(room, ana).game as any).round.imposter).toBeNull();
  });

  it('shows a snapshot with no player context nothing', () => {
    expect((toPublicSnapshot(room).game as any).round.imposter).toBeNull();
  });

  /* An explicit `isImposter: false` on exactly one hop would be a signpost,
     so the key is dropped rather than falsified. */
  it('never marks which hop it was, not even to the imposter', () => {
    for (const viewer of [ana, ben, undefined]) {
      const hops = (toPublicSnapshot(room, viewer).game as any).round.hops;
      expect(hops.some((h: any) => 'isImposter' in h)).toBe(false);
    }
  });

  it('hands everything over once the room has voted', async () => {
    const voted = await applyAction(room, ana, {
      type: 'SYNC_GAME_STATE',
      payload: gameWith({ round: { accusation: 'Cara' } }),
    });
    const seen = toPublicSnapshot(voted, ana).game as any;
    expect(seen.round.imposter).not.toBeNull();
    expect(seen.round.hops[2].isImposter).toBe(true);
  });

  /* Nothing to hide, so nothing is touched — a chain round's snapshot is the
     stored state, byte for byte. */
  it('leaves an ordinary chain round completely alone', async () => {
    const chain = await applyAction(room, ana, {
      type: 'SYNC_GAME_STATE',
      payload: gameWith({
        settings: { mode: 'chain' },
        round: { imposter: null, hops: [{ player: 'Ana', text: 'One.', cardId: 'land' }] },
      }),
    });
    expect(toPublicSnapshot(chain, ana).game).toEqual((chain as any).game);
  });

  /* Switching out of bad faith must not leave a role behind, even mid-round:
     CROWD RECALL in particular must never have one. */
  it('drops the role when the room changes mode', async () => {
    const crowd = await applyAction(room, ana, {
      type: 'SYNC_GAME_STATE',
      payload: gameWith({ settings: { mode: 'crowd' }, round: { imposter: null } }),
    });
    expect((crowd.game as any).round.imposter).toBeNull();
  });
});

describe('what a room accepts back from a player', () => {
  let room: RoomRecord;
  let ana: string;

  beforeEach(async () => {
    const created = await createRoom('Ana');
    ana = created.playerId;
    const joined = await addPlayer(created.record, 'Ben');
    room = await applyAction(joined.record, ana, { type: 'SYNC_GAME_STATE', payload: gameWith() });
  });

  /* The whole reason the filter needs a partner: Ana never saw the imposter,
     so her next push carries none, and last-write-wins would delete it. */
  it('keeps the role when a redacted device pushes state back', async () => {
    const asAnaSawIt = toPublicSnapshot(room, ana).game;
    const after = await applyAction(room, ana, { type: 'SYNC_GAME_STATE', payload: asAnaSawIt });
    expect((after.game as any).round.imposter).toEqual({
      player: 'Ben',
      hopIndex: 2,
      targetAtom: 'HEDGE',
    });
  });

  it('re-marks the hop the pushing device could not see', async () => {
    const asAnaSawIt = toPublicSnapshot(room, ana).game;
    const after = await applyAction(room, ana, { type: 'SYNC_GAME_STATE', payload: asAnaSawIt });
    const hops = (after.game as any).round.hops;
    expect(hops[2].isImposter).toBe(true);
    expect(hops.filter((h: any) => h.isImposter)).toHaveLength(1);
  });

  it('takes a new deal at its word, including one with no imposter', async () => {
    const nextRound = gameWith({
      session: { results: [], roundNumber: 2 },
      round: { imposter: null, claim: { id: 'class-start-times' }, hops: [] },
    });
    const after = await applyAction(room, ana, { type: 'SYNC_GAME_STATE', payload: nextRound });
    expect((after.game as any).round.imposter).toBeNull();
  });

  it('lets a new imposter replace the old one within the same round', async () => {
    const reassigned = gameWith({
      round: { imposter: { player: 'Ana', hopIndex: 1, targetAtom: 'SCOPE' } },
    });
    const after = await applyAction(room, ana, { type: 'SYNC_GAME_STATE', payload: reassigned });
    expect((after.game as any).round.imposter.player).toBe('Ana');
  });
});
