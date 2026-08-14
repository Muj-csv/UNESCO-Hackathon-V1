# T6 — AI Participants and the Turing Hop

Estimated: 5–6 hours. **This is the AI thesis made real.**

Files: `api/ai-hop.ts`, `src/engine/fallbacks.ts`, `src/screens/Round.tsx`, `src/screens/TuringHop.tsx`, `src/state/gameReducer.ts`.

---

## Goal

Some hops in the chain are taken by a language model. It receives the same previous version and the same constraint card a person would, and rewrites under it.

**Why this matters.** Without it, "Summary Bot" is humans imitating a summariser and the AI claim is an argument. With it, a real model really does compress a real claim and really does drop the hedge, in front of the room, audited by the same ledger. The claim becomes a finding.

**The design rule that keeps it coherent:** AI is a participant under observation, never an assistant to the player. Nobody uses it to play better. Everyone watches what it does to true information.

---

## Part A — The proxy

`api/ai-hop.ts` — a Vercel serverless function. The key never reaches the client.

**System prompt constraints, non-negotiable:**

- Compress or rephrase **only the supplied text**
- Never introduce new facts, entities, numbers, names, or claims
- Never add commentary, explanation, or framing
- Return only the rewritten text
- Respect the card's constraint (character limit, headline form, confident register)

Minors are in the room and the output goes on a shared screen. Treat the prompt as a safety control, not a formatting instruction.

**Also:** rate-limit by IP. The endpoint is public. Cap request and response length. Timeout at 6 seconds.

## Part B — Fallbacks

`src/engine/fallbacks.ts` ships pre-generated rewrites for every shipped claim × card combination.

On timeout, error, rate-limit, or missing key: **fall back silently and continue.** The room must never see an error at the emotional peak of a round.

Build this in the same session as Part A, not afterward. A demo that stalls mid-chain is worse than no AI hop at all.

## Part C — In the chain

- A preset setting controls how many hops are AI, default 1
- Which hop is AI is randomised, never first or last
- The AI hop shows a brief beat — *"Auto-summariser is processing…"* — then the result. Not instant; the room needs to see the pressure applied.
- Mark `hop.isAI = true`
- The ledger labels the trigger `(AI participant)` rather than a player name

## Part D — The Turing Hop

New screen, before the thesis screen.

> One of these hops was written by a machine. Which one?

Show all versions, let the room vote, then reveal.

**This is the most memorable beat in the game.** Most rooms cannot tell — and that failure is the lesson: a summariser's output is not distinguishable from a person doing their honest best under the same constraint. It is also the only mechanic in the design that is *socially* fun, because it produces arguing.

Track the room's accuracy across a session and surface it in the readout: *"This room guessed the machine correctly 1 time out of 3."*

Routing: reveal → `turingHop` → `thesis` → `ledger`.

Under Black Box: reveal → `blackboxGuess` → `turingHop` → `thesis` → `ledger`.

---

## Acceptance criteria

- [ ] AI hop returns a valid rewrite under the card constraint
- [ ] No API key in client code or network payloads
- [ ] Timeout, error, and missing-key paths all fall back silently
- [ ] Rate limiting active
- [ ] AI hop never first or last
- [ ] Ledger attributes AI deaths to the participant, not a player
- [ ] Turing Hop screen votes and reveals
- [ ] Accuracy tracked across a session
- [ ] Full round completes with the API deliberately disabled

## Do not

- Let the model judge whether an atom survived — that stays with the room
- Let the model generate claims
- Offer the model as help to a player
- Ship without fallbacks
