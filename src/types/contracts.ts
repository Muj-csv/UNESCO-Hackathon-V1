/* ============================================================================
   TruthChain — frozen contracts
   ----------------------------------------------------------------------------
   FROZEN. Adding a field here means every open branch rebases.

   Every shape T1–T10 will need is already present, including fields nothing
   reads yet. If you genuinely need a new one, say so rather than adding it.

   Never redefine any of these shapes locally.
   ========================================================================== */

/* ------------------------------------------------------- integrity atoms -- */
/* The entire measurement system. Nothing else is ever scored.                */

export type Atom = 'SOURCE' | 'NUMBER' | 'HEDGE' | 'SCOPE' | 'CAUSE';

export const ATOMS: readonly Atom[] = ['SOURCE', 'NUMBER', 'HEDGE', 'SCOPE', 'CAUSE'];

/* --------------------------------------------------------- constraint cards */
/* Six real pressures. None of them instructs a player to distort anything.   */

export type CardId = 'chars' | 'headline' | 'land' | 'secs' | 'audience' | 'certain';

/** T1: compression cards tap words out, the other three rewrite freely. */
export type CardInput = 'redact' | 'free';

export interface ConstraintCard {
  id: CardId;
  /** Display name, shown uppercase on the card face. */
  name: string;
  /** The pressure, in the player's own terms. Never an instruction to distort. */
  note: string;
  /** Atoms this pressure tends to endanger. Used for dealing, never for scoring. */
  targets: Atom[];
  input: CardInput;
  /** `chars` only. */
  charLimit?: number;
  /** `secs` only — 25. The prototype named the pressure without changing the clock. */
  timerOverride?: number;
}

/* ------------------------------------------------------------------ claims */

export interface AtomTruth {
  /** What this atom holds in this claim, in plain words. Shown in the ledger. */
  truth: string;
  /** The canonical phrase in `originalText`. The ledger's "Original:" line. */
  phrase?: string;
  /** Any of these surviving in a hop means the atom survived. */
  keywords?: string[];
  /** Any of these appearing in a hop means the atom died by overreach. */
  overreach?: string[];
}

export interface Claim {
  id: string;
  topic: string;
  lang: 'en' | 'tl';
  originalText: string;
  atoms: Record<Atom, AtomTruth>;
  /** Authored, not regex-generated. One variant per atom, that atom degraded
      and the other four intact. CROWD RECALL deals these out. */
  degraded: Record<Atom, string>;
}

/* -------------------------------------------------------------------- hops */

export interface Hop {
  player: string;
  text: string;
  cardId: CardId | null;
  /** T6. The ledger attributes deaths here to "(AI participant)". */
  isAI?: boolean;
  /** T8. Never present in a client payload before the reveal. */
  isImposter?: boolean;
  /** Hard-tagged when known, rather than inferred. */
  atomsLost?: Atom[];
  /** BBB-004, APPROVED. Nobody authored this one: the clock ran out, the host
      force-advanced, or a wave filled for an absent player, and the text in
      front of them passed on unchanged. Additive and optional — every hop
      written before this existed reads as `undefined`, i.e. authored, which
      is what they were. The ledger must not present a forfeit as a retelling:
      "chose to keep it intact" and "never got to it" are different facts and
      the room needs to be able to tell them apart in the debrief. */
  forfeited?: boolean;
}

/* ----------------------------------------------------------- the ledger --- */

export type DeathKind = 'overreach' | 'dropped';

/**
 * How much the engine trusts its own reading.
 * `uncertain` rows are the ones the room adjudicates (T2 part C).
 */
export type Confidence = 'authored' | 'matched' | 'uncertain' | 'override';

export interface AtomVerdict {
  atom: Atom;
  alive: boolean;
  deathHop: number | null;
  deathPlayer: string | null;
  deathCardId: CardId | null;
  originalPhrase: string | null;
  finalPhrase: string | null;
  deathKind: DeathKind | null;
  /** A mid-chain check restored it — at that hop only. */
  recovered: boolean;
  confidence: Confidence;
}

export type LedgerResult = Record<Atom, AtomVerdict>;

/** A mid-chain check. Restores the listed atoms AT THIS HOP ONLY. */
export interface Verification {
  hopIndex: number;
  atoms: Atom[];
}

/** T2 part C — the engine proposes, the room decides. */
export type AtomOverride = 'alive' | 'lost';
export type LedgerOverrides = Partial<Record<Atom, AtomOverride>>;

/** T9. A tap during the reveal. Ephemeral — the reducer keeps only a short
    rolling window, never counted and never the basis of a superlative. */
export interface Reaction {
  hopIndex: number;
  emoji: string;
}

/* ------------------------------------------------------------------ modes -- */

export type Mode = 'chain' | 'badfaith' | 'crowd';

/* --------------------------------------------------------------- screens --- */
/* The full route exists from day one. Unbuilt screens self-skip.             */

