# T4 — Verify Before You Share

Estimated: 2 hours.

Files: `src/screens/Terminal.tsx`, `src/screens/Ledger.tsx`, `src/state/gameReducer.ts`.

---

## Goal

The final reader chooses **Share / Flag / Verify**. Verify currently does nothing but advance.

Make it ask a second question: **what would you check first?**

This is what turns the game from a description of a behaviour into rehearsal of one — the difference between MIL awareness and MIL practice, and what "intervention" means to a UNESCO reader. Small build, disproportionate payoff.

---

## The five options

| Shown to the player | Atom |
|---|---|
| Who is the source? | `SOURCE` |
| What is the number, and out of what? | `NUMBER` |
| How certain is the evidence? | `HEDGE` |
| Who, where, and when does this apply to? | `SCOPE` |
| Is this correlation, or causation? | `CAUSE` |

Word them as questions a person would actually ask. These are the takeaway a player leaves with, so the wording matters more than the code around it.

---

## Build

**State.** Add `verifyChoice: Atom | null`, reset on `BEGIN_ROUND` alongside the terminal decision.

**Terminal screen.** Tapping Verify replaces the three buttons with the five questions and a short prompt:

> You chose to check it first. What would you check?

Share and Flag behave exactly as now.

**Ledger feedback.** Extend the existing "terminal decision, revisited" card:

- Chose the atom that died first → *You would have checked HEDGE first. HEDGE was the first thing this claim lost.*
- Chose an atom that died, but not first → *You would have checked SCOPE. SCOPE did go, at hop 4 — though HEDGE went first.*
- Chose an atom that survived → *You would have checked SOURCE. SOURCE actually made it through intact. HEDGE was the one that went.*
- All atoms survived → *You would have checked SOURCE. This claim made it through with everything intact.*

**Never score this.** No right/wrong marking, no points, no "correct!". State what happened and let the player draw the conclusion. The app has no scoring anywhere and this must not become the exception.

---

## Acceptance criteria

- [ ] Verify opens the picker instead of advancing
- [ ] Share and Flag unchanged
- [ ] `verifyChoice` resets between rounds
- [ ] All four feedback cases produce sensible copy
- [ ] No scoring language anywhere
- [ ] Five stacked options readable at 375px

## Do not

- Add points or right/wrong marking
- Make Verify mandatory or discourage Share
- Change the mid-chain verification budget (separate concern)
