# BRICK-BY-BRICK — Gameplay Diagnosis & Improvement Plan

**Instrument:** the team's gameplay diagnosis protocol, run against the live app.
**Discipline observed:** nothing in the game was changed during this diagnosis. No mechanic,
rule, claim, card, atom, mode, AI behaviour, ledger, verify flow or Pack Studio was modified.
Source files were read, never written.

> **Status of this document:** findings and a *proposed* plan.
> "Proposed Direction" is not permission to implement.

---

## 1. Current-state freeze

| | |
|---|---|
| **Version** | 0.1.0 |
| **Build / commit** | `07cdb43` — *T11-P8 Final Polishing + Name Change* (working tree clean) |
| **Date** | 16 August 2026 |
| **Tester** | Claude, driving the app in Chrome (`npm run dev`, localhost:5173) |
| **Modes played** | CHAIN — one complete round, start to session readout. BAD FAITH — brief stage only. CROWD RECALL — not played. |
| **Players** | 3 (Ana, Bea, Caleb), pass-and-play on one device |
| **Settings** | Defaults: Standard pressure environment, 5 hops, 60 s/hop, Black Box **off**, AI participant **on** |
| **Claim drawn** | *Education* — "A preliminary study of 240 students at Bulwagan State College found that later class start times were associated with a 12-point rise in morning attendance, from 61 percent to 73 percent." |
| **Session duration** | ~15 minutes |

### What this diagnosis is, and is not

This is a **single-tester structural and interface diagnosis**. It is not a playtest.

The protocol's core instrument is observed human behaviour — laughter, confusion, boredom,
unprompted recall, argument. One automated tester cannot generate that evidence, and inventing
it would poison the very method the protocol exists to protect. **Every section that requires
human observation is therefore left as an unfilled instrument**, marked ⬜ NOT YET DIAGNOSED,
ready for a real room.

What a single tester *can* establish, and what this document does establish, is whether the
game's own machinery does what it claims — in particular whether the Decay Ledger, the only
measurement instrument in the game, reports the truth. It does not always. That is finding
**BBB-001**, and it is the reason this document exists.

---

## 2. What was actually observed

### 2.1 The round, hop by hop

| Hop | Who | Card | Text produced |
|---|---|---|---|
| — | — | original | A **preliminary** study of 240 students at Bulwagan State College found that later class start times **were associated with** a 12-point rise in morning attendance, from 61 percent to 73 percent. |
| 01 | Ana | HEADLINE ONLY | *(unchanged — timer expired, auto-submitted)* |
| 02 | **AI participant** | SOUND CERTAIN | A **comprehensive** study … **conclusively established** that later class start times **resulted in** a 12-point increase … boosting it from 61 percent to a **remarkable** 73 percent. |
| 03 | Caleb | YOUR AUDIENCE BELIEVES… | Later class start times **boost** morning attendance from 61% to 73%, a study of 240 students at Bulwagan State College found. |
| 04 | Ana *(checked the original)* | MAKE IT LAND | Start class later, and attendance **jumps**: 61% to 73% in a 240-student college study. |
| 05 | Bea | 90 CHARACTERS | Start class later and attendance jumps 61% to 73% in a study. |

**What plainly happened:** HEDGE and CAUSE were destroyed at **hop 02, by the machine, under
SOUND CERTAIN**. "Preliminary" became "comprehensive"; "were associated with" became
"conclusively established … resulted in". Every subsequent version inherited that damage.

**What the game reported:** HEDGE and CAUSE were *"LOST AT HOP 5"*, trigger
*"90 CHARACTERS (Bea's turn)"*.

---

## 3. Findings

### BBB-001 — The ledger launders damage onto the wrong player · **P0 · Critical**

**Finding.** When a player uses *Check the original*, every atom is marked alive again **and its
recorded death is erased**. The atom is then re-blamed on whoever next fails to carry it. Damage
done earlier in the chain — including by the AI — disappears from the ledger and is attributed to
a later, innocent player and to the wrong pressure.

