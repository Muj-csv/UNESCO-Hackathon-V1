import type {
  Atom,
  AtomOverride,
  CardId,
  Claim,
  GameState,
  Hop,
  ImposterAssignment,
  LobbyWarning,
  Mode,
  Player,
  RoundResult,
  RoundState,
  ScreenId,
  Settings,
  SplitAssignment,
  TerminalDecision,
} from '../types/contracts';
import { ATOMS } from '../types/contracts';
import { DEFAULT_PRESET_ID, cardsForPreset, getPreset } from '../data/presets';

/* ============================================================================
   Every state transition in the game.

   PARALLEL WORK — READ THIS FIRST
   Every action name T1–T10 needs is already here, with an empty handler that
   returns state unchanged. FILL IN YOUR CASE. Do not add one: adding shifts
   the surrounding lines and conflicts on merge with four other branches.

   The reducer is PURE. Anything random (which claim, which card, which hop is
   the machine) is decided in `prepareRound` and arrives as an action payload.
   React 18 StrictMode double-invokes reducers to catch impurity, so a
   Math.random() in here would deal a different hand on the second call.
   ========================================================================== */

/** Bump when the shape of GameState changes. T5 discards on mismatch. */
export const STATE_VERSION = 1;

/* ------------------------------------------------------------------ routes -- */
/* The full route exists from day one. Screens whose feature is not built yet
   skip themselves on mount, so no later task ever edits routing.             */

const ROUTE_CHAIN: ScreenId[] = [
  'lobby',
  'howToPlay',
  'brief',
  'prediction',
  'round',
  'terminal',
  'reveal',
  'blackboxGuess',
  'turingHop',
  'accusation',
  'thesis',
  'ledger',
  'debrief',
  'superlatives',
  'sessionReadout',
];

/* CROWD RECALL diverges after the brief and has no villain, structurally.
   Never add an imposter beat to this route. */
const ROUTE_CROWD: ScreenId[] = [
  'lobby',
  'howToPlay',
  'brief',
  'splitDistribute',
  'splitReconstruct',
  'thesis',
  'ledger',
  'debrief',
  'superlatives',
  'sessionReadout',
];

export function routeFor(mode: Mode): ScreenId[] {
  return mode === 'crowd' ? ROUTE_CROWD : ROUTE_CHAIN;
}

/* ----------------------------------------------------------------- actions -- */

/** Everything BEGIN_ROUND needs, decided outside the reducer. */
export interface RoundSetup {
  claim: Claim;
  dealtCards: (CardId | null)[];
  aiHopIndexes: number[];
  splitAssignments: SplitAssignment[];
  imposter: ImposterAssignment | null;
}

export type Action =
  /* -------- core, settled in T0 -------- */
  /** `from` makes the step idempotent — see the reducer case. */
  | { type: 'ADVANCE'; from?: ScreenId }
  | { type: 'GO_TO'; screen: ScreenId }
  | { type: 'ADD_PLAYER'; name: string }
  | { type: 'REMOVE_PLAYER'; id: string }
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'SET_PRESET'; presetId: string }
  | { type: 'SET_SETTINGS'; patch: Partial<Settings> }
  | { type: 'BEGIN_ROUND'; setup: RoundSetup }
  | { type: 'SUBMIT_HOP'; text: string }
  | { type: 'SPEND_VERIFICATION'; hopIndex: number; atoms: Atom[] }
  | { type: 'SET_TERMINAL_DECISION'; decision: TerminalDecision }
  | { type: 'ADVANCE_REVEAL' }
  | { type: 'SET_LEDGER_OVERRIDE'; atom: Atom; override: AtomOverride }
  | { type: 'SET_SPLIT_RECONSTRUCTION'; text: string }
  | { type: 'RECORD_ROUND_RESULT'; result: RoundResult }
  | { type: 'NEXT_ROUND' }
  | { type: 'NEW_GAME' }
  /* -------- one owner each, filled in by that task -------- */
  | { type: 'SET_VERIFY_CHOICE'; atom: Atom } //                      T4
  | { type: 'RESTORE_STATE'; state: GameState } //                    T5
  | { type: 'CLEAR_SAVED_STATE' } //                                  T5
  | { type: 'SET_AI_HOP'; hopIndex: number; text: string } //         T6
  | { type: 'SET_TURING_GUESS'; hopIndex: number } //                 T6
  | { type: 'JOIN_ROOM'; code: string; playerId: string; isHost: boolean } // T7
  | { type: 'SYNC_ROOM_STATE'; payload: unknown } //                  T7
  | { type: 'ASSIGN_IMPOSTER'; assignment: ImposterAssignment } //    T8
  | { type: 'CAST_ACCUSATION'; player: string } //                    T8
  | { type: 'REVEAL_ROLES' } //                                       T8
  | { type: 'SET_PREDICTION'; player: string; atom: Atom } //         T9
  | { type: 'ADD_REACTION'; hopIndex: number; reaction: string }; //  T9

