# BRICK-BY-BRICK — Gameplay Diagnosis & Improvement Plan

**Instrument:** the team's gameplay diagnosis protocol, run against the live app.
**Discipline observed:** nothing in the game was changed during this diagnosis. No mechanic,
rule, claim, card, atom, mode, AI behaviour, ledger, verify flow or Pack Studio was modified.
Source files were read, never written.

> **Status of this document:** §1–§7 are the original diagnosis, frozen as written. Nothing was
> changed in the game while they were produced, and "Proposed Direction" there was never
> permission to implement.
>
> §8 onward are the implementation passes that followed, each with its own approvals and its own
> verification. **Eleven of the twelve findings are now settled; BBB-003 is open on purpose.**
> The Outcome column in §5 is the index. Where §5 and a later section disagree, the later
> section is right.
>
> None of it has been in front of a room of players. That remains the largest gap — see
> "What is still open" in §5.

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

**Proposed Direction was not approval.** Each needed a decision before any code was written, and
the Outcome column records the decision that was actually taken — not the proposal. Where the two
differ, the section named in the cell says why. Kept in sync with §8 through §11; if this table and
those sections ever disagree, the sections are right and this one is stale.

| ID | Finding | Severity | Proposed direction | Outcome |
|---|---|---|---|---|
| BBB-001 | A checked hop is never re-tested, so an atom is marked alive over text that does not carry it; the loss is then re-attributed to a later player and card | **P0** | Choose among (a) re-test the checked hop, (b) preserve the first death and record recovery alongside, (c) spend the check only on the atoms the player named. (a)+(c) are compatible. Separately, make `firstLostAtom` tie-break on something other than `ATOMS` order. | ☑ **Fixed** §8 — took (a): the atom returns only if the checked hop's text carries it back. +4 regression tests. Tie-break **not** changed: a display choice once attribution was correct. |
| BBB-002 | Turing Hop spoiled by the reveal's author labels | **P1** | Either hide author labels in the reveal whenever an AI hop is present, or move the Turing question before the reveal. | ☑ **Fixed** §8 — hid the labels *and* the violet marker, for every block, while the guess is pending. |
| BBB-003 | Four cards exert no measurable pressure | **P1** | Decide whether each card needs a machine-visible target, or whether the ledger should stop naming cards it cannot verify were binding. | ☐ **Open — held for evidence.** §11. Machine-visible targets would change difficulty and pacing in every mode; the only evidence is one automated tester's impression. Needs a played room (§6). |
| BBB-004 | Timer auto-submits silently | **P1** | Decide whether a forfeited hop should be marked as such in the hop record and shown in the reveal/ledger. | ☑ **Fixed** §10 — `Hop.forfeited`, stamped at four sites, shown on all four chain screens and on the ledger's atom wire. The *warning before zero* was deliberately left; see §10. |
| BBB-005 | Prediction taken before the claim is visible | **P2** | Decide whether the stake should follow the first sight of the claim, or whether the screen is really onboarding and should say so. | ☑ **Fixed** §11 — the first option is impossible, not merely costly (only hop 1 may see the original). Copy now says so, and drops the "five seconds" that promised a timer. |
| BBB-006 | Atoms unnamed on the forced path | **P2** | Decide whether the Brief should name the five, or whether first contact via the prediction screen is the intended design. | ☑ **Fixed** §11 — the Brief names them, with the short gloss. The anchor sentence still dominates the screen. |
| BBB-007 | HEADLINE ONLY unreachable by deletion | **P2** | Reconsider which cards mount the redact editor, or reword the card to describe cutting. | ☑ **Fixed** §9 — reworded to describe cutting. Which cards mount the editor is a T1 gameplay decision and was **not** touched. |
| BBB-008 | No immediate response to the verify choice | **P2** | Decide whether an acknowledgement belongs at the point of choice. | ☑ **Fixed** §11 — an acknowledgement that names the question and never the verdict. The ledger keeps the payoff. |
| BBB-009 | Check offered at hop 1 | **P3** | Suppress or annotate at hop 1. | ☑ **Fixed** §10 — suppressed. One condition in `Round.tsx`, approved before making it. |
| BBB-010 | Readout claims card parity | **P3** | Copy correction. | ☑ **Fixed** §8 — "the same card" → "a card from the same deck". |
| BBB-011 | Green marks both original and degraded text | **P3** | Reserve green for verified-true text. | ☑ **Fixed** §11 — new `.paper-received`. Green now means the original and nothing else; swept every `paper` container in the app to confirm. |
| BBB-012 | Reactions inert in pass-and-play | **P3** | Hide unless in a room. | ⊘ **Withdrawn** §9 — not a defect. `ReactionBar.tsx` documents pass-and-play as a supported case; the finding contradicted a stated design intent. |