**Evidence (observed).** The AI killed HEDGE and CAUSE at hop 02 under SOUND CERTAIN. Ana used
*Check the original* at hop 04. The Decay Ledger then reported:

```
HEDGE   LOST AT HOP 5   Trigger: 90 CHARACTERS (Bea's turn)
CAUSE   LOST AT HOP 5   Trigger: 90 CHARACTERS (Bea's turn)
```

The wire meter shows HEDGE and CAUSE green — alive — through hops 2, 3 and 4, over text that
demonstrably no longer carried them.

**Mechanism (read, not inferred).**
- `src/engine/ledger.ts` → `verdictForAtom`: when `isVerifiedAt(...)` is true it sets
  `alive = true`, `deathHop = null`, `deathKind = null`, then `continue`s — **so the checked hop's
  own text is never examined**. The atom is asserted to have survived that hop no matter what the
  player actually wrote.
- The prior death is therefore forgotten, and the next hop that fails the keyword test writes a
  fresh `deathHop`; `deathPlayer` and `deathCardId` are read from *that* hop.
- `src/screens/Round.tsx` spends a check as `SPEND_VERIFICATION` with `atoms: [...ATOMS]` — **all
  five**, regardless of which one the player wanted to check.

**Where the gap actually is — stated fairly.** This behaviour is *deliberate and tested*.
`ledger.test.ts` → "does NOT make the atom immortal for the rest of the chain" asserts precisely
this: die at hop 0, check at hop 1, die again at hop 2 → `deathHop` 2, `deathPlayer` 'Kiel'. In
that test the re-attribution is **correct**, because the checked hop's text *is* the full original
— the atom genuinely did come back.

The untested case is the one that occurs in real play: **the player checks the original and then
writes a version that still does not carry the atom.** Ana checked at hop 04 and wrote "Start
class later, and attendance jumps…" — carrying none of CAUSE's keywords. The engine marked CAUSE
alive at hop 04 anyway, because a checked hop is never evaluated. So the death moved to Bea.

Two compounding contributors, each addressable on its own:
1. A check asserts survival instead of *permitting* it — the hop's text is skipped rather than
   re-tested.
2. `Round.tsx` restores all five atoms on every check, so the engine's own "only restores the
   atoms the check actually covered" capability (which *is* tested) is never used by the game.

**Why this is the most serious finding.** The Decay Ledger is the only fidelity signal in the
game and carries the entire learning payload. Here it fails in three compounding ways:

1. **It teaches the wrong lesson.** The room learns that a length limit killed the hedge, when a
   machine sounding confident did.
2. **It names a person for something they did not do.** The house copy rule is *name the part,
   clear the person* — the tone is respected ("Bea's turn" in parentheses) but the *fact* is
   wrong, and the game's one hard promise is that nobody lied.
3. **It hides the AI thesis.** The machine's damage is erased from the ledger, and the session
   readout then says of the machine: *"Whatever gave it away, it was not the machine being
   careless."* In this round it was exactly the machine being careless.

**It is triggered by the behaviour the game is teaching.** A player who checks their source
causes the previous player's damage to be laundered onto the next one.

**Downstream contamination observed.**
- *Superlatives*: "FIRST TO GO — SOURCE. Lost at hop 5, under **90 Characters** (Bea's turn)."
- *Debrief Q2*, auto-generated: "SOURCE went under **90 Characters**. Where have you felt that
  same pressure this week?" — the room is sent to discuss a pressure that did nothing.
- *Session readout*: "SOURCE went in 1 of 1. That is the one to check first."

**Secondary defect in the same area.** With four atoms sharing `deathHop = 4`, `firstLostAtom()`
breaks the tie by array order, so SOURCE is declared "first to go" purely because it is first in
`ATOMS`. The debrief states "SOURCE went first, at hop 5" as a finding about the round. It is an
artefact of iteration order.