/* ----------------------------------------------------------- initial state -- */

export function emptyRound(): RoundState {
  return {
    claim: null,
    hops: [],
    dealtCards: [],
    currentHop: 0,
    verifications: [],
    verificationsLeft: 0,
    overrides: {},
    terminalDecision: null,
    verifyChoice: null,
    predictions: {},
    imposter: null,
    accusation: null,
    aiHopIndexes: [],
    turingGuess: null,
    splitAssignments: [],
    splitReconstruction: '',
    revealStep: 0,
  };
}

export function settingsForPreset(presetId: string, mode: Mode): Settings {
  const preset = getPreset(presetId);
  return {
    mode,
    presetId: preset.id,
    chainLength: preset.chainLength,
    timerSeconds: preset.timerSeconds,
    cardIds: cardsForPreset(preset),
    aiHops: preset.aiHops,
    verifyBudget: preset.verifyBudget,
    blackBox: preset.blackBox,
  };
}

export const initialState: GameState = {
  version: STATE_VERSION,
  screen: 'lobby',
  settings: settingsForPreset(DEFAULT_PRESET_ID, 'chain'),
  players: [],
  round: emptyRound(),
  session: { results: [], roundNumber: 1 },
  room: { code: null, playerId: null, isHost: false, status: 'offline', lastSyncAt: null },
  briefSeen: false,
  packClaims: null,
};

/* --------------------------------------------------------------- reducer --- */