**Eleven settled, one open.** BBB-003 is the only finding still holding code, and it is holding on
purpose. Everything above is verified by typecheck, unit test and a played round in a browser —
none of it by a room of actual players. See "What is still open", below.

### Priority order

*Written before any of the work. Kept as the record of what the tiers were for; every gate below
except BBB-003 has since been cleared.*

- **P0 — before any further playtesting.** BBB-001. Until the ledger attributes correctly, every
  observation a playtest produces about *which pressure caused what* is unreliable, and so is the
  debrief the room is given. → **cleared** (§8). The gate this tier existed to hold is open: a
  playtest can now proceed on a ledger that reports truthfully.
- **P1 — before the next demo.** BBB-002, BBB-003, BBB-004. → BBB-002 and BBB-004 cleared;
  **BBB-003 open by choice.** It does not block a demo — the cards still present real pressures to
  a human reader, which is the only thing a demo audience experiences.
- **P2 — before wider classroom use.** BBB-005 … BBB-008. → **cleared** (§9, §11).
- **P3 — polish.** BBB-009 … BBB-012. → **cleared** (§8, §9, §10, §11).

### What is still open

Three of these four are not code, and none of them can be closed at a keyboard.

1. **BBB-003** — four cards exert no machine-visible pressure. Held for a played room, deliberately.
2. **The §28 regression playtest has never been run.** Everything in §8–§11 is verified by type, by
   unit test, and — for the last two passes — by driving the app in a browser. None of it has been
   in front of players. This is the single largest gap in the document.
3. **BAD FAITH's `splitByIntent` is unconfirmed in a played round.** §8 argued the derived risk is
   much less likely now that death hops no longer move when a check is spent. That is reasoning,
   not evidence. Do not trust the deliberate-vs-accidental split until a BAD FAITH round has been
   played through it — it is the number the entire mode exists to produce.
4. **No warning as the hop timer approaches zero.** BBB-004's finding named three problems: no
   warning, no confirmation, no record. The record is fixed, because it was the one corrupting the
   debrief. A countdown warning is a pacing change and wants the same room as BBB-003.

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

*As of this pass. Three of the four rows have since been overtaken — kept as written, with what
happened next.*

| ID | Why it was left | Since |
|---|---|---|
| BBB-003 | Giving the four soft cards a machine-visible target changes difficulty and pacing. A design decision, not a defect — the change budget says do not redesign on one diagnosis. | **Still holds.** Re-affirmed in §11. |
| BBB-004 | Marking a forfeited hop needs a new field on `Hop`, and `contracts.ts` is frozen. Needs an explicit decision before anyone touches it. | Decision taken; **done in §10**. |
| BBB-005 – BBB-009, BBB-011, BBB-012 | Design and copy decisions; the protocol's implementation order puts them behind the fundamentals. | Fundamentals landed; **all done or withdrawn in §9 and §11**. |
| `firstLostAtom` tie-break | With attribution corrected, ties are rarer. Breaking them by `ATOMS` order is a display choice, not a defect. | **Still holds.** |

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

---

# 10. The two blocked items, unblocked

Both were held in §8 and §9 for the same reason: they touch files CLAUDE.md protects. Both were
approved before anything was written, and the approval is recorded in the source at each site.

## Implemented

### BBB-004 · `src/types/contracts.ts` + four screens — *a forfeit is not a retelling*