**Derived risk — not yet observed, needs a BAD FAITH round.** `splitByIntent()` decides
*deliberate vs accidental* by reading `deathHop` and asking whether that hop `isImposter`. If a
check resets the imposter's kill, their deliberate act is recounted as somebody's accident. That
would make BAD FAITH's entire payoff — "the accidents did more damage than the sabotage" — come
out right for a false reason. **Confirm before trusting that number.**

**Do not fix yet.** Per §20 of the protocol, the alternative readings are materially different
repairs and the choice belongs to the team:

- **(a)** A checked hop should be *re-tested* rather than skipped — a check lets an atom survive,
  it does not guarantee it. Smallest change, closest to what the room actually saw.
- **(b)** The check is fine; the ledger should simply *preserve the first death* and record the
  recovery alongside it, so the AI's hop-02 kill stays on the record.
- **(c)** `Round.tsx` should spend the check on the atoms the player names, not all five —
  the engine already supports it and already tests it.

(a) and (c) are compatible and probably belong together. (b) changes what the ledger *means*.

---

### BBB-002 — The Turing Hop is spoiled one screen before it is asked · **P1 · High**

**Finding.** With Black Box off (the default), the reveal labels each block with its author —
hop 02 is shown in violet as **AI PARTICIPANT**. The very next screen asks *"Which one was the
machine?"*, with the labels removed.

**Evidence.** Observed directly: the reveal screen showed "02 · SOUND CERTAIN · AI PARTICIPANT",
then the Turing screen asked the room to identify the machine. The session readout then reported
*"This room picked the machine out 1 time out of 1"* — a statistic with no meaning, because the
answer was on the previous screen.

**Why it matters.** The AI thesis is the project's most distinctive claim, and this is the beat
that tests it. On default settings the test cannot run, and the game reports a success rate as if
it had.

---

### BBB-003 — Four of the six constraint cards are unenforced and unmeasured · **P1 · High**

**Finding.** Only `90 CHARACTERS` has a target the game can see. It shows a live counter
("81 / 90") and blocks submission when exceeded. `HEADLINE ONLY`, `MAKE IT LAND`,
`YOUR AUDIENCE BELIEVES…` and `SOUND CERTAIN` present a pressure with no limit, no target and no
check — the claim can be passed through untouched and the game will accept it as compliant.

**Evidence.** At hop 01 under HEADLINE ONLY, *Pass it on* was enabled with the full original text
uncut, and the original was in fact passed on essentially unchanged.

**Why it matters.** The cards are the mechanism by which pressure produces decay. Where a card
exerts no measurable pull, decay depends entirely on a player choosing to feel pressured. The
ledger then attributes losses to cards that never constrained anything.

---

### BBB-004 — The hop timer auto-submits silently · **P1 · High**

**Finding.** When the hop timer reaches zero the current text is submitted and the device moves
to the next player's handoff. There is no warning as it approaches, no confirmation that a hop was
submitted, and no record that the hop was *forfeited* rather than authored.

**Evidence.** Observed at hop 01: the timer ran out while reading, Ana's untouched text was
submitted, and the screen became "PASS THE DEVICE TO CALEB". Nothing on screen said what had
happened. The reveal later presented that hop as an ordinary retelling by Ana under HEADLINE ONLY.

**Why it matters.** The ledger cannot distinguish "chose to keep it intact" from "ran out of
time", and neither can the room during the debrief. A forfeited hop is presented as an authored
one.

---

### BBB-005 — The prediction is taken before anyone has seen the claim · **P2 · Medium**

**Finding.** *CALL IT* asks "Which one dies first?" and offers the five atoms — with no claim
anywhere on screen. Players commit before reading a single word of the text.

**Evidence.** Observed on the prediction screen; the claim first appears on the hop-1 editor,
after all three predictions were taken.

