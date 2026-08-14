# TruthChain

**A media and information literacy game about how true information quietly stops being true.**

UNESCO Youth Hackathon 2026 · *Play Your Part: Youth Designing the Future of Media and Information Literacy*
Track: AI and MIL · Category: Games · Live: **[VERCEL URL]**

---

## 1. Team members

| Name | Age | Role | Institution |
|---|---|---|---|
| [Name] | [ ] | Team lead · architecture, integration | Angeles University Foundation |
| [Name] | [ ] | Backend · room service and realtime sync | Angeles University Foundation |
| [Name] | [ ] | Backend · AI participant service | Angeles University Foundation |
| [Name] | [ ] | Backend · ledger engine and claim validation | Angeles University Foundation |
| [Name] | [ ] | Frontend · game screens and reveal sequence | Angeles University Foundation |
| [Name] | [ ] | Frontend · Pack Studio and facilitation design | Angeles University Foundation |

All members are aged 18–30 and are undergraduate Computer Science students at Angeles University Foundation, Philippines.

---

## 2. Problem statement

Most media and information literacy education teaches people to detect liars — spot the fake account, the doctored image, the propaganda outlet.

That framing misses the larger share of the problem. A great deal of false information reaches people with no bad actor anywhere in the chain. It starts as something true and degrades as ordinary people retell it under ordinary pressure: a character limit, a group chat, a headline that has to fit, an audience that expects a particular conclusion. Everyone is trying to be accurate. The claim becomes false anyway.

AI systems did not create this failure. They industrialise it. Summarisers compress on every pass rather than occasionally. Answer boxes state uncertain findings in the same confident register as settled ones. Recommender systems select for the version of a claim that performs rather than the version that is accurate.

**There is also evidence that the dominant fix is producing a side effect.** The leading MIL games are built on inoculation theory, casting the player as a manipulator to teach technique recognition. Recent research suggests these interventions may mainly increase *conservative reporting* — players become more likely to label items as fake overall, including true ones. That is suspicion, not discernment. [*Add citation before submission — see arXiv 2503.02135 for the reference chain.*]

What learners lack is not more scepticism. It is a vocabulary for **what specifically gets lost** when accurate information travels, and practice noticing that loss in claims that are not fake — only degraded.

---

## 3. Objectives

TruthChain is built around a six-stage learning arc:

**EXPERIENCE → DIAGNOSE → DETECT → COMPARE → VERIFY → AUTHOR**

By the end of a session, a learner can:

1. **Name** the five properties that make a claim trustworthy — source, number, hedge, scope, and causality.
2. **Identify** which property a piece of information has lost, and at what point.
3. **Explain** why a specific pressure — brevity, engagement, speed, confidence — destroys a specific property.
4. **Distinguish** deliberate distortion from accidental degradation, and recognise that the two are often indistinguishable in the output.
5. **Compare** how a human and an AI system degrade the same claim under the same pressure.
6. **Choose** what to verify first when they cannot verify everything.
7. **Author** a claim set for their own community, applying the framework rather than only consuming it.

Objectives 4, 5 and 7 are what separate this from a media literacy quiz. The learner ends the session having hunted a saboteur, run a comparison, and built an instrument.

---

## 4. Target audience

**Primary.** Senior high school and undergraduate students aged 15–22 in the Philippines, especially in classrooms where students share devices rather than each having one.

**Secondary.** Teachers and youth organisation facilitators who need a self-running MIL activity. On-screen discussion prompts and a one-page facilitator guide mean someone with no MIL training can run a full session.

**Tertiary.** Any group of four to twelve people. Plays either on individual phones in a shared room, or passed around a single device.

The design constraint that follows: **the barrier to entry is a room, not a computer lab.**

---

## 5. Prototype and concept

TruthChain is a working browser game, playable now at **[VERCEL URL]**. Text-only, no installation, no account, runs on a low-end phone.

### The five Integrity Atoms

Every claim is tagged along five dimensions. This is the entire measurement system and the project's central contribution — portable to any MIL curriculum, with or without the game.