`Hop` gains one optional field:

```ts
/** Nobody authored this one: the clock ran out, the host force-advanced, or a
    wave filled for an absent player, and the text in front of them passed on
    unchanged. */
forfeited?: boolean;
```

Additive and optional, so every hop written before it exists reads as `undefined` — authored,
which is what they were. No saved session and no room payload is invalidated.

**Stamped at four sites, all of them the same fact from different directions:**

| Site | Who ran out |
|---|---|
| `Round.tsx` — the hop timer hitting zero | the player at the device |
| `GameContext.tsx` — the host watchdog | nobody was there at all |
| `RoomStatusBar.tsx` — the host force-advancing | the host decided not to wait |
| `api/_lib/simRound.ts` — `fillWave` | a wave filled for an absent player |

The reducer stamps only when the caller says so (`if (action.forfeited)`), so an authored hop never
carries `forfeited: false` into storage.

**The honest test.** The timer path does not stamp "the box was empty" — it stamps
`text === source`. A player who wrote a real version and was beaten to the button by the clock did
author it, and is not marked. The word-tap editor hands back the whole source until the first word
is cut, so an untouched redaction is an empty box by any other name and is caught by the same test.

**Shown on all four chain screens, under one rule: never while a guess is pending.**

| Screen | Gate | Why |
|---|---|---|
| `Reveal.tsx` | with the author labels (`!holdAuthors`) | the machine can never forfeit, so the badge would narrow the Turing guess a screen early |
| `TuringHop.tsx` | after the vote | same tell, released with the names |
| `BlackboxGuess.tsx` | after the reveal | "time ran out" is part of who wrote it |
| `Accusation.tsx` | after the vote | a forfeited hop passed its text on untouched, so before the vote the badge is a mechanical elimination and the argument is the point |

Copy is `Time ran out`, and the badge is deliberately **not red** — outline and `--ink-soft`,
quieter than the card badge beside it. Running out of time is a rule of the game, not a failure
state, and the house rule is name the part, clear the person. The badge exists so the room can tell
*kept it intact on purpose* from *never got to it*, not so it can find someone to blame for the
difference.

**And on the ledger itself** (`Ledger.tsx`, protected, approved). `AtomWire` drew a forfeited hop
as an ordinary live node — visually identical to somebody choosing to carry the atom past their
turn. It now draws hollow:

```
[carried]—[carried]—[nobody]—[died]— ⋯
```

The wire on either side stays whole, because the atom did survive that hop. Only the node changes,
because *surviving* is not the same act as *being kept*. Same quiet dashed outline as the badge,
and never red.

### BBB-009 · `src/screens/Round.tsx` — *no check at hop 1*

One condition, exactly as proposed in §9:

```diff
-{!checked && round.verificationsLeft > 0 && (
+{!checked && index > 0 && round.verificationsLeft > 0 && (
```

At hop 1 the original is already the text on screen, so a check there buys nothing and takes one
away from a later hop that needs it.

## Verified

| Check | Result |
|---|---|
| Typecheck | clean (`tsc -b` and `tsconfig.api.json`) |
| Full suite | **494 passed**, 2 failed — the same pre-existing `api/_lib/roomStore.test.ts` / live-Upstash failures, unrelated |
| New coverage | 3 reducer cases: an authored hop is unstamped, `forfeited: false` is still unstamped, `forfeited: true` stamps and otherwise advances the chain exactly like any hop |

## Still open

- **No forfeit has been produced in a played round.** Every path above is verified by type, by unit
  test and by reading; none of the four stamping sites has been watched firing on a real clock.
- **§28 regression playtest still not run**, and the BAD FAITH `splitByIntent` path is still
  unconfirmed against a played round.

## Deliberately not done

- **No warning as the timer approaches zero.** BBB-004's finding named three things: no warning, no
  confirmation, no record. This pass fixed the record — the one that corrupts the debrief. A
  countdown warning is a pacing change, and the change budget says do not redesign on one diagnosis.

---

# 11. Closing out P2 and P3

The four remaining items that could be settled without a played room. BBB-003 is deliberately not
among them — see the bottom of this section.