**Reading.** This works well as a *vocabulary introduction* — it is the first place the five atoms
are named with icons and glosses. As a **stake** it cannot be reasoned about, so it is closer to a
lottery ticket. Note also the pacing cost in pass-and-play: N players means N handoff → tap →
handoff cycles before the game begins. The screen also says "Five seconds, one tap" while showing
no timer and enforcing nothing.

---

### BBB-006 — On the forced path, the atoms are never named before the chain · **P2 · Medium**

**Finding.** *How to Play* is genuinely good — three steps, the five atoms each with a "goes when"
example, and the one rule. It is entirely opt-in, reached from the sidebar. The Brief, which every
room does see, never mentions the atoms.

**Evidence.** A room that adds players and presses *Initiate round* goes Brief → prediction →
chain, and meets the atoms first as five unfamiliar words to bet on.

---

### BBB-007 — HEADLINE ONLY asks for a rewrite, but the tool only deletes · **P2 · Medium**

**Finding.** Compression cards mount the word-tap editor, which can only remove words in place —
no reordering, no rephrasing. "One line, the way it would sit at the top of a page" is not
reachable by deletion; what comes out is a telegraphic fragment in original word order.

---

### BBB-008 — The verify choice produces no immediate response · **P2 · Medium**

**Finding.** Choosing *Check it first* and then picking an atom advances straight to the reveal
with no acknowledgement. The consequence appears much later, in the ledger's "WHAT YOU DID WITH
IT" panel.

**Evidence.** Observed: picked SOURCE, screen changed to the reveal. The feedback — *"You would
have checked SOURCE first. SOURCE was the first thing this claim lost."* — appeared several
screens later. (That sentence was also wrong here, per BBB-001.)

---

### BBB-009 — *Check the original* is offered at hop 1, where it is worthless · **P3 · Low**

At hop 1 the player is already looking at the original, yet the control is offered and would
consume one of the room's limited checks with no warning.

---

### BBB-010 — Readout overstates the machine's parity · **P3 · Low**

The readout says the machine "was handed the same version and the same card as everyone else".
It draws from the same deck, but each hop has a different card — in this round the AI drew
SOUND CERTAIN, the card most likely to kill HEDGE and CAUSE. The human-vs-machine comparison is
uncontrolled, and the copy asserts a parity that does not hold.

---

### BBB-011 — Colour semantics · **P3 · Low**

A green left border marks both "THE CLAIM" (the true original, hop 1) and "WHAT YOU WERE GIVEN"
(the degraded text, later hops); blue marks the verified original. Green is a strong
trustworthiness convention and here it sits on the degraded text.

---

### BBB-012 — Reactions are inert in pass-and-play · **P3 · Low**

The emoji reaction bar appears on reveal screens in single-device play, where one person taps
their own reactions. It is built for rooms.

---

## 4. What is working — KEEP

These are load-bearing and should not be disturbed by any repair above.

- **"IT REACHES YOU" is the strongest moment in the game.** "This turned up on your phone. You
  have not seen anything else about it," then Share / Flag / Check. It converts the whole round
  into a decision the player actually faces in life.
- **The verify picker restates the atoms as questions** — "Who is the source?", "What is the
  number, and out of what?", "Is this correlation, or causation?" This is the most portable
  artefact in the product; it is a checklist a student can use outside the game.
- **The thesis screen.** Original vs final across a dashed gap, then *"Every player was told to be
  accurate. Nobody lied."* Earned, and placed exactly right.
- **The word-tap editor's feedback.** Cut words stay visible and struck through, the preview and
  counter update live. You can see what you removed — which is the lesson.
- **The AI participant genuinely produces the thesis.** Handed a hedged, correlational claim it
  returned "conclusively established … resulted in … a remarkable 73 percent". No lecture about
  machine confidence lands as hard as that diff.
- **The imposter brief is exactly to spec.** "MAKE **SOURCE** DISAPPEAR", "Make it die quietly",
  "Everyone else is trying to be accurate. You are too — mostly." It names a property and never
  once asks anyone to lie.