export function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'ADVANCE': {
      /* A screen that skips itself dispatches this from an effect, and React
         StrictMode runs effects twice on mount. Without `from`, the second
         run steps a second time and a screen gets skipped that nobody meant
         to skip — CROWD RECALL lost its whole distribute beat this way.
         Naming the screen you are leaving makes a repeat dispatch a no-op. */
      if (action.from && action.from !== state.screen) return state;

      const route = routeFor(state.settings.mode);
      const at = route.indexOf(state.screen);
      if (at < 0) return { ...state, screen: 'lobby' };
      if (at >= route.length - 1) return state;
      return { ...state, screen: route[at + 1] };
    }

    case 'GO_TO':
      return { ...state, screen: action.screen };

    case 'ADD_PLAYER': {
      const name = action.name.trim();
      if (!name) return state;
      const player: Player = { id: makePlayerId(name, state.players.length), name };
      return { ...state, players: [...state.players, player] };
    }

    case 'REMOVE_PLAYER':
      return { ...state, players: state.players.filter((p) => p.id !== action.id) };

    case 'SET_MODE':
      return { ...state, settings: { ...state.settings, mode: action.mode } };

    case 'SET_PRESET':
      /* Resolve the whole settings block from the preset. The prototype kept a
         separate card filter that disagreed with the preset it claimed. */
      return { ...state, settings: settingsForPreset(action.presetId, state.settings.mode) };

    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'BEGIN_ROUND': {
      /* Straight to the brief. `howToPlay` sits in the route so it has a
         registered place, but it is reached from the lobby on request — a
         round should not open with the explainer every time. */
      return {
        ...state,
        screen: 'brief',
        round: {
          ...emptyRound(),
          claim: action.setup.claim,
          dealtCards: action.setup.dealtCards,
          aiHopIndexes: action.setup.aiHopIndexes,
          splitAssignments: action.setup.splitAssignments,
          imposter: action.setup.imposter,
          verificationsLeft: state.settings.verifyBudget,
        },
      };
    }

    case 'SUBMIT_HOP': {
      const index = state.round.currentHop;
      if (index >= state.settings.chainLength) return state;

      const hop: Hop = {
        player: hopPlayerName(state, index),
        text: action.text,
        cardId: state.round.dealtCards[index] ?? null,
      };
      if (state.round.aiHopIndexes.includes(index)) hop.isAI = true;
      if (state.round.imposter?.hopIndex === index) hop.isImposter = true;

      const currentHop = index + 1;
      const done = currentHop >= state.settings.chainLength;
      return {
        ...state,
        screen: done ? 'terminal' : state.screen,
        round: { ...state.round, hops: [...state.round.hops, hop], currentHop },
      };
    }

    case 'SPEND_VERIFICATION': {
      if (state.round.verificationsLeft <= 0) return state;
      /* A check restores the listed atoms AT THIS HOP ONLY. The prototype
         skipped every hop from the check onward, which made atoms immortal. */
      return {
        ...state,
        round: {
          ...state.round,
          verificationsLeft: state.round.verificationsLeft - 1,
          verifications: [
            ...state.round.verifications,
            { hopIndex: action.hopIndex, atoms: action.atoms },
          ],
        },
      };
    }

    case 'SET_TERMINAL_DECISION':
      return { ...state, round: { ...state.round, terminalDecision: action.decision } };

    case 'ADVANCE_REVEAL':
      return { ...state, round: { ...state.round, revealStep: state.round.revealStep + 1 } };

    case 'SET_LEDGER_OVERRIDE':
      /* The engine proposes, the room decides. */
      return {
        ...state,
        round: {
          ...state.round,
          overrides: { ...state.round.overrides, [action.atom]: action.override },
        },
      };

    case 'SET_SPLIT_RECONSTRUCTION':
      /* CROWD RECALL's synthetic hop lives here and never enters `hops`, so it
         cannot follow the group back to the lobby the way the prototype's did. */
      return { ...state, round: { ...state.round, splitReconstruction: action.text } };

    case 'RECORD_ROUND_RESULT': {
      /* The prototype pushed this from inside the ledger render, so every
         re-render counted the round again. One result per round, guarded. */
      if (state.session.results.length >= state.session.roundNumber) return state;

      /* T6 — whether the room found the machine is derived here rather than
         passed in, because the reducer is what holds both halves: the hop the
         room voted for and the hops the machine actually took. It stays null
         when there was no machine hop or the room never voted. */
      const { turingGuess, aiHopIndexes } = state.round;
      const turingCorrect =
        turingGuess === null || !aiHopIndexes.length ? null : aiHopIndexes.includes(turingGuess);

      return {
        ...state,
        session: {
          ...state.session,
          results: [...state.session.results, { ...action.result, turingCorrect }],
        },
      };
    }

    case 'NEXT_ROUND':
      return {
        ...state,
        round: emptyRound(),
        session: { ...state.session, roundNumber: state.session.roundNumber + 1 },
      };

    case 'NEW_GAME':
      /* Keep the people in the room and how they set it up. Drop the play. */
      return {
        ...initialState,
        players: state.players,
        settings: state.settings,
      };

    /* ======================================================================
       BELOW: one owner each. Fill in YOUR case. Do not add a new one.
       ====================================================================== */

    case 'SET_VERIFY_CHOICE':
      /* T4 — which atom the final reader would check first. Never scored. */
      return { ...state, round: { ...state.round, verifyChoice: action.atom } };

    case 'RESTORE_STATE':
      /* T5 — rehydrate from sessionStorage after the resume prompt. loadState()
         already discarded anything with a mismatched version, so the payload
         here is trusted as-is. */
      return action.state;

    case 'CLEAR_SAVED_STATE':
      /* T5 — explicit "start fresh". A different group may have picked up the
         device, so this drops players too, unlike NEW_GAME. */
      return initialState;

    case 'SET_AI_HOP': {
      /* T6 — the machine's rewrite, audited by the same ledger as everyone.

         This carries the hop index it was generated for, and SUBMIT_HOP does
         not. That matters because the machine's turn is the only one that
         arrives over the network: a slow response can land after the room has
         already moved on, and submitting it at whatever `currentHop` happens
         to be by then would write the machine's text into a person's hop. */
      const { hopIndex, text } = action;
      if (hopIndex !== state.round.currentHop) return state;
      if (hopIndex >= state.settings.chainLength) return state;
      if (!state.round.aiHopIndexes.includes(hopIndex)) return state;

      const hop: Hop = {
        player: hopPlayerName(state, hopIndex),
        text,
        cardId: state.round.dealtCards[hopIndex] ?? null,
        isAI: true,
      };

      const currentHop = hopIndex + 1;
      const done = currentHop >= state.settings.chainLength;
      return {
        ...state,
        screen: done ? 'terminal' : state.screen,
        round: { ...state.round, hops: [...state.round.hops, hop], currentHop },
      };
    }

    case 'SET_TURING_GUESS':
      /* T6 — which hop the room voted was the machine. Recorded, never
         scored: the room does not win by finding it, and most rooms do not. */
      return { ...state, round: { ...state.round, turingGuess: action.hopIndex } };

    case 'JOIN_ROOM':
      /* T7 — code, playerId, host flag. */
      return state;

    case 'SYNC_ROOM_STATE':
      /* T7 — reconcile the 1.5s poll against optimistic local state. */
      return state;

    case 'ASSIGN_IMPOSTER':
      /* T8 — exactly one, never first or last hop. */
      return state;

    case 'CAST_ACCUSATION':
      /* T8 — the room's vote. Never scored. */
      return state;

    case 'REVEAL_ROLES':
      /* T8 — imposter and machine revealed together. */
      return state;

    case 'SET_PREDICTION':
      /* T9 — which atom this player thinks dies first. Room aggregate only. */
      return state;

    case 'ADD_REACTION':
      /* T9 — ephemeral. Never stored, never counted. */
      return state;

    default:
      return state;
  }
}

