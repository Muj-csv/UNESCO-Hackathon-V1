import { describe, expect, it } from 'vitest';
import type { Atom, Claim, GameState, RoundResult } from '../types/contracts';
import { ATOMS } from '../types/contracts';
import type { Action } from './gameReducer';
import {
  buildSplitAssignments,
  dealCards,
  gameReducer,
  hopsForLedger,
  hopPlayerId,
  initialState,
  prepareRound,
  routeFor,
  selectLobbyWarnings,
  settingsForPreset,
} from './gameReducer';
import rawClaims from '../data/claims.en.json';

const CLAIMS = rawClaims as Claim[];
const claim = CLAIMS[0];

const run = (state: GameState, ...actions: Action[]): GameState =>
  actions.reduce(gameReducer, state);

const withPlayers = (count: number, state = initialState): GameState =>
  run(
    state,
    ...Array.from({ length: count }, (_, i) => ({ type: 'ADD_PLAYER', name: `P${i + 1}` }) as Action),
  );

const started = (players = 5, state = initialState): GameState => {
  const withRoom = withPlayers(players, state);
  return run(withRoom, { type: 'BEGIN_ROUND', setup: prepareRound(withRoom, CLAIMS) });
};

const result = (over: Partial<RoundResult> = {}): RoundResult => ({
  claimId: claim.id,
  mode: 'chain',
  playedAt: 0,
  verdicts: {} as RoundResult['verdicts'],
  lostAtoms: [],
  firstLostAtom: null,
  deliberateAtoms: [],
  accidentalAtoms: [],
  predictions: {},
  turingCorrect: null,
  terminalDecision: null,
  verifyChoice: null,
  ...over,
});

/* ==========================================================================
   Bug the prototype shipped: results were pushed from inside the ledger
   render, so every re-render counted the round again.
   ========================================================================== */
describe('RECORD_ROUND_RESULT', () => {
  it('records the round once', () => {
    const state = run(initialState, { type: 'RECORD_ROUND_RESULT', result: result() });
    expect(state.session.results).toHaveLength(1);
  });

  it('ignores a repeat dispatch for the same round', () => {
    const state = run(
      initialState,
      { type: 'RECORD_ROUND_RESULT', result: result() },
      { type: 'RECORD_ROUND_RESULT', result: result() },
      { type: 'RECORD_ROUND_RESULT', result: result() },
    );
    expect(state.session.results).toHaveLength(1);
  });

  it('accepts the next round once the session has moved on', () => {
    const state = run(
      initialState,
      { type: 'RECORD_ROUND_RESULT', result: result() },
      { type: 'NEXT_ROUND' },
      { type: 'RECORD_ROUND_RESULT', result: result({ claimId: 'other' }) },
    );
    expect(state.session.results).toHaveLength(2);
    expect(state.session.roundNumber).toBe(2);
  });
});

describe('SUBMIT_HOP', () => {
  it('records the player and the card dealt for that hop', () => {
    const state = run(started(5), { type: 'SUBMIT_HOP', text: 'first rewrite' });
    const hop = state.round.hops[0];
    expect(hop.player).toBe('P1');
    expect(hop.cardId).toBe(state.round.dealtCards[0]);
    expect(state.round.currentHop).toBe(1);
  });

  it('cycles players when the chain is longer than the room', () => {
    let state = started(2);
    state = run(state, ...Array.from({ length: 5 }, () => ({ type: 'SUBMIT_HOP', text: 'x' }) as Action));
    expect(state.round.hops.map((h) => h.player)).toEqual(['P1', 'P2', 'P1', 'P2', 'P1']);
  });

  it('moves to the terminal screen when the chain is full', () => {
    let state = started(5);
    expect(state.settings.chainLength).toBe(5);
    state = run(state, ...Array.from({ length: 5 }, () => ({ type: 'SUBMIT_HOP', text: 'x' }) as Action));
    expect(state.screen).toBe('terminal');
    expect(state.round.hops).toHaveLength(5);
  });

  it('refuses hops past the end of the chain', () => {
    let state = started(5);
    state = run(state, ...Array.from({ length: 9 }, () => ({ type: 'SUBMIT_HOP', text: 'x' }) as Action));
    expect(state.round.hops).toHaveLength(5);
  });
});

