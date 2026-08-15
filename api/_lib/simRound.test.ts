import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Claim } from '../../src/types/contracts';
import {
  applyTimeouts,
  assignmentFor,
  forceAdvanceWave,
  startSimRound,
  submitChainHop,
  viewForPlayer,
} from './simRound';

/* ==========================================================================
   The rotation is the whole mechanism: N players, N chains, everyone writes
   on a different chain every wave, every chain finishes on the same final
   wave. These tests check that property directly rather than trusting the
   formula by inspection.
   ========================================================================== */

function claim(id: string): Claim {
  return {
    id,
    topic: 'Test',
    lang: 'en',
    originalText: `Original text for ${id}.`,
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

const CLAIMS = [claim('a'), claim('b'), claim('c'), claim('d'), claim('e')];
const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));

describe('startSimRound', () => {
  it('deals one chain per player, each with its own claim', () => {
    const sim = startSimRound(players(3), CLAIMS, ['chars'], 30);
    expect(sim.chainLength).toBe(3);
    expect(sim.chains).toHaveLength(3);
    expect(sim.tick).toBe(0);
    expect(sim.finished).toBe(false);
  });

  it('repeats claims rather than failing when the pool is smaller than the room', () => {
    const sim = startSimRound(players(8), CLAIMS.slice(0, 2), ['chars'], 30);
    expect(sim.chains).toHaveLength(8);
    expect(sim.chains.every((c) => CLAIMS.slice(0, 2).some((cl) => cl.id === c.claim.id))).toBe(true);
  });
});

describe('rotation', () => {
  it('every player has a different chain every wave, and it changes each wave', () => {
    const n = 4;
    const sim = startSimRound(players(n), CLAIMS, ['chars'], 30);

    for (let tick = 0; tick < n; tick++) {
      const assignments = players(n).map((p) => assignmentFor({ ...sim, tick }, p.id)!.chainIndex);
      expect(new Set(assignments).size).toBe(n); // nobody shares a chain this wave
    }
  });

  it('every chain receives exactly one hop from every player across the whole round', () => {
    const n = 4;
    let sim = startSimRound(players(n), CLAIMS, ['chars'], 30);

    for (let tick = 0; tick < n; tick++) {
      for (const p of players(n)) {
        sim = submitChainHop(sim, p.id, `${p.id}@${tick}`);
      }
    }

    expect(sim.finished).toBe(true);
    for (const chain of sim.chains) {
      expect(chain.hops).toHaveLength(n);
      expect(new Set(chain.hops.map((h) => h.player)).size).toBe(n);
    }
  });

  it('finishes every chain on the same final wave', () => {
    const n = 3;
    let sim = startSimRound(players(n), CLAIMS, ['chars'], 30);

    // Every player finishes every wave but the last.
    for (let tick = 0; tick < n - 1; tick++) {
      for (const p of players(n)) sim = submitChainHop(sim, p.id, 'x');
      expect(sim.tick).toBe(tick + 1);
      expect(sim.finished).toBe(false);
    }

    // Final wave: everyone but the last player has gone — not finished yet.
    for (const p of players(n).slice(0, n - 1)) sim = submitChainHop(sim, p.id, 'x');
    expect(sim.finished).toBe(false);

    sim = submitChainHop(sim, players(n)[n - 1].id, 'last');
    expect(sim.finished).toBe(true);
  });
});

describe('submitChainHop', () => {
  it('is a no-op for a player not in the round', () => {
    const sim = startSimRound(players(3), CLAIMS, ['chars'], 30);
    const next = submitChainHop(sim, 'nobody', 'x');
    expect(next).toBe(sim);
  });

  it('is a no-op for a repeated submission on the same wave', () => {
    const sim = startSimRound(players(3), CLAIMS, ['chars'], 30);
    const once = submitChainHop(sim, 'p0', 'first');
    const twice = submitChainHop(once, 'p0', 'second');
    expect(twice).toBe(once);
  });

  it('does not advance the wave until every chain has this tick’s hop', () => {
    const sim = startSimRound(players(3), CLAIMS, ['chars'], 30);
    const partial = submitChainHop(sim, 'p0', 'x');
    expect(partial.tick).toBe(0);
    expect(partial.finished).toBe(false);
  });
});