/* --------------------------------------------------------------- helpers --- */

function makePlayerId(name: string, index: number): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug || 'player'}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Who takes hop `index`. Players cycle if the chain is longer than the room. */
export function hopPlayerName(state: GameState, index: number): string {
  if (!state.players.length) return `Player ${index + 1}`;
  return state.players[index % state.players.length].name;
}

/** The card in front of the player right now. */
export function currentCardId(state: GameState): CardId | null {
  return state.round.dealtCards[state.round.currentHop] ?? null;
}

/** What the next player sees: the previous hop, or the claim itself at hop 0. */
export function textInFrontOfPlayer(state: GameState): string {
  const { hops, claim } = state.round;
  if (!hops.length) return claim?.originalText ?? '';
  return hops[hops.length - 1].text;
}

/** The version that reached the end of the chain. */
export function finalText(state: GameState): string {
  const hops = hopsForLedger(state);
  return hops.length ? hops[hops.length - 1].text : (state.round.claim?.originalText ?? '');
}

/**
 * The hops the ledger audits.
 *
 * CROWD RECALL has no chain — it has one reconstruction the group built
 * together. It is synthesised here, at read time, rather than being written
 * into `round.hops` and surviving into the next round.
 */
export function hopsForLedger(state: GameState): Hop[] {
  if (state.settings.mode !== 'crowd') return state.round.hops;
  if (!state.round.splitReconstruction) return [];
  return [{ player: 'The room', text: state.round.splitReconstruction, cardId: null }];
}

/**
 * Bug the prototype shipped: twelve players on a five-hop chain meant seven
 * people never played, and nothing said so.
 */