describe('SPEND_VERIFICATION', () => {
  it('records the check against the hop it happened on', () => {
    const state = run(started(5), {
      type: 'SPEND_VERIFICATION',
      hopIndex: 2,
      atoms: ['HEDGE'],
    });
    expect(state.round.verifications).toEqual([{ hopIndex: 2, atoms: ['HEDGE'] }]);
    expect(state.round.verificationsLeft).toBe(0);
  });

  it('refuses once the budget is spent', () => {
    const state = run(
      started(5),
      { type: 'SPEND_VERIFICATION', hopIndex: 1, atoms: ['HEDGE'] },
      { type: 'SPEND_VERIFICATION', hopIndex: 2, atoms: ['SCOPE'] },
    );
    expect(state.round.verifications).toHaveLength(1);
    expect(state.round.verificationsLeft).toBe(0);
  });
});

/* ==========================================================================
   Bug the prototype shipped: the standard preset claimed all six cards and
   then filtered the deck down to two.
   ========================================================================== */
describe('SET_PRESET', () => {
  it('deals from every card the preset claims', () => {
    const state = run(initialState, { type: 'SET_PRESET', presetId: 'standard' });
    expect(state.settings.cardIds).toHaveLength(6);
  });

  it('resolves a narrower constraint set honestly', () => {
    const state = run(initialState, { type: 'SET_PRESET', presetId: 'groupchat' });
    expect(state.settings.cardIds).toEqual(['chars', 'headline', 'secs']);
  });

  it('keeps the chosen mode', () => {
    const state = run(
      initialState,
      { type: 'SET_MODE', mode: 'crowd' },
      { type: 'SET_PRESET', presetId: 'feed' },
    );
    expect(state.settings.mode).toBe('crowd');
  });
});

/* ==========================================================================
   Bug the prototype shipped: SPLIT set chainLength = 1 permanently and
   followed the user back to the lobby.
   ========================================================================== */
describe('CROWD RECALL', () => {
  const crowd = () => run(initialState, { type: 'SET_MODE', mode: 'crowd' });

  it('does not touch the chain length', () => {
    const before = crowd().settings.chainLength;
    const state = run(started(5, crowd()), {
      type: 'SET_SPLIT_RECONSTRUCTION',
      text: 'what the group remembered',
    });
    expect(state.settings.chainLength).toBe(before);
  });

  it('keeps its synthetic hop out of round.hops', () => {
    const state = run(started(5, crowd()), {
      type: 'SET_SPLIT_RECONSTRUCTION',
      text: 'what the group remembered',
    });
    expect(state.round.hops).toEqual([]);
    expect(hopsForLedger(state)).toEqual([
      { player: 'The room', text: 'what the group remembered', cardId: null },
    ]);
  });

  it('leaves nothing behind for the next round', () => {
    const state = run(
      started(5, crowd()),
      { type: 'SET_SPLIT_RECONSTRUCTION', text: 'what the group remembered' },
      { type: 'NEXT_ROUND' },
    );
    expect(state.round.splitReconstruction).toBe('');
    expect(hopsForLedger(state)).toEqual([]);
  });

  it('deals every player a version missing one property', () => {
    const players = withPlayers(5).players;
    const assignments = buildSplitAssignments(claim, players);
    expect(assignments).toHaveLength(5);
    for (const a of assignments) {
      expect(ATOMS).toContain(a.missingAtom);
      expect(a.text).toBe(claim.degraded[a.missingAtom]);
    }
    /* with five players and five atoms, nobody holds a duplicate */
    expect(new Set(assignments.map((a) => a.missingAtom)).size).toBe(5);
  });

  it('has no imposter beat anywhere in its route', () => {
    expect(routeFor('crowd')).not.toContain('accusation');
    expect(prepareRound(started(5, crowd()), CLAIMS).imposter).toBe(null);
  });
});

/* ==========================================================================
   Bug the prototype shipped: twelve players on a five-hop chain meant seven
   people never played, with no warning.
   ========================================================================== */
describe('selectLobbyWarnings', () => {
  it('says how many people will not take a hop', () => {
    const warnings = selectLobbyWarnings(withPlayers(12));
    const idle = warnings.find((w) => w.kind === 'players-idle');
    expect(idle?.message).toContain('7 of 12');
  });

  it('says nothing about idle players when the room fits the chain', () => {
    expect(selectLobbyWarnings(withPlayers(5)).map((w) => w.kind)).toEqual([]);
  });

  it('warns when the chain is longer than the room', () => {
    expect(selectLobbyWarnings(withPlayers(4)).map((w) => w.kind)).toContain('chain-too-long');
  });

  it('warns when there are too few people for the decay to read', () => {
    expect(selectLobbyWarnings(withPlayers(2)).map((w) => w.kind)).toContain('too-few-players');
  });

  it('says nothing at all before anyone has joined', () => {
    expect(selectLobbyWarnings(initialState)).toEqual([]);
  });
});

