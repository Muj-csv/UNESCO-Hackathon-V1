# T9 — Prediction Stake and Live Reactions

Estimated: 2–3 hours. Two small features that fix the same problem: **idle players have nothing at risk.**

Files: `src/screens/Prediction.tsx`, `src/screens/Reveal.tsx`, `src/screens/SessionReadout.tsx`, `src/state/gameReducer.ts`.

---

## Part A — Prediction stake

Before the chain starts, every player privately picks: **which atom do you think dies first?**

Five seconds, one tap. Revealed at the debrief.

**Two jobs at once:**

1. **Stakes for waiting players.** In pass-and-play, six of eight people are watching. A private prediction gives them something riding on every hop without introducing competition.
2. **It is the measurement instrument.** The proposal claims BRICK-BY-BRICK is measurable in one class period. Right now that claim has nothing behind it. Prediction versus outcome, tracked across three rounds, makes it concrete.

**Build:**
- Five atom buttons with their one-line descriptions, after the Brief
- Store per player, per round
- At the debrief: *"4 of 8 predicted HEDGE. HEDGE went first, at hop 2."*
- Session readout: *"This room got better at predicting — 3 of 8 in round 1, 6 of 8 in round 3."*

**No scoring.** Report the room's aggregate, never rank individuals. Same rule as everywhere else in the app.

---

## Part B — Live reactions

During the Sequential Reveal, players tap to react as each version appears.

Cheap to build, and it makes the reveal a group event rather than a slideshow. Gartic Phone's reveal works for exactly this reason — everyone is responding together in real time.

**Build:**
- A small reaction bar during reveal steps
- Three or four reactions only. Suggest: 😬 (that's worse) · 👀 (wait, what) · 😂 · 🎯 (nailed it)
- In room mode, reactions broadcast through the poll and appear on all devices
- In pass-and-play, the shared screen collects taps from whoever is holding it — still worth having
- Reactions are ephemeral, never stored, never counted

**Keep it light.** No reaction counts, no "most reacted hop" superlative. The moment it becomes a metric it becomes a score.

---

## Acceptance criteria

- [ ] Prediction screen appears once per round, five seconds to complete
- [ ] Predictions stored per player per round
- [ ] Debrief compares prediction to outcome as a room aggregate
- [ ] Session readout shows the trend across rounds
- [ ] No individual ranking anywhere
- [ ] Reaction bar during reveal, ≤4 options
- [ ] Reactions broadcast in room mode
- [ ] Reactions not stored or counted

## Do not

- Score predictions or rank players
- Add more than four reactions
- Turn reactions into a metric
