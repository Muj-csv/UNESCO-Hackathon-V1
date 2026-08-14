# T8 — BAD FAITH Mode

Estimated: 5–6 hours. Needs T7 for hidden roles to work properly.

Files: `src/screens/Brief.tsx`, `src/screens/Accusation.tsx`, `src/screens/Ledger.tsx`, `src/state/gameReducer.ts`.

---

## The mode

Identical to CHAIN, with one difference: **one player secretly receives a different brief.**

> Rewrite under your constraint. Also make **HEDGE** die. Do not get caught.

Everyone else plays honestly and does not know a saboteur exists until the Accusation Phase.

## The payoff — build toward this

The imposter kills **one** atom on purpose. The honest players typically kill **two or three** by accident.

The room spends the Accusation Phase hunting a saboteur who turns out to have been the least destructive person in the chain.

That inversion is the entire reason this mode exists. In CHAIN, players are *told* nobody lied. In BAD FAITH, they *discover* it while actively hunting a liar. Discovery beats assertion, and it is why adding an imposter strengthens the thesis rather than contradicting it.

**The ledger must surface the comparison explicitly:**

```
Deliberate:  1 atom   (HEDGE, hop 3)
Accidental:  3 atoms  (SOURCE hop 2 · SCOPE hop 4 · CAUSE hop 5)
```

If a session ends without the room noticing that number, the mode has failed regardless of how fun the round was.

## Two-way learning

- **Non-imposters** practise detection: reading a chain and reasoning about where meaning went.
- **The imposter** learns from inside: how small an edit needs to be, how hard it is to be noticed, and that deliberate distortion is indistinguishable from an honest mistake under pressure.

Rotate the role. Everyone should play it once across a session.

---

## Build

### Role assignment

- Exactly **one** imposter regardless of player count. Two makes the reveal unreadable.
- Assigned at round start, delivered through the per-player Brief variant from T3.
- Target atom chosen randomly from atoms present in the claim.
- Never assign the imposter to the first or last hop.
- Mark `hop.isImposter = true`. **Never expose this in any client payload before the reveal** — filter it server-side in the room state response, or a curious player will read it in DevTools.

### The imposter's brief

> Everyone else is trying to be accurate. You are too — mostly.
> Rewrite under your card, and make **HEDGE** disappear.
> Keep it believable. If the room can tell it was you, you were too obvious.

**It never says "lie."** It targets a property. The imposter must still write something plausible under a real constraint — that is what makes their output indistinguishable from an accident.

### Accusation Phase

New screen, after the reveal, before the thesis screen.

Borrowed from Among Us's meeting. The room argues out loud, then votes.

- Show all hops with authors
- In BAD FAITH with AI participants, **two questions stack**: which hop was the machine, and which was the imposter. Two hidden identities in one argument is the most original beat in the design.
- Vote, then reveal both
- **No points for a correct vote.** The room does not "beat" the imposter. The ledger is still the payoff.

Give the argument room to breathe — no countdown, host advances when the room is done. The arguing is the fun and it is also the pedagogy: the room is reasoning about evidence.

### Thesis screen variant

> One player was told to distort. Here's how little difference it made.

### Routing

reveal → `accusation` → `thesis` → `ledger`

---

## Acceptance criteria

- [ ] Exactly one imposter, never first or last hop
- [ ] Imposter role never present in client payloads before reveal
- [ ] Brief targets a property, never instructs lying
- [ ] Accusation phase votes on imposter and, when AI is on, the machine
- [ ] Ledger shows deliberate vs accidental atom counts
- [ ] Thesis variant shown in this mode
- [ ] No points anywhere in the mode
- [ ] CROWD RECALL still has no traitor

## Do not

- Add a traitor to CROWD RECALL. Ever. Its lesson requires the absence of one.
- Score the vote
- Allow two imposters
- Let the brief use the word "lie"