| Atom | What it holds | How it dies |
|---|---|---|
| **SOURCE** | who says so | "studies show" with nobody named |
| **NUMBER** | the figure and its base | a percentage with the denominator dropped |
| **HEDGE** | may, suggests, preliminary | an early finding retold as settled |
| **SCOPE** | who, where, when | one campus becomes everywhere |
| **CAUSE** | correlational or causal | "linked to" becomes "causes" |

### Three modes

| Mode | Villain | What it teaches |
|---|---|---|
| **CHAIN** | none | decay needs no bad actor |
| **BAD FAITH** | one hidden imposter | the accidents do more damage than the sabotage |
| **CROWD RECALL** | none, structurally | a group cannot recover what nobody holds |

**CHAIN.** A true claim passes player to player. Each sees only the previous version and rewrites it under a **constraint card** applying a real pressure — a ninety-character limit, a countdown, an instruction to sound certain. Under compression cards, players *tap words out* rather than retyping, so the loss is visible as it happens. No card ever asks anyone to lie.

**BAD FAITH.** Identical, except one player secretly receives a different brief: rewrite under your constraint, and make one named property die. Everyone else plays honestly and does not know a saboteur exists.

After the reveal, the room argues and votes on who it was. Then the ledger lands, and the imposter turns out to have killed **one** property on purpose while the honest players killed **three** by accident.

That inversion is why the mode exists. In CHAIN, players are told nobody lied. In BAD FAITH, they discover it while actively hunting a liar. The imposter learns the same lesson from the other side: how small an edit needs to be, and that deliberate distortion is indistinguishable from an honest mistake under pressure.

**CROWD RECALL.** Every player receives a *different* version of the same claim, each missing one property, and none of them know theirs was altered. The group reconstructs the original together. The ledger shows what the group collectively could not recover — because the person holding the version missing that property had no way to supply it. There is deliberately no traitor.

**The pairing is the curriculum.** BAD FAITH and CROWD RECALL are designed as opposites. Play both and compare: one room had a saboteur and lost three properties; one had none and lost three. That comparison teaches the distinction the field currently collapses — between sabotage and pressure.

### AI participants and the Turing Hop

Some hops are taken by an AI language model rather than a person. It receives the same previous version and the same constraint card, and both hops are audited identically by the same ledger.

Before the ledger appears, the room guesses **which hop was the machine**. Most rooms cannot tell — and that failure is the lesson: a summariser's output is not distinguishable from a person doing their honest best under the same constraint. In BAD FAITH, two hidden identities stack into one argument: which hop was the machine, and which was the traitor.

**AI appears here as a participant under observation, never as an assistant to the player.** Nobody uses it to play better. Everyone watches what it does to true information.

### The Decay Ledger

```
CAUSE — LOST AT HOP 5
Trigger:   SOUND CERTAIN  (AI participant)
Original:  "associated with"
Final:     "causes"
```

Telephone shows that a message changed. TruthChain shows what was lost, where it disappeared, and what pressure caused it. Where detection is uncertain, the ledger proposes and the room decides — the noticing is the learning.

In BAD FAITH the ledger closes with the comparison that carries the whole lesson: *deliberate 1, accidental 3.*

There is no score, no leaderboard, no ranking. The ledger measures what happened to the claim, never who is best.

### Verify before you share

The final reader sees only the last version and chooses **Share, Flag, or Verify**. Choosing Verify asks a second question — *what would you check first?* — with five options mapping onto the five properties. The ledger then shows whether that was the one the claim had already lost.

This converts the game from a description of a behaviour into rehearsal of one.

### Pack Studio

Learners author their own claims — the original text, its five properties, and the degraded variants — and share them by link. No account, no server storage; the pack travels inside the URL itself.

Writing a claim where all five properties are present and separable teaches the framework more thoroughly than playing does. It is also where the theme becomes literal: young people stop being the audience for an MIL tool and become the authors of one, in their own language, about their own community.

---

## 6. Sustainability

**Near-zero cost.** A static React application on free hosting, plus two small serverless functions: one relaying AI participant requests so no key is exposed, one holding ephemeral room state for multiplayer sessions. No persistent database of users, no accounts, no storage that grows with adoption.

**Rooms expire; nothing is kept.** Room state lives for a few hours and is discarded. No email, no login, no analytics, no student text retained. Our users are minors in classrooms, so collecting nothing is a design requirement rather than an oversight.