describe('routing', () => {
  it('steps through the chain route in order', () => {
    let state = run(started(5), { type: 'GO_TO', screen: 'reveal' });
    const seen = ['reveal'];
    for (let i = 0; i < 5; i++) {
      state = run(state, { type: 'ADVANCE' });
      seen.push(state.screen);
    }
    expect(seen).toEqual(['reveal', 'blackboxGuess', 'turingHop', 'accusation', 'thesis', 'ledger']);
  });

  it('stops at the end rather than wrapping', () => {
    const state = run(
      started(5),
      { type: 'GO_TO', screen: 'sessionReadout' },
      { type: 'ADVANCE' },
    );
    expect(state.screen).toBe('sessionReadout');
  });

  it('returns to the lobby from a screen outside the route', () => {
    const state = run(initialState, { type: 'GO_TO', screen: 'packStudio' }, { type: 'ADVANCE' });
    expect(state.screen).toBe('lobby');
  });

  /* A self-skipping screen dispatches ADVANCE from an effect, and StrictMode
     runs effects twice. Unguarded, that steps two screens and silently skips
     one — CROWD RECALL lost its entire distribute beat this way. */
  it('ignores a repeat ADVANCE from a screen already left', () => {
    const state = run(
      started(3),
      { type: 'GO_TO', screen: 'brief' },
      { type: 'ADVANCE', from: 'brief' },
      { type: 'ADVANCE', from: 'brief' },
      { type: 'ADVANCE', from: 'brief' },
    );
    expect(state.screen).toBe('prediction');
  });

  it('still steps when no origin is named', () => {
    const state = run(started(3), { type: 'GO_TO', screen: 'brief' }, { type: 'ADVANCE' });
    expect(state.screen).toBe('prediction');
  });

  it('keeps every crowd recall beat reachable', () => {
    const crowd = run(initialState, { type: 'SET_MODE', mode: 'crowd' });
    let state = run(started(3, crowd), { type: 'GO_TO', screen: 'brief' });
    const seen = [state.screen];
    for (let i = 0; i < 3; i++) {
      const from = state.screen;
      /* dispatch twice, exactly as StrictMode does */
      state = run(state, { type: 'ADVANCE', from }, { type: 'ADVANCE', from });
      seen.push(state.screen);
    }
    expect(seen).toEqual(['brief', 'splitDistribute', 'splitReconstruct', 'thesis']);
  });
});

describe('dealCards', () => {
  it('deals one card per hop', () => {
    expect(dealCards(['chars', 'headline', 'secs'], 5)).toHaveLength(5);
  });

  it('only deals cards the preset allows', () => {
    const allowed = ['chars', 'secs'] as const;
    for (const card of dealCards([...allowed], 8)) {
      expect(allowed).toContain(card);
    }
  });

  it('never deals the same card twice in a row', () => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const dealt = dealCards(['chars', 'headline'], 6);
      for (let i = 1; i < dealt.length; i++) {
        expect(dealt[i]).not.toBe(dealt[i - 1]);
      }
    }
  });
});

describe('prepareRound', () => {
  it('prefers a claim the session has not played', () => {
    const state = run(withPlayers(5), {
      type: 'RECORD_ROUND_RESULT',
      result: result({ claimId: CLAIMS[0].id }),
    });
    for (let attempt = 0; attempt < 30; attempt++) {
      expect(prepareRound(state, CLAIMS).claim.id).not.toBe(CLAIMS[0].id);
    }
  });

  it('falls back to the full library once everything has been played', () => {
    let state = withPlayers(5);
    CLAIMS.forEach((c, i) => {
      state = run(state, { type: 'RECORD_ROUND_RESULT', result: result({ claimId: c.id }) });
      if (i < CLAIMS.length - 1) state = run(state, { type: 'NEXT_ROUND' });
    });
    expect(prepareRound(state, CLAIMS).claim).toBeTruthy();
  });

  /* T6 now deals the machine's hops here — see aiHops.test.ts for where they
     may land. The imposter is still T8's to assign. */
  it('deals the machine its hops and leaves the imposter to its own task', () => {
    const setup = prepareRound(withPlayers(5), CLAIMS);
    expect(setup.aiHopIndexes.length).toBeGreaterThan(0);
    expect(setup.imposter).toBe(null);
  });
});

