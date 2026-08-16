# T2 — Enriched Decay Ledger

Estimated: 2–3 hours. **The signature screen.**

Files: `src/engine/ledger.ts`, `src/screens/Ledger.tsx`, appended block in `src/styles/global.css`.

---

## Goal

The ledger says an atom died and who held it. Make it say **what was lost, where, and what pressure caused it.**

Now:
```
Died at hop 3 — Mark was holding it.
```

Target:
```
CAUSE — LOST AT HOP 5
Trigger:   SOUND CERTAIN  (Mark's turn)
Original:  "associated with"
Final:     "causes"
```

This is the project's answer to "isn't this just Telephone." Telephone shows a message changed. BRICK-BY-BRICK shows what was lost, where, and why. It is also the shot the pitch video is built around.

---

## No diff algorithm needed

`computeLedger` already knows both sides and throws the information away.

- **Trigger** — `hops[deathHop].cardId` → card name. Stored, never surfaced.
- **Original** — `atom.phrase ?? atom.keywords[0]`.
- **Final** — the `overreach` string that matched, which the code currently tests and discards.

## Part A — engine

Inside the hop loop, capture the match rather than only testing for one:

```ts
let matchedOverreach: string | null = null;
if (atom.overreach) {
  matchedOverreach = atom.overreach.find(k => normalized.includes(k)) ?? null;
  if (matchedOverreach) alive = false;
}
```

On death, populate `deathCardId`, `originalPhrase`, `finalPhrase`, and `deathKind` (`"overreach"` when a phrase matched, `"dropped"` otherwise).

Set `confidence: "uncertain"` when the signal is weak — no keyword matched, no overreach found, and the hop shrank the text by more than ~60%. Uncertain rows are what the room adjudicates.

## Part B — presentation

Keep the wire-and-spark visual. It works and it films well. Replace the single death line with the four-line block.

- **Card first, player in parentheses.** Never phrase as accusation.
- `deathKind === "dropped"` → render Final as `dropped` in muted type, not an empty string
- `--font-mono` for both phrases so they read as evidence
- `--red` on the final phrase, muted grey on the original
- AI hops label the trigger `(AI participant)` rather than a name
- Surviving atoms keep the existing `.alive-note` treatment

New CSS classes prefixed `ledger-diag-`, appended at the bottom of `global.css`.

## Part C — room adjudication

Rows marked `"uncertain"` get a one-tap override: *still there* / *gone*. The engine proposes; the room decides.

This is not only a safety net for imprecise matching. It is better teaching — right now the app notices the loss and the room reads about it. The noticing is the learning.

Only uncertain rows prompt, or the screen becomes a chore. Overrides merge over engine output.

---

## Acceptance criteria

- [ ] Deaths show trigger, original phrase, final phrase
- [ ] Overreach deaths show the actual matched phrase
- [ ] Dropped deaths show `dropped`, never `undefined`
- [ ] AI hops attributed to the participant, not a player name
- [ ] Uncertain rows offer a one-tap override; confident rows do not
- [ ] Copy leads with the card
- [ ] Readable at 375px, no horizontal scroll
- [ ] Superlatives screen still works (it calls the same engine)
- [ ] Engine unit tests cover both death kinds

## Do not

- Write a general text-diff algorithm
- Restyle the wire or spark
- Add a score, percentage, or grade