describe('viewForPlayer', () => {
  it('shows the active assignment before submitting', () => {
    const sim = startSimRound(players(3), CLAIMS, ['chars'], 30);
    const view = viewForPlayer(sim, 'p0');
    expect(view.status).toBe('active');
    if (view.status === 'active') {
      expect(view.hopIndex).toBe(0);
      expect(view.claim.id).toBe(sim.chains[0].claim.id);
    }
  });

  it('shows waiting once this player has submitted but the wave has not advanced', () => {
    const sim = startSimRound(players(3), CLAIMS, ['chars'], 30);
    const afterSubmit = submitChainHop(sim, 'p0', 'x');
    expect(viewForPlayer(afterSubmit, 'p0').status).toBe('waiting');
  });

  it('shows not-in-round for someone outside the frozen player order', () => {
    const sim = startSimRound(players(3), CLAIMS, ['chars'], 30);
    expect(viewForPlayer(sim, 'latecomer').status).toBe('not-in-round');
  });

  it('shows the same finished chain to everyone', () => {
    const n = 3;
    let sim = startSimRound(players(n), CLAIMS, ['chars'], 30);
    for (let tick = 0; tick < n; tick++) {
      for (const p of players(n)) sim = submitChainHop(sim, p.id, `x${tick}`);
    }
    const views = players(n).map((p) => viewForPlayer(sim, p.id));
    expect(views.every((v) => v.status === 'finished')).toBe(true);
    const claimIds = views.map((v) => (v.status === 'finished' ? v.finalChain.claim.id : null));
    expect(new Set(claimIds).size).toBe(1);
  });
});

describe('applyTimeouts', () => {
  afterEach(() => vi.useRealTimers());

  it('does nothing before the wave’s deadline', () => {
    const sim = startSimRound(players(3), CLAIMS, ['chars'], 30);
    expect(applyTimeouts(sim)).toBe(sim);
  });

  it('fills unanswered chains and advances the wave once the deadline passes', () => {
    const sim = startSimRound(players(3), CLAIMS, ['chars'], 10);
    const partial = submitChainHop(sim, 'p0', 'p0 wrote this');

    vi.useFakeTimers();
    vi.setSystemTime(partial.waveStartedAt + 26_000); // 10s timer + 15s grace + 1s

    const advanced = applyTimeouts(partial);
    expect(advanced.tick).toBe(1);
    // chain 0 (p0's wave-0 chain) already had p0's real hop; the other two
    // chains got filled with a pass-through of their own claim text.
    expect(advanced.chains[1].hops[0].text).toBe(advanced.chains[1].claim.originalText);
    expect(advanced.chains[2].hops[0].text).toBe(advanced.chains[2].claim.originalText);
  });

  it('catches up through several missed waves at once', () => {
    const sim = startSimRound(players(2), CLAIMS, ['chars'], 5);

    vi.useFakeTimers();
    vi.setSystemTime(sim.waveStartedAt + 5 * 60_000); // way past both waves

    const caughtUp = applyTimeouts(sim);
    expect(caughtUp.finished).toBe(true);
  });
});

describe('forceAdvanceWave', () => {
  it('fills the current wave immediately regardless of the deadline', () => {
    const sim = startSimRound(players(3), CLAIMS, ['chars'], 300);
    const forced = forceAdvanceWave(sim);
    expect(forced.tick).toBe(1);
  });

  it('is a no-op once the round is finished', () => {
    const n = 2;
    let sim = startSimRound(players(n), CLAIMS, ['chars'], 30);
    for (let tick = 0; tick < n; tick++) {
      for (const p of players(n)) sim = submitChainHop(sim, p.id, 'x');
    }
    expect(forceAdvanceWave(sim)).toBe(sim);
  });
});