- **The chain visualisation** in the reveal — numbered blocks, card badges, connectors, red final
  block.
- **The stage rail** — a room always knows where it is, including hop *n/N*.
- **No score anywhere.** Held under pressure, in a genre that would reward abandoning it.

---

## 5. Improvement candidates

**Proposed Direction is not approval.** Each needs a decision before any code is written.

| ID | Finding | Severity | Proposed direction | Approved? |
|---|---|---|---|---|
| BBB-001 | A checked hop is never re-tested, so an atom is marked alive over text that does not carry it; the loss is then re-attributed to a later player and card | **P0** | Choose among (a) re-test the checked hop, (b) preserve the first death and record recovery alongside, (c) spend the check only on the atoms the player named. (a)+(c) are compatible. Separately, make `firstLostAtom` tie-break on something other than `ATOMS` order. | ☐ |
| BBB-002 | Turing Hop spoiled by the reveal's author labels | **P1** | Either hide author labels in the reveal whenever an AI hop is present, or move the Turing question before the reveal. | ☐ |
| BBB-003 | Four cards exert no measurable pressure | **P1** | Decide whether each card needs a machine-visible target, or whether the ledger should stop naming cards it cannot verify were binding. | ☐ |
| BBB-004 | Timer auto-submits silently | **P1** | Decide whether a forfeited hop should be marked as such in the hop record and shown in the reveal/ledger. | ☐ |
| BBB-005 | Prediction taken before the claim is visible | **P2** | Decide whether the stake should follow the first sight of the claim, or whether the screen is really onboarding and should say so. | ☐ |
| BBB-006 | Atoms unnamed on the forced path | **P2** | Decide whether the Brief should name the five, or whether first contact via the prediction screen is the intended design. | ☐ |
| BBB-007 | HEADLINE ONLY unreachable by deletion | **P2** | Reconsider which cards mount the redact editor, or reword the card to describe cutting. | ☐ |
| BBB-008 | No immediate response to the verify choice | **P2** | Decide whether an acknowledgement belongs at the point of choice. | ☐ |
| BBB-009 | Check offered at hop 1 | **P3** | Suppress or annotate at hop 1. | ☐ |
| BBB-010 | Readout claims card parity | **P3** | Copy correction. | ☐ |
| BBB-011 | Green marks both original and degraded text | **P3** | Reserve green for verified-true text. | ☐ |
| BBB-012 | Reactions inert in pass-and-play | **P3** | Hide unless in a room. | ☐ |

### Priority order

- **P0 — before any further playtesting.** BBB-001. Until the ledger attributes correctly, every
  observation a playtest produces about *which pressure caused what* is unreliable, and so is the
  debrief the room is given.
- **P1 — before the next demo.** BBB-002, BBB-003, BBB-004.
- **P2 — before wider classroom use.** BBB-005 … BBB-008.
- **P3 — polish.** BBB-009 … BBB-012.

### Change budget — do not touch without strong evidence

- The five Integrity Atoms
- The core premise, and the Experience → Diagnose → Detect → Compare → Verify → Author arc
- AI as a participant under observation, never an assistant
- The Decay Ledger *concept* (BBB-001 is a defect in its implementation, not a case against it)
- The absence of any score, ranking or leaderboard
- CROWD RECALL having no traitor

---

## 6. Instruments left unfilled — these need a real room

⬜ **NOT YET DIAGNOSED.** No single tester can supply this evidence.

- **§8 Enjoyment** — laughter, argument, wanting another round, disengagement, rushing.
- **§9 Learning** — unprompted recall of the five atoms; whether players can apply them outside
  the game; whether they grasp that degradation happens without lying.
- **§10 Fun vs learning balance** — needs both axes measured with people.
- **§12–13 Mode diagnosis and comparison** — BAD FAITH and CROWD RECALL are social instruments;
  only their brief and setup screens were inspected here. CROWD RECALL was not played at all.
