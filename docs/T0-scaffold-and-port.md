# T0 — Scaffold, Port, Deploy

**First, and alone.** Nothing else starts until this is on `main` with a working Vercel URL.

Estimated: 5–7 hours.

---

## Goal

Stand up a React + TypeScript + Vite project, port the existing single-file prototype into it with **identical behaviour**, and deploy to Vercel.

This is a migration, not a redesign. Every improvement made here is a merge conflict for someone else tomorrow.

---

## Phase 1 — Scaffold

```bash
npm create vite@latest brick-by-brick -- --template react-ts
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

## Phase 6 — Parallel-work scaffolding

**Twenty minutes here decides whether five people work in parallel or spend Day 2 resolving conflicts.** Do not skip it. Retrofitting this after three branches exist means rewriting all three.

Five later tasks would otherwise edit the same three files: `Round.tsx`, `Ledger.tsx`, and `gameReducer.ts`. The fix is to create the mount points now, so each task fills in **its own file** and never opens a shared host.

### 6a — Stub components

Create these as working-but-empty files. Each has exactly one future owner.

| File | Renders now | Owner |
|---|---|---|
| `src/components/HopInput.tsx` | the current textarea, moved out of `Round.tsx` | T1 |
| `src/components/AIHopBeat.tsx` | `null` | T6 |
| `src/components/VerifyFeedback.tsx` | `null` | T4 |
| `src/components/PredictionPrompt.tsx` | `null` | T9 |
| `src/components/ReactionBar.tsx` | `null` | T9 |
| `src/screens/HowToPlay.tsx` | placeholder heading | T3 |
| `src/screens/Brief.tsx` | placeholder heading | T3 |
| `src/screens/Thesis.tsx` | placeholder heading | T3 |
| `src/screens/TuringHop.tsx` | skips itself, advances | T6 |
| `src/screens/Accusation.tsx` | skips itself, advances | T8 |
| `src/screens/PackStudio.tsx` | placeholder heading | T10 |

Then wire them:

- `Round.tsx` composes `<AIHopBeat/>` and `<HopInput/>`. **Nobody edits `Round.tsx` again.** T1 rewrites `HopInput`; T6 fills `AIHopBeat`.
- `Ledger.tsx` imports `<VerifyFeedback/>` on a single line. T2 rewrites the death rows freely; T4 never opens the file.

A screen that "skips itself" checks whether its feature is enabled and immediately dispatches to the next screen if not. That way the full route exists from day one and no later task has to touch routing.

### 6b — Register the full route order now

Including screens that currently do nothing:

```
lobby → howToPlay → brief → prediction → round → terminal
      → reveal → blackboxGuess → turingHop → accusation
      → thesis → ledger → debrief → superlatives → sessionReadout
```

Each not-yet-built screen self-skips. This means T3, T6, and T8 each fill in their own screen without three people editing the router.

### 6c — Stub every action name

Add all of these to `gameReducer.ts` now, with empty handlers that return state unchanged. **T4, T5, T6, T8, and T9 all need to add actions**, and four branches editing one switch statement conflicts on every merge.

```
SET_VERIFY_CHOICE       T4
RESTORE_STATE           T5
CLEAR_SAVED_STATE       T5
SET_AI_HOP              T6
SET_TURING_GUESS        T6
JOIN_ROOM               T7
SYNC_ROOM_STATE         T7
ASSIGN_IMPOSTER         T8
CAST_ACCUSATION         T8
REVEAL_ROLES            T8
SET_PREDICTION          T9
ADD_REACTION            T9
```

Each task fills its own `case` rather than adding one, so the surrounding lines never move and git merges cleanly.

### 6d — Include forward-looking fields in `contracts.ts`

Already covered in Phase 2, but confirm these exist before you finish: `Hop.isAI`, `Hop.isImposter`, `Hop.atomsLost`, `AtomVerdict.originalPhrase`, `AtomVerdict.finalPhrase`, `AtomVerdict.deathKind`, `AtomVerdict.confidence`.

Adding a field to a frozen type later means every branch rebases.

**Done when:** a full round still plays, every stub file exists and is imported, and `grep` for each action name finds it in the reducer.

---

## Phase 7 — Deploy

- Push to GitHub, import to Vercel. It detects Vite; no config needed.
- Confirm preview deployments are on — every branch gets a URL, so the team can test on phones without running anything.
- Protect `main`, require one review.
- Commit the Phase 6 stubs and every remaining path in `CLAUDE.md`'s file map, so nobody invents a different location.
- Post to the team: one owner per file, and **nobody edits `Round.tsx`, `Ledger.tsx`, `App.tsx`, `contracts.ts`, or the router** — those are settled.

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
- [ ] Every stub component and screen from Phase 6a exists and is imported
- [ ] `Round.tsx` and `Ledger.tsx` compose their children — no later task needs to edit either
- [ ] Full route registered, unbuilt screens self-skip
- [ ] All twelve action names present in the reducer
- [ ] Forward-looking fields present in `contracts.ts`

## Do not

- Restyle anything
- Add features from later tasks
- Add a state library, CSS framework, or animation library
