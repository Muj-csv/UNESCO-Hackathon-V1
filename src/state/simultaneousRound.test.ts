import { describe, expect, it } from 'vitest';
import type { Claim } from '../types/contracts';
import { initialState, settingsForPreset } from './gameReducer';
import type { RoomPlayerPublic, SimAssignmentView } from './roomProtocol';
import { projectSimView } from './simultaneousRound';

function claim(id: string): Claim {
  return {
    id,
    topic: 'Test',
    lang: 'en',
    originalText: `Original for ${id}.`,
    atoms: {
      SOURCE: { truth: 't' },
      NUMBER: { truth: 't' },
      HEDGE: { truth: 't' },
      SCOPE: { truth: 't' },
      CAUSE: { truth: 't' },
    },
    degraded: { SOURCE: 'x', NUMBER: 'x', HEDGE: 'x', SCOPE: 'x', CAUSE: 'x' },
  };
}

const me = { id: 'p0', name: 'Ana' };
const roster: RoomPlayerPublic[] = [
  { id: 'p0', name: 'Ana', isHost: true, connected: true },
  { id: 'p1', name: 'Ben', isHost: false, connected: true },
  { id: 'p2', name: 'Cara', isHost: false, connected: true },
];
const base = {
  settings: settingsForPreset('standard', 'chain'),
  session: initialState.session,
  briefSeen: true,
  packClaims: null,
};

describe('projectSimView', () => {
  it('returns null for a player not in the round, so callers fall back untouched', () => {
    expect(projectSimView({ status: 'not-in-round' }, me, roster, base)).toBeNull();
  });

  it('active: collapses players to just me, so the existing turn-gate always resolves to me', () => {
    const view: SimAssignmentView = {
      status: 'active',
      tick: 1,
      totalTicks: 3,
      claim: claim('a'),
      hops: [{ player: 'Ben', text: 'x', cardId: null }],
      dealtCards: ['chars', 'land', null],
      hopIndex: 1,
    };
    const projection = projectSimView(view, me, roster, base)!;

    expect(projection.players).toEqual([me]);
    expect(projection.game.screen).toBe('round');
    expect(projection.game.round.claim?.id).toBe('a');
    expect(projection.game.round.hops).toEqual(view.hops);
    expect(projection.game.round.currentHop).toBe(1);
    // gameReducer's SUBMIT_HOP compares currentHop to chainLength to decide
    // when to advance to terminal — must be the round's real per-chain
    // length (totalTicks), not whatever the lobby's setting says.
    expect(projection.game.settings.chainLength).toBe(3);
  });

  it('active: never carries another chain — no AI hops, no imposter, no verification budget in this pass', () => {
    const view: SimAssignmentView = {
      status: 'active',
      tick: 0,
      totalTicks: 2,
      claim: claim('a'),
      hops: [],
      dealtCards: [null, null],
      hopIndex: 0,
    };
    const projection = projectSimView(view, me, roster, base)!;
    expect(projection.game.round.aiHopIndexes).toEqual([]);
    expect(projection.game.round.imposter).toBeNull();
    expect(projection.game.round.verificationsLeft).toBe(0);
  });

  it('waiting: blanks the claim (Round.tsx already renders nothing for that) but keeps wave progress readable', () => {
    const view: SimAssignmentView = { status: 'waiting', tick: 1, totalTicks: 4 };
    const projection = projectSimView(view, me, roster, base)!;

    expect(projection.players).toEqual([me]);
    expect(projection.game.round.claim).toBeNull();
    expect(projection.game.round.currentHop).toBe(1);
    expect(projection.game.settings.chainLength).toBe(4);
  });

  it('finished: restores the real roster and hands off to terminal with the revealed chain', () => {
    const finalHops = [
      { player: 'Ana', text: 'one', cardId: null },
      { player: 'Ben', text: 'two', cardId: null },
      { player: 'Cara', text: 'three', cardId: null },
    ];
    const view: SimAssignmentView = {
      status: 'finished',
      tick: 3,
      totalTicks: 3,
      finalChain: { claim: claim('b'), hops: finalHops, dealtCards: [null, null, null] },
    };
    const projection = projectSimView(view, me, roster, base)!;

    expect(projection.players).toEqual([
      { id: 'p0', name: 'Ana' },
      { id: 'p1', name: 'Ben' },
      { id: 'p2', name: 'Cara' },
    ]);
    expect(projection.game.screen).toBe('terminal');
    expect(projection.game.round.hops).toEqual(finalHops);
    expect(projection.game.round.currentHop).toBe(3);
  });

  it('carries settings/session/briefSeen/packClaims through unchanged apart from chainLength', () => {
    const view: SimAssignmentView = { status: 'waiting', tick: 0, totalTicks: 2 };
    const customBase = { ...base, briefSeen: false, packClaims: [claim('z')] };
    const projection = projectSimView(view, me, roster, customBase)!;

    expect(projection.game.briefSeen).toBe(false);
    expect(projection.game.packClaims).toEqual([claim('z')]);
    expect(projection.game.settings.timerSeconds).toBe(customBase.settings.timerSeconds);
  });
});
