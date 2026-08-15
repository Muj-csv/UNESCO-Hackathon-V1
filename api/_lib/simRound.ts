/* ============================================================================
   OWNER: T7 (rooms and simultaneous play).

   The simultaneous-chains engine: N players, N parallel chains, one wave
   (tick) at a time. See docs/T7-rooms-and-simultaneous-play.md:

     "With N players, run N parallel chains. Each seeds with a different
      claim and rotates through every player, so at any moment each person
      is writing on a different chain. Everyone plays every round."

   Rotation: chain c's hop at tick t is written by player index (c - t) mod
   N, equivalently player index p writes chain (p + t) mod N at tick t. At
   t=0 player p opens chain p — every chain gets one hop from every player,
   in a different order, and every chain finishes on the same final tick.
   That last property is what lets the client treat "my chain reached its
   last hop" as "the whole simultaneous round is over" — see roomStore.ts.

   Server-authoritative and stateless per request: nothing here runs on a
   timer. `applyTimeouts` is checked lazily on every read/write instead, the
   same pattern api/room.ts already uses for room expiry.

   Deliberately out of scope for this pass (see docs/T7 "Do not" — kept
   small and flagged rather than guessed at): no AI participant hop inside a
   simultaneous chain, and no shared verification budget. Round.tsx's
   "Check the original" button simply doesn't appear during a simultaneous
   round (verificationsLeft stays 0 on the client's projected view).
   ========================================================================== */

import type { CardId, Claim, Hop } from '../../src/types/contracts';
import { dealCards } from '../../src/state/gameReducer.js';

/** How much longer than the wave's own timer before an unanswered chain gets
    filled in and the room moves on. Mirrors GameContext's client-side
    watchdog for the legacy single-chain room mode (same rationale: the real
    per-device timer, and a poll round-trip, both get to run first). */
const WAVE_GRACE_SECONDS = 15;

export interface SimChain {
  claim: Claim;
  hops: Hop[];
  dealtCards: (CardId | null)[];
}

export interface SimRound {
  /** = the player count at round start. Every chain's length, and the
      number of ticks — the whole point of the rotation needs a full square. */
  chainLength: number;
  /** Current wave, 0-indexed. Reaches `chainLength` once every chain has
      every hop — see `finished`. */
  tick: number;
  waveStartedAt: number;
  timerSeconds: number;
  chains: SimChain[];
  /** Player ids in rotation order, frozen at round start — immune to
      anyone joining or leaving mid-round. */
  playerOrder: string[];
  playerNames: Record<string, string>;
  finished: boolean;
  /** Chosen once `finished`. See the file header — MVP picks one chain
      rather than stepping through several. */
  finalChainIndex: number | null;
}

export interface SimAssignment {
  chainIndex: number;
  hopIndex: number;
}

function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** N distinct claims when the pool allows it; cycles (repeats) once it runs out. */
function pickChainClaims(pool: Claim[], n: number): Claim[] {
  const shuffled = shuffle(pool);
  const out: Claim[] = [];
  for (let i = 0; i < n; i++) out.push(shuffled[i % shuffled.length]);
  return out;
}

export function startSimRound(
  players: { id: string; name: string }[],
  claimsPool: Claim[],
  cardIds: CardId[],
  timerSeconds: number,
): SimRound {
  const n = players.length;
  const claims = pickChainClaims(claimsPool, n);
  const chains: SimChain[] = claims.map((claim) => ({
    claim,
    hops: [],
    dealtCards: dealCards(cardIds, n),
  }));
  const playerNames: Record<string, string> = {};
  for (const p of players) playerNames[p.id] = p.name;

  return {
    chainLength: n,
    tick: 0,
    waveStartedAt: Date.now(),
    timerSeconds,
    chains,
    playerOrder: players.map((p) => p.id),
    playerNames,
    finished: false,
    finalChainIndex: null,
  };
}

export function assignmentFor(sim: SimRound, playerId: string): SimAssignment | null {
  const playerIndex = sim.playerOrder.indexOf(playerId);
  if (playerIndex < 0 || sim.finished) return null;
  return { chainIndex: (playerIndex + sim.tick) % sim.chainLength, hopIndex: sim.tick };
}

/** Once every chain has this tick's hop, advance — or finish, on the last one. */
function maybeAdvanceTick(sim: SimRound): SimRound {
  const allDone = sim.chains.every((c) => c.hops.length > sim.tick);
  if (!allDone) return sim;

  const nextTick = sim.tick + 1;
  if (nextTick >= sim.chainLength) {
    return { ...sim, tick: nextTick, finished: true, finalChainIndex: pickFinalChain(sim) };
  }
  return { ...sim, tick: nextTick, waveStartedAt: Date.now() };
}

/** MVP: one chain, chosen once, deterministically. See file header. */
function pickFinalChain(sim: SimRound): number {
  return Math.floor(Math.random() * sim.chains.length);
}

