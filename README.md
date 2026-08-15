# TruthChain

A media and information literacy game about how true information quietly stops being true.

UNESCO Youth Hackathon 2026 · *Play Your Part: Youth Designing the Future of Media and Information Literacy*

**Live:** `[VERCEL URL]`

---

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script | |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | typecheck + production build |
| `npm run preview` | serve the production build locally |
| `npm test` | run the test suite once |
| `npm run test:watch` | tests in watch mode |
| `npm run typecheck` | types only |

Requires Node 20+. There is nothing else to install and no environment variable
needed to play — the game runs fully offline-capable with no API key.

---

## Before you start — read this bit

Six people work in this repo in parallel. T0 settled the following so that
later tasks never collide.

### Files nobody edits

| File | Why |
|---|---|
| `src/types/contracts.ts` | **Frozen.** A new field means every open branch rebases. |
| `src/App.tsx` | The route is already registered in full, including screens nobody has built. |
| `src/screens/Round.tsx` | Composes `<AIHopBeat/>` and `<HopInput/>` — edit those instead. |
| `src/screens/Ledger.tsx` | Composes `<VerifyFeedback/>` — T2 owns the death rows, T4 never opens the file. |

If your task genuinely needs a change in one of these, **say so rather than
making it.**

### `gameReducer.ts`

Every action name T1–T10 needs is already there with an empty handler.
**Fill in your `case`. Do not add one** — adding shifts the surrounding lines
and conflicts on merge with four other branches.

### `styles/global.css`

**Append at the bottom only**, in a block with feature-prefixed class names
(`redact-`, `ledger-diag-`, `verify-`, …). Never edit another feature's block.
Do not restyle existing screens; the visual identity is settled.

### One owner per file

| Task | Owns |
|---|---|
| **T1** word-tap redaction | `engine/redact.ts` · `components/HopInput.tsx` · `components/RedactEditor.tsx` |
| **T2** enriched ledger | `engine/ledger.ts` (presentation data) · `screens/Ledger.tsx` death rows |
| **T3** onboarding | `screens/HowToPlay.tsx` · `screens/Brief.tsx` · `screens/Thesis.tsx` |
| **T4** verify before share | `components/VerifyFeedback.tsx` · `screens/Terminal.tsx` |
| **T5** persistence | `state/persistence.ts` |
| **T6** AI participants | `api/ai-hop.ts` · `engine/fallbacks.ts` · `components/AIHopBeat.tsx` · `screens/TuringHop.tsx` |
| **T7** rooms | `api/room.ts` · `state/room.ts` · `screens/JoinRoom.tsx` |
| **T8** BAD FAITH | `screens/Accusation.tsx` |
| **T9** prediction + reactions | `components/PredictionPrompt.tsx` · `components/ReactionBar.tsx` · `screens/Prediction.tsx` |
| **T10** pack authoring | `screens/PackStudio.tsx` · `engine/packCodec.ts` · `engine/validateClaim.ts` |

Every one of those files already exists as a stub, with the constraints your
task must not break written at the top of it. Read that comment first.

### A trap worth knowing

React StrictMode runs effects **twice**. A screen that advances itself from an
effect must pass its own id:

```ts
dispatch({ type: 'ADVANCE', from: 'turingHop' });
```

Without `from`, the second run steps a second time and a screen is skipped
with no error anywhere. CROWD RECALL silently lost its entire distribute beat
this way once already.

---

## Structure

```
src/
  types/contracts.ts        Atom, Claim, Hop, LedgerResult — FROZEN
  data/
    claims.en.json          claim library
    claims.tl.json          Taglish pack — empty, not built
    cards.ts                the six constraint cards
    presets.ts              pressure environments
  engine/
    normalize.ts            punctuation, number-form, case normalisation
    ledger.ts               computeLedger — PURE FUNCTION, unit tested
    redact.ts               word-tap tokenisation (T1)
    fallbacks.ts            pre-generated AI rewrites (T6)
  state/
    gameReducer.ts          all state transitions
    GameContext.tsx         provider + hooks
    persistence.ts          sessionStorage serialise/rehydrate (T5)
  screens/*.tsx             one screen per file
  components/*.tsx          shared UI
  styles/global.css         append-only below the marker
api/
  ai-hop.ts                 AI participant proxy (T6) — returns 501 today
  room.ts                   room state read/write (T7) — returns 501 today
```

Engine functions are pure: `computeLedger` takes claim + hops + verifications
and returns a result. No DOM, no fetch, no state. That is what makes the
signature screen testable, and the ledger is the one part of this project that
has to be defensible.

The reducer is pure too. Anything random — which claim, which cards, which hop
is the machine — is decided in `prepareRound()` and arrives as an action
payload, because StrictMode double-invokes reducers.

---

## Rules that are not up for negotiation

1. **No score, no leaderboard, no ranking, no points.** The Decay Ledger is the
   only fidelity signal. Removing scoring was deliberate and costly: a scored
   version teaches students that some people are careless, when the truth is
   that everyone is subject to the same pressures.
2. **No card and no brief ever says "lie."** The imposter's brief targets a
   *property* ("make HEDGE die"), never the truth.
3. **AI is a participant under observation, never an assistant to the player.**
   Nobody uses it to play better.
4. **AI never adjudicates whether an atom survived.** That stays with the room.
5. **Fabricated claims only.** No real people, organisations, agencies or events.
6. **Text only for scored play.** Drawing kills all five atoms every round and
   would make the ledger meaningless.
7. **No accounts, no user data, no analytics.** Room state is ephemeral and
   expires. Users are minors in classrooms.
8. **Never add a traitor to CROWD RECALL.** Its entire lesson requires the
   absence of one. There is a test asserting this.

### Copy tone: name the part, clear the person

The ledger records the part each person played — but the thesis is that nobody
lied. Lead with the pressure, player in parentheses:

```
CAUSE — LOST AT HOP 5
Trigger:   SOUND CERTAIN  (Mark's turn)
Original:  "associated with"
Final:     "causes"
```

Never write copy that reads as accusation.

---

## Deployment

Static Vite build plus serverless functions in `/api`, on Vercel. It detects
Vite automatically — no `vercel.json` is needed.

Preview deployments are on, so **every branch gets its own URL**. Test on a
real phone before opening a PR; that is what the users have.

`main` is protected and requires one review.

---

*All claims used in TruthChain are fabricated and clearly labelled as fictional
in-game. No real people, organisations or events are referenced.*