- **§14 AI participant** — whether the machine creates curiosity and discussion in a room.
- **§15 Decay Ledger effect** — whether the "aha" lands. **Note: run this only after BBB-001 is
  resolved**, or the room will be reacting to a false report.
- **§17.2, 17.3, 17.17 UI discoverability** — where players actually get stuck.

### Recommended sequence from here

1. Decide BBB-001 (the three readings are materially different repairs).
2. Implement approved P0/P1 changes only.
3. **Then** run the first human playtest, filling the sections above.
4. Regression playtest against the same claim and settings.

---

## 7. Method note

Everything in §3 was observed in the running application at commit `07cdb43`, driven through
Chrome. Where a mechanism is described, it was confirmed by reading `src/engine/ledger.ts`,
`src/screens/Round.tsx` and `src/data/claims.en.json` — reading only. One item (the
`splitByIntent` risk under BAD FAITH) is explicitly marked as derived and unconfirmed.

Frequency and tester counts are deliberately absent from the findings table: with n=1 they would
be theatre. BBB-001 does not need them — it is a deterministic code path, reproducible by anyone
who uses *Check the original* after an atom has already died and then writes a version that does
not carry it back.

The full suite passes (487/489; the two failures are `api/_lib/roomStore.test.ts` hitting live
Upstash because `.env.local` supplies real credentials, unrelated to any of this). BBB-001 is not
caught by the suite because the existing verification tests use a checked hop whose text *is* the
original — the one case where skipping the re-test is harmless.

---

# 8. Fixing phase — outcome

Run after the diagnosis, against the same build. Scope was decided by the team:
**Option A for BBB-001, and stop after P0 + P1.** Everything else stays a decision.

## Implemented

### BBB-001 · P0 · `src/engine/ledger.ts` — *a check is permission, not a guarantee*

A verified hop is no longer skipped. The atom is restored **only if that hop's text actually
carries it back**; otherwise the hop is judged like any other. Consequences:

- An atom that was already dead **stays dead where it died**. The machine's hop-02 kill is no
  longer erased and re-blamed on a later player under an unrelated card.
- A checker who had a live atom and dropped it anyway is **named for their own hop** — not the
  next person to touch it.
- An atom genuinely written back still recovers, and still reports `recovered: true`.

One existing expectation changed, as agreed. `only restores the atoms the check actually covered`
previously asserted an atom was alive over text containing an overreach phrase — the behaviour
that *was* the defect. It now carries the original wording back, so it still tests coverage
(covered atom returns, uncovered atom stays dead) without asserting resurrection.

**Regression tests added** (`ledger.test.ts`, +4): loss stays where it happened when the checker
did not carry it back; the checker is named when they dropped a live atom; a genuine write-back
still restores; and the machine's hop stays answerable for what it cost.

### BBB-002 · P1 · `src/screens/Reveal.tsx` — *stop answering the Turing question early*

While the Turing Hop is pending (`aiHopIndexes.length > 0 && turingGuess === null`) the reveal
now withholds **both** tells: the "AI participant" label *and* the violet `is-machine` marker on
the block. Author names are held for every block, not just the machine's — a single unlabelled
block among named ones is the same giveaway. Black Box behaviour is unchanged.

### BBB-010 · P3 · `TuringHop.tsx`, `SessionReadout.tsx` — *copy accuracy*

"under the same card" / "the same card as everyone else" → "a card from the same deck". Each hop
draws its own card; in the diagnosed round the machine drew SOUND CERTAIN, the card most likely to
kill HEDGE and CAUSE.

## Verified

| Check | Result |
|---|---|
| Typecheck | clean |
| Full suite | **491 passed**, 2 failed — both `api/_lib/roomStore.test.ts`, pre-existing, caused by `.env.local` pointing the room tests at live Upstash. Unrelated. |
| Ledger suite | 79 passed (was 75) |
| BBB-001 end to end | Played a round with a check at hop 4. SOURCE, HEDGE and CAUSE stayed at **hop 1**, where they died. NUMBER and SCOPE died at hop 4 and are attributed to the player who checked and dropped them. Nothing was laundered forward. |
| BBB-002 end to end | Reveal with all five blocks shown: 0 author labels, 0 machine markers, no "AI participant" string. Turing Hop: 0 labels before the vote, 5 after, machine marked once. |
| BBB-002 regression | AI participant **off** → reveal still shows all 5 author names, exactly as before. |