describe('the reducer is pure', () => {
  it('does not mutate the state it was given', () => {
    const before = JSON.stringify(initialState);
    run(initialState, { type: 'ADD_PLAYER', name: 'Mika' }, { type: 'SET_PRESET', presetId: 'feed' });
    expect(JSON.stringify(initialState)).toBe(before);
  });

  it('produces the same result for the same actions', () => {
    const actions: Action[] = [
      { type: 'ADD_PLAYER', name: 'Mika' },
      { type: 'SET_PRESET', presetId: 'groupchat' },
      { type: 'GO_TO', screen: 'reveal' },
    ];
    const a = run(initialState, ...actions);
    const b = run(initialState, ...actions);
    /* ids carry randomness, so compare everything else */
    expect({ ...a, players: a.players.map((p) => p.name) }).toEqual({
      ...b,
      players: b.players.map((p) => p.name),
    });
  });

  it('handles every action name later tasks will fill in', () => {
    const stubs: Action[] = [
      { type: 'SET_VERIFY_CHOICE', atom: 'HEDGE' },
      { type: 'RESTORE_STATE', state: initialState },
      { type: 'CLEAR_SAVED_STATE' },
      { type: 'SET_AI_HOP', hopIndex: 1, text: 'x' },
      { type: 'SET_TURING_GUESS', hopIndex: 1 },
      { type: 'JOIN_ROOM', code: 'ABCD', playerId: 'p1', isHost: false },
      { type: 'SYNC_ROOM_STATE', payload: {} },
      { type: 'ASSIGN_IMPOSTER', assignment: { player: 'P1', hopIndex: 1, targetAtom: 'HEDGE' } },
      { type: 'CAST_ACCUSATION', player: 'P1' },
      { type: 'REVEAL_ROLES' },
      { type: 'SET_PREDICTION', player: 'P1', atom: 'SCOPE' },
      { type: 'ADD_REACTION', hopIndex: 0, reaction: 'eyes' },
    ];
    for (const action of stubs) {
      const next = gameReducer(initialState, action);
      expect(next.version, action.type).toBe(initialState.version);
      expect(next.screen, action.type).toBe(initialState.screen);
    }
  });
});

describe('NEW_GAME', () => {
  it('keeps the room and the setup, drops the play', () => {
    let state = started(5);
    state = run(state, { type: 'SUBMIT_HOP', text: 'x' }, { type: 'NEW_GAME' });
    expect(state.players).toHaveLength(5);
    expect(state.settings.presetId).toBe('standard');
    expect(state.round.hops).toEqual([]);
    expect(state.round.claim).toBe(null);
    expect(state.screen).toBe('lobby');
    expect(state.session.results).toEqual([]);
  });
});

describe('RESTORE_STATE', () => {
  it('replaces the whole state with the rehydrated payload', () => {
    const saved: GameState = { ...withPlayers(3), screen: 'round' };
    const restored = run(initialState, { type: 'RESTORE_STATE', state: saved });
    expect(restored).toEqual(saved);
  });
});

describe('CLEAR_SAVED_STATE', () => {
  it('drops everything, including players, unlike NEW_GAME', () => {
    let state = started(5);
    state = run(state, { type: 'SUBMIT_HOP', text: 'x' }, { type: 'CLEAR_SAVED_STATE' });
    expect(state).toEqual(initialState);
  });
});

describe('SET_VERIFY_CHOICE', () => {
  it('records which atom the final reader would check first', () => {
    const state = run(started(5), { type: 'SET_VERIFY_CHOICE', atom: 'HEDGE' });
    expect(state.round.verifyChoice).toBe('HEDGE');
  });

  it('resets to null on the next round', () => {
    let state = run(started(5), { type: 'SET_VERIFY_CHOICE', atom: 'SCOPE' });
    state = run(state, { type: 'BEGIN_ROUND', setup: prepareRound(state, CLAIMS) });
    expect(state.round.verifyChoice).toBeNull();
  });
});

/* T7: backs Round.tsx's per-device turn check — a room device must be able
   to tell whether the current hop is actually its player's before it shows
   the "I'm <player>" button. */
describe('hopPlayerId', () => {
  it('returns the id of whoever takes that hop, cycling like hopPlayerName', () => {
    const withRoom = withPlayers(3);
    const ids = withRoom.players.map((p) => p.id);
    expect(hopPlayerId(withRoom, 0)).toBe(ids[0]);
    expect(hopPlayerId(withRoom, 1)).toBe(ids[1]);
    expect(hopPlayerId(withRoom, 3)).toBe(ids[0]); // wraps
  });

  it('returns null with no players, rather than throwing', () => {
    expect(hopPlayerId(initialState, 0)).toBeNull();
  });
});

