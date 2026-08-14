# T3 — Onboarding, Brief, and Thesis Screen

Estimated: 3 hours. **Everything else's educational value is gated behind this.**

Files: `src/screens/HowToPlay.tsx`, `src/screens/Brief.tsx`, `src/screens/Thesis.tsx`, `src/screens/Lobby.tsx`.

---

## The problem

A first-time player opens the app to a preset picker and a settings panel. Nothing explains what the game is. They must infer the rules from a settings form.

Then hop 1 shows a claim, a card name, and an input. Nothing says they should stay accurate, that the card is a *pressure* and not an instruction to distort, or that the next person will not see the original.

A learner who misunderstands that the card is a pressure learns the wrong lesson from the entire session. This is currently the cheapest large improvement available, and it matters more for a judge playing alone than for a classroom with a facilitator.

---

## Part A — How to Play

Reachable from the lobby. One screen, scrollable, four beats:

1. **What happens** — a true claim passes person to person; each rewrites it under a pressure; you see what it cost.
2. **The five atoms** — the table. This is the vocabulary they take away.
3. **The one rule** — *always try to be accurate.* State it plainly and give it space.
4. **What you'll see at the end** — a sample Decay Ledger row.

Under 90 seconds to read. Reuse `.paper` and `.card`.

## Part B — Pre-hop brief

Appears once per session, before hop 1. Roughly 30 seconds:

> You'll get a claim and a card.
> The card is a **pressure**, not an instruction to distort.
> Rewrite it as accurately as you can under that pressure.
> The next player won't see the original — only your version.

Then the prediction stake if T9 has landed, otherwise straight into hop 1.

In BAD FAITH (T8), this is where the imposter receives their different brief. Build the screen so a per-player brief variant can be slotted in without restructuring.

## Part C — Thesis screen

Between the last reveal step and the ledger.

The entire pitch is *nobody had to lie*, and no screen currently says it. A player can finish a round without meeting the idea the game is about.

Three elements, nothing more:

1. Original claim in `.paper`, labelled "What entered play"
2. Final version in `.paper`, labelled "What came out"
3. One line in `--font-display`, large:

> Every player was told to be accurate. Nobody lied.

Then one button: **See what it cost** → ledger.

**Keep it nearly empty.** No stats, no recap, no atom counts. The ledger does all of that next, and anything extra here dilutes the one moment the design exists to produce. It needs to hold on screen for two silent seconds and still land — the pitch video is built on this shot.

**BAD FAITH variant** (T8 will wire it):

> One player was told to distort. Here's how little difference it made.

## Part D — Routing

- Normal: reveal → `thesis` → `ledger`
- Black Box: reveal → `blackboxGuess` → `thesis` → `ledger`

The guessing beat comes first so the room reasons about causes before receiving the framing.

Register all three screens and add sensible top-bar stage tags.

---

## Acceptance criteria

- [ ] How to Play reachable from lobby, readable in under 90 seconds
- [ ] Brief appears once per session before hop 1, supports per-player variants
- [ ] Thesis screen sits between reveal and ledger in both routes
- [ ] Player-authored text passes through escaping
- [ ] Display-font line does not clip at 375px
- [ ] No console errors

## Do not

- Add stats or ledger previews to the thesis screen
- Make the brief skippable on first run
- Add an animation library
