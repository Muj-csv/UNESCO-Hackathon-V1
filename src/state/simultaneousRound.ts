/* ============================================================================
   OWNER: T7 (rooms and simultaneous play).

   Turns a player's personal `SimAssignmentView` (server-computed, see
   api/_lib/simRound.ts) into the {screen, players, game} shape
   gameReducer's existing `SYNC_ROOM_STATE` case already knows how to
   apply — no reducer changes needed for simultaneous chains, and no
   changes to Round.tsx beyond the one already-approved turn-identity check.

   The trick: while a chain is active, `players` collapses to a single
   entry, `[me]`. Round.tsx (and the `hopPlayerId`/`hopPlayerName` it reads)
   resolve whose turn it is as `players[index % players.length]` — with one
   player, that's always index 0, always me, for whatever chain is
   currently mine. There's never a "waiting for someone else" state to
   render inside a chain, because the rotation already decided who's
   assigned to what before this projection ever runs; the *between-waves*
   wait is its own status (below), not something Round.tsx has to know
   about.

   `settings.chainLength` is overridden to the round's real per-chain
   length (= player count — see simRound.ts) rather than the lobby's
   setting, because gameReducer's SUBMIT_HOP compares `currentHop` against
   it to decide when to advance to 'terminal'. Every chain finishes on the
   same final wave (the rotation's whole point), so this fires at the same
   moment for everyone once it does.
   ========================================================================== */

import type { GameState } from '../types/contracts';
import { emptyRound } from './gameReducer';
import type { RoomPlayerPublic, SharedGameState, SimAssignmentView } from './roomProtocol';

export interface SimProjection {
  players: { id: string; name: string }[];
  game: SharedGameState;
}

type Base = Pick<GameState, 'settings' | 'session' | 'briefSeen' | 'packClaims'>;

export function projectSimView(
  view: SimAssignmentView,
  me: { id: string; name: string },
  roster: RoomPlayerPublic[],
  base: Base,
): SimProjection | null {
  if (view.status === 'not-in-round') return null;

  const settings = { ...base.settings, chainLength: view.totalTicks };

  if (view.status === 'waiting') {
    return {
      players: [me],
      game: {
        screen: 'round',
        settings,
        round: { ...emptyRound(), currentHop: view.tick },
        session: base.session,
        briefSeen: base.briefSeen,
        packClaims: base.packClaims,
      },
    };
  }

  if (view.status === 'active') {
    return {
      players: [me],
      game: {
        screen: 'round',
        settings,
        round: {
          ...emptyRound(),
          claim: view.claim,
          hops: view.hops,
          dealtCards: view.dealtCards,
          currentHop: view.hopIndex,
        },
        session: base.session,
        briefSeen: base.briefSeen,
        packClaims: base.packClaims,
      },
    };
  }

  // finished — hand off to the ordinary (unmodified) terminal/reveal/ledger
  // pipeline with the one chain the room reveals, real roster restored.
  return {
    players: roster.map((p) => ({ id: p.id, name: p.name })),
    game: {
      screen: 'terminal',
      settings,
      round: {
        ...emptyRound(),
        claim: view.finalChain.claim,
        hops: view.finalChain.hops,
        dealtCards: view.finalChain.dealtCards,
        currentHop: view.finalChain.hops.length,
      },
      session: base.session,
      briefSeen: base.briefSeen,
      packClaims: base.packClaims,
    },
  };
}