export function selectLobbyWarnings(state: GameState): LobbyWarning[] {
  const warnings: LobbyWarning[] = [];
  const players = state.players.length;
  const { chainLength, mode } = state.settings;

  if (players > 0 && players < 3) {
    warnings.push({
      kind: 'too-few-players',
      message: 'A chain needs at least three people before the decay is worth reading.',
    });
  }

  if (mode === 'crowd') return warnings;

  if (players > chainLength) {
    const idle = players - chainLength;
    warnings.push({
      kind: 'players-idle',
      message: `${idle} of ${players} players won't take a hop. Lengthen the chain, or expect people to watch.`,
    });
  } else if (players > 0 && chainLength > players) {
    warnings.push({
      kind: 'chain-too-long',
      message: `The chain is longer than the room, so some people take more than one hop.`,
    });
  }

  return warnings;
}

/* -------------------------------------------------- round setup (impure) --- */
/* Called once from GameContext, never from the reducer.                      */

function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A claim this session has not played yet, if there is one. */
export function pickClaim(claims: Claim[], playedIds: string[]): Claim {
  const unplayed = claims.filter((c) => !playedIds.includes(c.id));
  const pool = unplayed.length ? unplayed : claims;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Deal one card per hop, avoiding the same card twice in a row. */
export function dealCards(cardIds: CardId[], chainLength: number): CardId[] {
  if (!cardIds.length) return Array.from({ length: chainLength }, () => null as unknown as CardId);
  const dealt: CardId[] = [];
  let bag: CardId[] = [];
  for (let i = 0; i < chainLength; i++) {
    if (!bag.length) bag = shuffle(cardIds);
    let next = bag.shift();
    if (dealt.length && next === dealt[dealt.length - 1] && bag.length) {
      const swap = bag.shift();
      bag.unshift(next);
      next = swap;
    }
    dealt.push(next);
  }
  return dealt;
}

/**
 * CROWD RECALL. Everyone holds a version missing one property, and nobody is
 * told theirs was altered. There is deliberately no traitor here.
 */
export function buildSplitAssignments(claim: Claim, players: Player[]): SplitAssignment[] {
  const atoms = shuffle(ATOMS.slice());
  return players.map((p, i) => {
    const missingAtom = atoms[i % atoms.length];
    return { player: p.name, missingAtom, text: claim.degraded[missingAtom] };
  });
}

/**
 * Which hops the machine takes.
 *
 * Never first and never last, for two different reasons. Not first, because
 * the first hop is the only one that sees the claim itself and handing that to
 * a summariser skips the human step the round is about. Not last, because the
 * final version is what the terminal reader judges, and a machine writing it
 * turns the ending into a demo of a summariser rather than a record of a room.
 *
 * A chain too short to have a middle simply has no machine hop.
 */
export function pickAIHopIndexes(count: number, chainLength: number): number[] {
  if (count <= 0) return [];
  const eligible: number[] = [];
  for (let i = 1; i < chainLength - 1; i++) eligible.push(i);
  if (!eligible.length) return [];
  return shuffle(eligible).slice(0, Math.min(count, eligible.length)).sort((a, b) => a - b);
}

/** Everything random about a round, decided in one place, outside the reducer. */
export function prepareRound(state: GameState, claims: Claim[]): RoundSetup {
  const playedIds = state.session.results.map((r) => r.claimId);
  const claim = pickClaim(claims, playedIds);

  return {
    claim,
    dealtCards: dealCards(state.settings.cardIds, state.settings.chainLength),
    /* CROWD RECALL has no chain to place a hop in — everyone reads at once. */
    aiHopIndexes:
      state.settings.mode === 'crowd'
        ? []
        : pickAIHopIndexes(state.settings.aiHops, state.settings.chainLength),
    splitAssignments:
      state.settings.mode === 'crowd' ? buildSplitAssignments(claim, state.players) : [],
    /* T8 assigns the imposter here — exactly one, never first or last. */
    imposter: null,
  };
}
