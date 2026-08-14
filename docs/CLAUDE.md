# CLAUDE.md

Project context for Claude Code. Read fully before touching any file.

---

## What this is

**TruthChain** — a media and information literacy game where a true claim degrades as people (and an AI) retell it under pressure, and a **Decay Ledger** diagnoses exactly what was lost, where, and why.

Built for the UNESCO Youth Hackathon 2026. Theme: *Play Your Part: Youth Designing the Future of Media and Information Literacy*.

Nobody is ever told to lie. That is the point.

## The five Integrity Atoms

The entire measurement system. Nothing else is scored, ever.

| Atom | Holds | How it dies |
|---|---|---|
| `SOURCE` | who says so | "studies show" with nobody named |
| `NUMBER` | the figure and its base | percentage with the denominator dropped |
| `HEDGE` | may / suggests / preliminary | early finding retold as settled |
| `SCOPE` | who, where, when | one campus becomes everywhere |
| `CAUSE` | correlational vs causal | "linked to" becomes "causes" |

## The six constraint cards

`chars` 90 CHARACTERS · `headline` HEADLINE ONLY · `land` MAKE IT LAND · `secs` 25 SECONDS · `audience` YOUR AUDIENCE BELIEVES… · `certain` SOUND CERTAIN

Each names a real pressure. **None instructs a player to distort.**

## Three modes

| Mode | Villain | Lesson |
|---|---|---|
| **CHAIN** | none | decay needs no bad actor |
| **BAD FAITH** | one hidden imposter | the accidents do more damage than the sabotage |
| **CROWD RECALL** | none, structurally | a group can't recover what nobody holds |

BAD FAITH and CROWD RECALL are a deliberate matched pair. **Never add a traitor to CROWD RECALL** — its entire lesson requires the absence of one.

---

## Stack

- **React 18 + TypeScript + Vite**
- `tsconfig` with `strict: false`. Types on contracts, loose in components.
- **Global CSS** ported from the original prototype, using CSS custom properties. No Tailwind, no CSS modules, no styled-components.
- **`useReducer` + Context** for game state. Not `useState` sprawl, not Redux, not Zustand.
- Deployed on **Vercel**: static build plus serverless functions in `/api`.
- **Polling, not WebSockets**, for multiplayer rooms. Turn-based, ~30s between updates, eight players. Serverless functions cannot hold open connections, and a 1.5s poll is imperceptible here.

**Do not add dependencies without asking.** Do not introduce a state library, a CSS framework, an animation library, or a WebSocket service.

---

## Hard design constraints

1. **No score, no leaderboard, no ranking, no points.** The Decay Ledger is the only fidelity signal. BAD FAITH does not score the imposter or the room. This is deliberate — do not add competitive framing "just in case."
2. **No card and no brief ever says "lie."** The imposter's brief targets a *property* ("make HEDGE die"), never the truth.
3. **AI is a participant under observation, never an assistant to the player.** Nobody uses it to play better.
4. **AI never adjudicates whether an atom survived.** That stays with the room. A game about opaque systems does not seat an opaque system as judge.
5. **Fabricated claims only.** No real people, organisations, agencies, or events.
6. **Text only for scored play.** Drawing kills all five atoms every round and would make the ledger meaningless.
7. **No accounts, no user data, no analytics.** Room state is ephemeral and expires. Users are minors in classrooms.

## Copy tone: name the part, clear the person

Theme is *Play Your Part*. The ledger records the part each person played — but the thesis is that nobody lied. **Never write copy that reads as accusation.** Lead with the pressure, player in parentheses:

```
CAUSE — LOST AT HOP 5
Trigger:   SOUND CERTAIN  (Mark's turn)
Original:  "associated with"
Final:     "causes"
```

---

## File map

```
src/
  types/contracts.ts        Atom, Claim, Hop, LedgerResult — FROZEN, protected
  data/
    claims.en.json          claim library
    claims.tl.json          Taglish pack
    cards.ts                the six constraint cards
    presets.ts              pressure environments
  engine/
    normalize.ts            punctuation, number-form, case normalisation
    ledger.ts               computeLedger — PURE FUNCTION, unit tested
    redact.ts               word-tap tokenisation and reassembly
    fallbacks.ts            pre-generated AI rewrites
  state/
    gameReducer.ts          all state transitions
    GameContext.tsx         provider + hooks
    persistence.ts          sessionStorage serialise/rehydrate
  screens/*.tsx             one screen per file
  components/*.tsx          shared UI
  styles/global.css         ported wholesale, do not restyle
api/
  ai-hop.ts                 AI participant proxy
  room.ts                   room state read/write (polling target)
```

## Conventions

- **Engine functions are pure.** `computeLedger` takes claim + hops + verifications and returns a result. No DOM, no fetch, no state. This is what makes the signature screen testable.
- **Screens read from context, dispatch actions.** No screen mutates state directly.
- **Import types from `src/types/contracts.ts`.** Never redefine a shape locally.
- **Reuse existing CSS.** Variables: `--ink`, `--ink-soft`, `--ink-line`, `--paper`, `--paper-text`, `--cream`, `--amber`, `--teal`, `--red`, `--violet`, `--font-display`, `--font-body`, `--font-mono`. Dark `.card` for chrome, light `.paper` for anything representing claim text. New classes get a feature prefix.
- **Do not restyle existing screens.** The visual identity is settled.

## AI participant safety

The system prompt for `api/ai-hop.ts` must constrain the model to **compress or rephrase only the text it was given.** It may not introduce new facts, entities, numbers, or claims. Minors are in the room and the output goes on a shared screen.

Always ship with fallbacks: on timeout or error, use a pre-generated rewrite from `engine/fallbacks.ts` and continue silently. **The room must never see an error at the emotional peak of a round.**

---

## Working rules

- **One task per session.** Read `tasks/TN-*.md`, do it, stop.
- **Do not edit files outside the task's stated scope.** Six people work here in parallel.
- **Do not refactor** code you were not asked to change.
- Run the app and play a full round after every change.

---

## Tasks, in build order

| | Task | Why here |
|---|---|---|
| T0 | Scaffold, port, deploy | blocks everything |
| T1 | Word-tap redaction | biggest playability fix |
| T2 | Enriched Decay Ledger | the signature screen |
| T3 | Onboarding and pre-hop brief | currently absent, gates all learning |
| T4 | Verify Before You Share | makes it an intervention, not a demo |
| T5 | Session persistence | a refresh currently destroys a round |
| T6 | AI participants + Turing Hop | the AI thesis, made real |
| T7 | Rooms and simultaneous play | removes waiting, needs a backend |
| T8 | BAD FAITH mode | the imposter, and the inversion |
| T9 | Prediction stake + live reactions | stakes for idle players |
| T10 | Minimal pack authoring | youth as authors |

**T0 first and alone.** T1–T5 make the existing game good. T6–T8 make it distinctive. Do not start T7 before T5.