## Deliberately not implemented

| ID | Why it was left |
|---|---|
| BBB-003 | Giving the four soft cards a machine-visible target changes difficulty and pacing. A design decision, not a defect — the change budget says do not redesign on one diagnosis. |
| BBB-004 | Marking a forfeited hop needs a new field on `Hop`, and `contracts.ts` is frozen. Needs an explicit decision before anyone touches it. |
| BBB-005 – BBB-009, BBB-011, BBB-012 | Design and copy decisions; the protocol's implementation order puts them behind the fundamentals. |
| `firstLostAtom` tie-break | With attribution corrected, ties are rarer. Breaking them by `ATOMS` order is a display choice, not a defect. |

## Still open

- **The BAD FAITH derived risk (§3, BBB-001) is now much less likely** — `splitByIntent` reads
  `deathHop`, and death hops are no longer moved by a check. It has still not been *confirmed* in
  a played BAD FAITH round. Do that before trusting the deliberate-vs-accidental split.
- **§28 regression playtest has not been run.** The fixes above are verified mechanically, not
  against a room. The first human playtest can now proceed on a ledger that reports truthfully —
  which was the reason for holding it.

---

# 9. Follow-up pass — the three near-defect items

Agreed scope: the small items close enough to defects to act on without player evidence.
One was implemented, one was withdrawn on further reading, one is blocked on a protected file.

## Implemented

### BBB-007 · `src/data/cards.ts` — Headline Only now describes what the tool does

`'One line, the way it would sit at the top of a page.'`
→ `'Cut it back to the one line that would sit at the top of a page.'`

The card mounts the word-tap editor (`input: 'redact'`), which can only remove words in place —
it cannot reorder or rephrase, so a headline cannot be *composed* under it. The old note asked
for a rewrite the tool cannot perform; the new one names the same pressure as a cut. It still
names a pressure and still never instructs anyone to distort anything.

Deliberately *not* changed: which cards mount the redact editor. That is a T1 gameplay decision
and needs evidence, not an opinion.

## Withdrawn

### BBB-012 — reactions in pass-and-play · **not a defect**

The finding claimed the reaction bar is inert decoration on a single device. Reading
`src/components/ReactionBar.tsx` before touching it, the header says the opposite, explicitly:

> "…it exists to make the tap visible on every screen watching the same poll, in room mode,
> **and to whoever is holding the shared device in pass-and-play**."

Pass-and-play is a supported case, not an oversight. Hiding the bar there would override a
documented design intent on one automated tester's impression — the exact move the change budget
and §19 exist to prevent. **BBB-012 is withdrawn from the findings list.**

## Blocked — needs a decision

### BBB-009 — *Check the original* offered at hop 1

The control lives in `src/screens/Round.tsx`, which CLAUDE.md lists as a shared file with
"DO NOT EDIT — say so rather than making the change". So it is not being made unilaterally.

The change is one condition:

```diff
-{!checked && round.verificationsLeft > 0 && (
+{!checked && index > 0 && round.verificationsLeft > 0 && (
   <button className="btn btn-block" onClick={…}>
     <Icon name="search" /> Check the original ({round.verificationsLeft} left)
   </button>
 )}
```

At hop 1 the player is already reading the original, so spending one of the room's limited checks
there buys nothing. There is precedent for an approved edit to this file (`Round.tsx: gate the
handoff to the device that owns the turn (approved change)`).

## Verified

Typecheck clean. **491 passed**, 2 failed — the same pre-existing `roomStore` / live-Upstash
failures, unrelated.