## Implemented

### BBB-006 · `src/screens/Brief.tsx` — *name the five on the path everybody takes*

How to Play names the atoms well, with a "goes when" example each. It is also opt-in from the
sidebar, and the forced path — add players, Initiate round — never went near it. The Brief, which
every room does read, never mentioned them, so the first contact was the prediction screen: five
unfamiliar words to bet on before anyone had said what they were.

The Brief now carries them, between the three steps and the anchor:

```
FIVE THINGS A CLAIM CARRIES                              [Atoms]
  SOURCE   who says so
  NUMBER   the figure and its base
  HEDGE    may / suggests / preliminary
  SCOPE    who, where, when
  CAUSE    correlational vs. causal

Any of them can go missing without anybody lying. That is what the ledger measures at the end.
```

Deliberately the short gloss (`ATOM_SHORT`) rather than How to Play's fuller examples. This screen
is thirty seconds and has one job, and *the card is a pressure, not an instruction to distort* is
the sentence that must survive it — it still gets its own block, in the display face, and is still
the largest thing on the screen. Same icons and same `.howto-atoms` markup, so a property learned
here is recognisable by its mark everywhere it appears later. No new CSS.

The imposter's brief is untouched. It is a different frame for a reason, it already names the one
atom that matters to its reader, and `briefsFor` is unchanged — the tests that assert the honest
players read *exactly* the same thing still hold, because nothing was added to `BriefVariant`.

### BBB-005 · `src/components/PredictionPrompt.tsx` — *stop implying a deduction is possible*

The finding offered two readings: move the stake after first sight of the claim, or admit the
screen is onboarding. **The first is impossible, not merely expensive.** Only the first player may
see the original; putting it on a screen the whole room reads would hand every later hop the exact
thing the chain exists to withhold. There is no version of this game where the prediction can be
reasoned from the text.

So the copy stops pretending otherwise:

```diff
-Five seconds, one tap. Nobody else sees your pick until the debrief.
+You haven't seen the claim yet — only the first player will. Go on instinct.
+Nobody else sees your pick until the debrief.
```

"Five seconds" also promised a timer that was not on the screen and enforced nothing.

With BBB-006 landing one screen earlier, the pick is now a hunch about vocabulary the player has
just been taught, rather than a lottery ticket on five unknown words. The two fixes are worth more
together than separately.

Deliberately not changed: the N-handoff pacing cost in pass-and-play. That is a flow redesign.

### BBB-008 · `src/screens/Terminal.tsx` — *answer the tap where it is made*

Picking an atom dispatched and advanced in the same breath, so the only response to the choice was
the screen becoming something else. It now stops on an acknowledgement:

```
NOTED                                              [Your check]
You'd ask who is the source?

Hold on to that. The ledger at the end will show you what happened to
SOURCE on the way here — and whether asking would have caught it.

                    [ See what happened → ]
```

**What it must not do is say whether the pick was good.** The reveal has not happened yet, and
"SOURCE was the first thing this claim lost" here would answer the ledger's payoff several screens
early. So it repeats the choice back in the reader's own words, promises the answer, and stops.
`VerifyFeedback` in the ledger is unchanged and still delivers it.

### BBB-011 · `global.css`, `Round.tsx`, `SplitDistribute.tsx` — *green means true*

`.paper-original` spent a trustworthiness convention on three different things: the true claim, the
retelling handed to hops 2+, and the deliberately incomplete version each player holds in Crowd
Recall. Two of those three are degraded text by construction.

New `.paper-received` — neutral `--outline`, no claim made either way — applied at hop 2 onwards
and in Crowd Recall's distribution. The palette now reads:

| | Means |
|---|---|
| green `.paper-original` | the original, as it entered play |
| blue `.round-checked` | the original, after a verification |
| neutral `.paper-received` | somebody's retelling — nobody knows yet |
| red `.paper-final` | what came out the far end |

## Verified — played, not just typechecked

Two-hop CHAIN round in Chrome, AI off.