/**
 * Applies `playerId`'s hop for the current tick to their assigned chain.
 * Idempotent: a stale or repeated submission (wrong hop count already on
 * that chain) is a silent no-op rather than an error — the same shape as a
 * dropped network request retried after it actually landed.
 */
export function submitChainHop(sim: SimRound, playerId: string, text: string): SimRound {
  const assignment = assignmentFor(sim, playerId);
  if (!assignment) return sim;

  const chain = sim.chains[assignment.chainIndex];
  if (chain.hops.length !== assignment.hopIndex) return sim;

  const hop: Hop = {
    player: sim.playerNames[playerId] ?? playerId,
    text,
    cardId: chain.dealtCards[assignment.hopIndex] ?? null,
  };
  const chains = sim.chains.map((c, i) => (i === assignment.chainIndex ? { ...c, hops: [...c.hops, hop] } : c));
  return maybeAdvanceTick({ ...sim, chains });
}

/** Fills every chain still missing this wave's hop with its previous text
    unchanged (or the claim itself, on the first wave) — same rule Round.tsx
    itself uses when a device's own timer runs out with nothing typed. */
function fillWave(sim: SimRound): SimRound {
  const chains = sim.chains.map((c, chainIndex) => {
    if (c.hops.length > sim.tick) return c;
    const playerIndex = (chainIndex - sim.tick + sim.chainLength) % sim.chainLength;
    const playerId = sim.playerOrder[playerIndex];
    const source = c.hops.length ? c.hops[c.hops.length - 1].text : c.claim.originalText;
    const hop: Hop = {
      player: sim.playerNames[playerId] ?? playerId,
      text: source,
      cardId: c.dealtCards[sim.tick] ?? null,
    };
    return { ...c, hops: [...c.hops, hop] };
  });
  return { ...sim, chains };
}

/** Lazy timeout check — called on every read/write, same pattern as room
    expiry. Advances (possibly repeatedly, if the room sat untouched through
    several waves) until either caught up to "now" or finished. */
export function applyTimeouts(sim: SimRound): SimRound {
  let current = sim;
  let guard = 0;
  while (!current.finished && guard < current.chainLength + 1) {
    const deadline = current.waveStartedAt + (current.timerSeconds + WAVE_GRACE_SECONDS) * 1000;
    if (Date.now() < deadline) break;

    /* Advance by exactly one wave's duration from its own deadline, not by
       resetting to "now" (that's `maybeAdvanceTick`'s job for an organic
       submission). Catching up through several missed waves in one lazy
       check needs each synthetic wave's start to keep pace with itself, or
       the second iteration sees a "fresh" wave that hasn't expired yet
       relative to an unmoving clock and the catch-up stalls after one. */
    const filled = fillWave(current);
    const nextTick = current.tick + 1;
    current =
      nextTick >= current.chainLength
        ? { ...filled, tick: nextTick, finished: true, finalChainIndex: pickFinalChain(filled) }
        : { ...filled, tick: nextTick, waveStartedAt: deadline };
    guard += 1;
  }
  return current;
}

/** Manual version of the timeout fill — the host's "force advance". */
export function forceAdvanceWave(sim: SimRound): SimRound {
  if (sim.finished) return sim;
  return maybeAdvanceTick(fillWave(sim));
}

export type SimAssignmentView =
  | { status: 'active'; tick: number; totalTicks: number; claim: Claim; hops: Hop[]; dealtCards: (CardId | null)[]; hopIndex: number }
  | { status: 'waiting'; tick: number; totalTicks: number }
  | { status: 'finished'; tick: number; totalTicks: number; finalChain: { claim: Claim; hops: Hop[]; dealtCards: (CardId | null)[] } }
  | { status: 'not-in-round' };

/** What a specific player is allowed to see right now. Never includes
    another chain's in-progress text — only the requester's own assignment,
    or (once finished) the one chain the room reveals. */
export function viewForPlayer(sim: SimRound, playerId: string): SimAssignmentView {
  if (sim.finished) {
    const chain = sim.chains[sim.finalChainIndex ?? 0];
    return {
      status: 'finished',
      tick: sim.tick,
      totalTicks: sim.chainLength,
      finalChain: { claim: chain.claim, hops: chain.hops, dealtCards: chain.dealtCards },
    };
  }

  const assignment = assignmentFor(sim, playerId);
  if (!assignment) return { status: 'not-in-round' };

  const chain = sim.chains[assignment.chainIndex];
  if (chain.hops.length !== assignment.hopIndex) {
    /* This player already submitted this wave (or the wave hasn't caught up
       to them yet, e.g. right after a fresh join) — nothing to write until
       the next tick. */
    return { status: 'waiting', tick: sim.tick, totalTicks: sim.chainLength };
  }

  return {
    status: 'active',
    tick: sim.tick,
    totalTicks: sim.chainLength,
    claim: chain.claim,
    hops: chain.hops,
    dealtCards: chain.dealtCards,
    hopIndex: assignment.hopIndex,
  };
}
