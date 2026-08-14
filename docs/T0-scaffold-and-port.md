# T0 — Scaffold, Port, Deploy

**First, and alone.** Nothing else starts until this is on `main` with a working Vercel URL.

Estimated: 4–6 hours.

---

## Goal

Stand up a React + TypeScript + Vite project, port the existing single-file prototype into it with **identical behaviour**, and deploy to Vercel.

This is a migration, not a redesign. Every improvement made here is a merge conflict for someone else tomorrow.

---

## Phase 1 — Scaffold

```bash
npm create vite@latest truthchain -- --template react-ts
```

- Set `"strict": false` in `tsconfig.json`
- Delete Vite boilerplate CSS and assets
- Port the prototype's entire `<style>` block into `src/styles/global.css` **unchanged**, import once in `main.tsx`
- Remove the Google Fonts `<link>`. Install `@fontsource/fraunces`, `@fontsource-variable/inter`, `@fontsource/ibm-plex-mono` and import them in `main.tsx`

## Phase 2 — Contracts and data

Create `src/types/contracts.ts` with the frozen shapes. Minimum:

```ts
export type Atom = "SOURCE"|"NUMBER"|"HEDGE"|"SCOPE"|"CAUSE";
export type CardId = "chars"|"headline"|"land"|"secs"|"audience"|"certain";

export interface AtomTruth { keywords?: string[]; overreach?: string[]; truth: string; phrase?: string; }

export interface Claim {
  id: string; topic: string; lang: "en"|"tl";
  originalText: string;
  atoms: Record<Atom, AtomTruth>;
  degraded: Record<Atom, string>;   // authored, not regex-generated
}

export interface Hop {
  player: string; text: string; cardId: CardId | null;
  isAI?: boolean;
  isImposter?: boolean;
  atomsLost?: Atom[];               // hard-tagged when known
}

export interface AtomVerdict {
  atom: Atom; alive: boolean;
  deathHop: number | null; deathPlayer: string | null; deathCardId: CardId | null;
  originalPhrase: string | null; finalPhrase: string | null;
  deathKind: "overreach" | "dropped" | null;
  recovered: boolean;
  confidence: "authored" | "matched" | "uncertain" | "override";
}
export type LedgerResult = Record<Atom, AtomVerdict>;
```

Then port `cards.ts` and `presets.ts`. Add `targets: Atom[]` and `timerOverride?: number` to cards — `secs` gets `timerOverride: 25`, which the prototype never applied.

Port the existing claims into `src/data/claims.en.json`. **Replace the PAGASA reference** with a fictional equivalent (a real named agency violates the design rules) and give the new SOURCE several keyword phrasings.

## Phase 3 — State

`src/state/gameReducer.ts` and `GameContext.tsx`. The old `S` object maps almost one to one.

Fix these prototype bugs during the port:

- `session.results.push()` sat inside the ledger render, double-counting on re-render → move to a `RECORD_ROUND_RESULT` action
- SPLIT permanently set `chainLength = 1`, following the user back to the lobby → keep SPLIT's synthetic hop in a separate field
- Verification skipped every hop from the check onward, making atoms immortal → a check restores the atom *at that hop only*
- Standard preset claimed all six cards but filtered to two → add an `"All"` constraint set
- 12 players with a 5-hop chain means 7 never play, with no warning → expose a derived warning

Drop the `_draft`, `_cardShownFor`, `_passHidden` workarounds. Those existed because the prototype destroyed the DOM on every render; component state replaces them.

## Phase 4 — Engine

`src/engine/ledger.ts` as a **pure function**:

```ts
computeLedger(claim, hops, verifications, overrides): LedgerResult
```

Port the existing logic, plus `src/engine/normalize.ts` so `"10cm"`, `"10 cm"`, and `"ten centimeters"` all match a `"10cm"` keyword. The prototype's raw `includes()` produced false deaths and named real students as responsible for them.

Add Vitest and write tests for the engine. It is the one component that must be defensible.

## Phase 5 — Screens

Port each screen to its own file: Lobby, Round, Terminal, Reveal, BlackboxGuess, Ledger, Debrief, Superlatives, SessionReadout, SplitDistribute, SplitReconstruct.

App reads `screen` from context and renders from a registry — same pattern as the prototype's `screens` object, so it stays familiar.

## Phase 6 — Deploy

- Push to GitHub, import to Vercel. It detects Vite; no config needed.
- Confirm preview deployments are on — every branch gets a URL, so the team can test on phones without running anything.
- Protect `main`, require one review.
- Commit stub files at every path in `CLAUDE.md`'s file map so nobody invents a different location.

---

## Acceptance criteria

- [ ] Full CHAIN round plays: lobby → hops → terminal → reveal → ledger → debrief → superlatives
- [ ] Crowd Recall round completes
- [ ] `tsc --noEmit` passes
- [ ] Engine tests pass
- [ ] Zero external network requests on load
- [ ] Vercel URL loads on a phone
- [ ] Five listed bugs fixed
- [ ] No console errors

## Do not

- Restyle anything
- Add features from later tasks
- Add a state library, CSS framework, or animation library