describe('JOIN_ROOM', () => {
  it('records the connection and marks it connected', () => {
    const state = run(initialState, { type: 'JOIN_ROOM', code: 'ABCD', playerId: 'p1', isHost: true });
    expect(state.room).toMatchObject({ code: 'ABCD', playerId: 'p1', isHost: true, status: 'connected' });
    expect(state.room.lastSyncAt).not.toBeNull();
  });

  it('does not touch players or settings by itself', () => {
    const withRoom = withPlayers(2);
    const state = run(withRoom, { type: 'JOIN_ROOM', code: 'ABCD', playerId: 'p1', isHost: false });
    expect(state.players).toEqual(withRoom.players);
    expect(state.settings).toEqual(withRoom.settings);
  });

  /* T7 failure handling: "continue in pass-and-play with current state" is
     an empty-code JOIN_ROOM rather than a new action — see the reducer case. */
  it('treats an empty code as going offline, keeping everything else', () => {
    const midRound = run(
      started(5),
      { type: 'JOIN_ROOM', code: 'ABCD', playerId: 'p1', isHost: true },
      { type: 'SUBMIT_HOP', text: 'A version.' },
    );
    const state = run(midRound, { type: 'JOIN_ROOM', code: '', playerId: '', isHost: false });

    expect(state.room).toEqual({ code: null, playerId: null, isHost: false, status: 'offline', lastSyncAt: null });
    expect(state.round).toEqual(midRound.round);
    expect(state.screen).toBe(midRound.screen);
    expect(state.players).toEqual(midRound.players);
  });
});

describe('SYNC_ROOM_STATE', () => {
  type SnapshotPlayer = { id: string; name: string; isHost: boolean; connected: boolean };
  const snapshot = (over: Partial<{ players: SnapshotPlayer[]; game: unknown }> = {}) => ({
    code: 'ABCD',
    hostId: 'p1',
    players: [{ id: 'p1', name: 'Ana', isHost: true, connected: true }],
    createdAt: 0,
    updatedAt: 0,
    expiresAt: 0,
    seq: 1,
    game: null,
    ...over,
  });

  it('replaces the player roster from the room, not ADD_PLAYER', () => {
    const state = run(
      initialState,
      { type: 'JOIN_ROOM', code: 'ABCD', playerId: 'p1', isHost: true },
      {
        type: 'SYNC_ROOM_STATE',
        payload: snapshot({
          players: [
            { id: 'p1', name: 'Ana', isHost: true, connected: true },
            { id: 'p2', name: 'Ben', isHost: false, connected: true },
          ],
        }),
      },
    );
    expect(state.players).toEqual([
      { id: 'p1', name: 'Ana' },
      { id: 'p2', name: 'Ben' },
    ]);
  });

  it('leaves screen/round/settings alone when nobody has pushed a shared state yet', () => {
    const withRoom = run(initialState, { type: 'JOIN_ROOM', code: 'ABCD', playerId: 'p1', isHost: false });
    const state = run(withRoom, { type: 'SYNC_ROOM_STATE', payload: snapshot({ game: null }) });
    expect(state.screen).toBe(withRoom.screen);
    expect(state.round).toEqual(withRoom.round);
  });

  it('applies a shared game payload once someone has pushed one', () => {
    const shared = {
      screen: 'round',
      settings: settingsForPreset('standard', 'chain'),
      round: { ...initialState.round, currentHop: 2 },
      session: initialState.session,
      briefSeen: true,
      packClaims: null,
    };
    const withRoom = run(initialState, { type: 'JOIN_ROOM', code: 'ABCD', playerId: 'p1', isHost: false });
    const state = run(withRoom, { type: 'SYNC_ROOM_STATE', payload: snapshot({ game: shared }) });

    expect(state.screen).toBe('round');
    expect(state.round.currentHop).toBe(2);
    expect(state.briefSeen).toBe(true);
  });

  it('keeps connection info local rather than adopting anything from the payload', () => {
    const withRoom = run(initialState, { type: 'JOIN_ROOM', code: 'ABCD', playerId: 'p2', isHost: false });
    const state = run(withRoom, { type: 'SYNC_ROOM_STATE', payload: snapshot() });
    expect(state.room.code).toBe('ABCD');
    expect(state.room.playerId).toBe('p2');
    expect(state.room.isHost).toBe(false);
  });
});

describe('atoms', () => {
  it('scores nothing but the five', () => {
    const atoms: Atom[] = [...ATOMS];
    expect(atoms).toEqual(['SOURCE', 'NUMBER', 'HEDGE', 'SCOPE', 'CAUSE']);
  });
});