**It degrades gracefully.** Pre-generated fallback rewrites ship with the application, so the game remains fully playable if the AI service is unavailable or its budget is exhausted. Pass-and-play on a single shared device works without the room service at all. The AI improves the lesson; the tool does not depend on it.

**Open claim packs.** The claim format is documented JSON, shareable by link or file. Teachers and youth organisations author and distribute packs without our involvement. Code under [MIT]; packs under [CC BY 4.0].

**Where we use AI, and where we refuse to.** AI takes hops in the chain, where it is the subject under study, under a constrained prompt that only permits compressing or rephrasing the text it was given. It does not judge whether a property survived — that stays with the room. A game about opaque systems should not seat an opaque system as the arbiter.

**Maintenance.** [Maintained by NAME at the AUF College of Computer Studies; repository at GITHUB URL.]

**Planned extension.** Fully offline distribution for schools without connectivity is on the roadmap, not a current claim.

---

## 7. Creativity and innovation

**A vocabulary, not just a game.** The five Integrity Atoms work as a classroom checklist with no application at all. The game exists to make the vocabulary felt rather than memorised.

**It teaches the distinction the field collapses.** Every major MIL game casts the player as a manipulator, and the evidence suggests this mainly produces blanket suspicion. TruthChain never asks whether something is true. It asks what it has lost — and by running the villain and villain-free cases side by side, it teaches learners to tell sabotage from pressure.

**Diagnosis instead of demonstration.** TruthChain resembles Telephone and we say so openly. The difference is instrumentation: a per-property audit naming the lost phrase, the hop, and the pressure responsible.

**AI as a subject, not a feature.** Most projects add AI to appear current. Here the model is the thing being examined, audited by exactly the same ledger as a human. The strongest finding the game produces is that a room usually cannot tell which hop was the machine.

**Two-way learning in BAD FAITH.** The room learns detection; the imposter learns distortion from the inside and discovers how little they had to do. Both halves of the lesson run in the same five minutes.

**Fidelity, not judgment.** Removing scoring was deliberate and costly. A scored version teaches students that some people are careless; the truth is that everyone is subject to the same pressures.

**Playing your part.** The theme is literal twice over. Each player's hop is their part, and the ledger records it — naming the pressure, never accusing the person. And through Pack Studio, young people play a part in building MIL for their own community. Nobody lied. Everybody played their part.

---

## 8. Feasibility

**It exists and is playable.** Live at **[VERCEL URL]**.

**Technically modest by design.** React and TypeScript, deployed as static output on free hosting, with two serverless functions. Multiplayer uses simple polling rather than persistent connections — the game is turn-based with roughly one update every thirty seconds, so a 1.5-second poll is imperceptible and avoids reconnection fragility on school wifi. No authentication, no user database, no infrastructure to provision.

**Playtested.** [Run with N students at Angeles University Foundation on DATE. Finding: SCOPE was the property players were least likely to notice had gone.]

> **Before submitting:** move each item below into the correct list based on what has actually landed. An honest split is doing real credibility work here, and a judge who opens the URL and finds a missing feature loses more than the feature would have gained.

**Built:** CHAIN mode · CROWD RECALL · the constraint card deck · pressure environments · the Decay Ledger with per-property diagnosis · Share/Flag/Verify with property selection · word-tap redaction · host settings · discussion prompts · facilitator guide.

**In development:** BAD FAITH mode · AI participants and the Turing Hop · multiplayer rooms · Pack Studio sharing.

**Planned, not built:** full Filipino and Taglish localisation · team play · additional modes · offline distribution. These appear in the application as disabled settings, so players can see the roadmap without us overstating what exists.

**Adoption cost for a school: zero.** One phone or several, one link, one class period. No procurement, no installation, no accounts, no training — the on-screen prompts run the debrief.

**Principal risk.** Value depends on claim quality, and claims are hand-authored. We mitigate with a documented authoring pipeline, a validator that refuses malformed claims at load, and an open format so quality improves through contribution rather than through us alone.

---

*All claims used in TruthChain are fabricated and clearly labelled as fictional in-game. No real people, organisations, or events are referenced.*