| Check | Result |
|---|---|
| Typecheck | clean |
| Full suite | **494 passed**, 2 failed — the same pre-existing `roomStore` / live-Upstash failures. *Root-caused and fixed in §12; the suite is now fully green.* |
| BBB-006 | Brief shows all five with icons and glosses; the anchor sentence still dominates the screen |
| BBB-005 | New lede renders; no timer is promised |
| BBB-011 | Hop 1 "The claim" green · hop 2 "What you were given" neutral · reveal "What entered play" still green |
| BBB-008 | Acknowledgement renders, names the question not the verdict; the ledger's "You would have checked SOURCE. SOURCE did go, at hop 2 — though HEDGE went first." still lands intact |

## Deliberately not done — BBB-003

Four cards still exert no machine-visible pressure. Giving them targets changes difficulty and
pacing for every round in every mode, and the only evidence for it is one automated tester's
impression that a card felt unbinding. §5's change budget exists for exactly this, and §6 lists the
instrument that would settle it. **This one waits for a room.**

## Findings tally

| | Closed | Open |
|---|---|---|
| P0 | BBB-001 | — |
| P1 | BBB-002, BBB-004 | **BBB-003** |
| P2 | BBB-005, BBB-006, BBB-007, BBB-008 | — |
| P3 | BBB-009, BBB-010, BBB-011, BBB-012 *(withdrawn)* | — |

Eleven settled, one held for evidence.

---

# 12. The two failing room tests — not pre-existing, just unexamined

Every "Verified" table above carries the same line: *494 passed, 2 failed — both
`api/_lib/roomStore.test.ts`, pre-existing, caused by `.env.local` pointing the room tests at live
Upstash, unrelated.* That was repeated across four passes without anyone opening it. The diagnosis
was roughly right and the conclusion was wrong: it was not a fact about the environment to be
lived with, it was a one-line defect in `vite.config.ts`.

## What was actually happening

`apiDevServer` exists to make `/api/*` reachable from `vite dev`, and it loads `.env.local` into
`process.env` so the handlers can read credentials Vite otherwise hides from client code. It was
gated with `apply: 'serve'`.

**Vitest builds a Vite server of its own.** So `configureServer` fired during `vitest run` too, and
pushed the Upstash pair into the test process — pointing `roomStore.test.ts` at the live database,
against a header in that very file which states the opposite:

> No UPSTASH_REDIS_REST_URL / TOKEN in the test env, so every case here exercises the in-process
> Map fallback.

Two cases failed, and only those two, because only those two care where the data lives:

| Case | Why it failed against real Redis |
|---|---|
| `is gone once the TTL has passed` | `vi.setSystemTime` moves this process's clock. It cannot move a clock inside Upstash, so the record was still there. |
| `getRoom lazily catches up an overdue wave and persists the result` | Several network round-trips do not fit in a 5s test timeout. |

Confirmed rather than assumed: a probe test inside the suite reported `VITEST=true` with both
Upstash variables `SET`.

## The fix

```diff
-    apply: 'serve',
+    apply: (_config, { command }) => command === 'serve' && !process.env.VITEST,
```

The plugin is for the dev server, and now it is only for the dev server. Nothing else changed —
same hook, same env loading, same middleware.

## Verified

| Check | Result |
|---|---|
| `roomStore.test.ts` | **19 passed, 0 failed** — and 16.4s → 0.3s, which is the network leaving |
| Full suite | **496 passed, 0 failed**, 25/25 files. Whole run 17s → 1.9s |
| Typecheck, build | clean |
| Dev server not broken | `vite dev` still mounts the route and still injects credentials — `POST /api/room` returned a created room with a code and a seated host. Env injection and middleware mounting are the same hook, so a mounted route proves both. |

## Why it was worth doing

Two failures that have to be explained away on every run are how a third, real one gets waved
through. The suite now states something true: it exercises the in-process Map, on any machine,
whether or not the developer has credentials. **The 2-failure caveat is retired** — the tables
above keep it because it was accurate when written.

Still not covered, and never was: the real Redis code path. `getRedis()` returns a client or null
and the branches either side are thin, but nothing here tests Upstash itself.