export type ScreenId =
  | 'lobby'
  | 'joinRoom'
  | 'howToPlay'
  | 'brief'
  | 'prediction'
  | 'round'
  | 'terminal'
  | 'reveal'
  | 'blackboxGuess'
  | 'turingHop'
  | 'accusation'
  | 'thesis'
  | 'ledger'
  | 'debrief'
  | 'superlatives'
  | 'sessionReadout'
  | 'splitDistribute'
  | 'splitReconstruct'
  | 'packStudio';

/* ------------------------------------------------ presets and constraints -- */

export type ConstraintSetId = 'all' | 'compression' | 'engagement' | 'speed';

export interface ConstraintSet {
  id: ConstraintSetId;
  name: string;
  note: string;
  cards: CardId[];
}

export interface Preset {
  id: string;
  name: string;
  note: string;
  constraintSet: ConstraintSetId;
  chainLength: number;
  timerSeconds: number;
  /** T6. Randomised placement, never first or last. */
  aiHops: number;
  /** Mid-chain checks the chain may spend. Separate from T4's terminal Verify. */
  verifyBudget: number;
  /** Hides hop authors during play; adds the blackboxGuess beat. */
  blackBox: boolean;
}

export interface Settings {
  mode: Mode;
  presetId: string;
  chainLength: number;
  timerSeconds: number;
  /** Resolved from the constraint set. Nothing filters this again downstream. */
  cardIds: CardId[];
  aiHops: number;
  verifyBudget: number;
  blackBox: boolean;
}

/* ----------------------------------------------------------------- people -- */

export interface Player {
  /** Stable across a reconnect (T7 carries it through T5's persistence). */
  id: string;
  name: string;
}

/* ---------------------------------------------------------- round in play -- */

export type TerminalDecision = 'share' | 'flag' | 'verify';

/** T8. Exactly one per round. Never first or last hop. */
export interface ImposterAssignment {
  player: string;
  hopIndex: number;
  /** A property to make die. The brief never says "lie". */
  targetAtom: Atom;
}

/** CROWD RECALL. Each player holds a version missing one atom, and is not told. */
export interface SplitAssignment {
  player: string;
  missingAtom: Atom;
  text: string;
}

export interface RoundState {
  claim: Claim | null;
  hops: Hop[];
  /** Card dealt per hop, index-aligned with `hops`. */
  dealtCards: (CardId | null)[];
  currentHop: number;
  verifications: Verification[];
  verificationsLeft: number;
  overrides: LedgerOverrides;
  terminalDecision: TerminalDecision | null;
  /** T4. Which atom the final reader would check first. Never scored. */
  verifyChoice: Atom | null;
  /** T9. Per player name, which atom they think dies first. Never ranked. */
  predictions: Record<string, Atom>;
  /** T9. A short rolling window of reveal taps. Ephemeral — never counted. */
  reactions: Reaction[];
  /** T8. */
  imposter: ImposterAssignment | null;
  accusation: string | null;
  /** T6. Which hop indexes the machine took, and which one the room voted for. */
  aiHopIndexes: number[];
  turingGuess: number | null;
  /* CROWD RECALL keeps its synthetic hop out of `hops` entirely, so it cannot
     follow the group back to the lobby the way the prototype's did. */
  splitAssignments: SplitAssignment[];
  splitReconstruction: string;
  revealStep: number;
}

/* --------------------------------------------------------------- session -- */

export interface RoundResult {
  claimId: string;
  mode: Mode;
  playedAt: number;
  verdicts: LedgerResult;
  lostAtoms: Atom[];
  firstLostAtom: Atom | null;
  /** T8 — the comparison the mode exists to produce. */
  deliberateAtoms: Atom[];
  accidentalAtoms: Atom[];
  /** T9 — room aggregate only. */
  predictions: Record<string, Atom>;
  /** T6 — did the room pick the machine? */
  turingCorrect: boolean | null;
  terminalDecision: TerminalDecision | null;
  verifyChoice: Atom | null;
}

export interface SessionState {
  results: RoundResult[];
  roundNumber: number;
}

/* ------------------------------------------------------------------ rooms -- */
/* T7 owns the chain-level room internals in src/state/room.ts. Only the bits
   the client state needs to hold live here.                                  */

export type RoomStatus = 'offline' | 'connecting' | 'connected' | 'error';

export interface RoomConnection {
  code: string | null;
  playerId: string | null;
  isHost: boolean;
  status: RoomStatus;
  lastSyncAt: number | null;
}

/* ------------------------------------------------------------ whole state -- */

export interface LobbyWarning {
  kind: 'players-idle' | 'chain-too-long' | 'too-few-players';
  message: string;
}

export interface GameState {
  /** T5 discards rather than rehydrating a stale shape. Bump on any change. */
  version: number;
  screen: ScreenId;
  settings: Settings;
  players: Player[];
  round: RoundState;
  session: SessionState;
  room: RoomConnection;
  /** T3 — the pre-hop brief shows once per session. */
  briefSeen: boolean;
  /** T10 — a pack loaded from a URL fragment, for this session only. */
  packClaims: Claim[] | null;
}
