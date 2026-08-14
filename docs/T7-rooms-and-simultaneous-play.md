# T7 — Rooms and Simultaneous Play

Estimated: 8–10 hours. **The largest task. Do not start before T5 is merged.**

Files: `api/room.ts`, `src/state/room.ts`, `src/screens/Lobby.tsx`, `src/screens/JoinRoom.tsx`.

---

## Why

Sequential pass-and-play leaves six of eight players idle for five minutes. That is the main reason a voluntary group quits before the first Decay Ledger.

Gartic Phone is not fun because drawing is funny. It is fun because **nobody waits** — every chain runs at once, everyone writes simultaneously, and a turn takes forty seconds instead of five minutes.

Rooms also make hidden roles work. A passed-around phone cannot keep a secret, which BAD FAITH (T8) requires.

**Pass-and-play stays** as a fallback for one-phone-per-group classrooms. Do not remove it — it is the inclusion story.

---

## Architecture: polling, not WebSockets

Vercel serverless functions cannot hold open connections, so a WebSocket server does not deploy there without a separate service.

More importantly, you do not need one. Room state is a few kilobytes of JSON. It changes roughly once every thirty seconds. There are eight clients, no positions to interpolate, no twitch timing. **A 1.5-second poll is imperceptible here**, and it avoids connection-state machines and reconnection handling on flaky campus wifi — which is exactly where the users are.

```
api/room.ts
  POST /api/room            create → returns 4-letter code
  POST /api/room/:code/join { name } → returns playerId
  GET  /api/room/:code      full room state  ← polled every 1.5s
  POST /api/room/:code/act  { playerId, action, payload }
```

Store in whatever key-value or Postgres option Vercel currently offers — **check the current docs, their storage lineup changes.** Room state is one JSON blob keyed by code.

**Rooms expire after 4 hours.** No accounts, no history, nothing identifying beyond the display names players type. This keeps the "no data collected" claim true with a database in the stack, which matters because that claim does real work in the proposal.

## Simultaneous chains

With N players, run N parallel chains. Each seeds with a different claim and rotates through every player, so at any moment each person is writing on a different chain. Everyone plays every round. Nobody idles.

The reveal picks one chain to show the room, or steps through several if time allows.

## Client

- `src/state/room.ts` — polling hook, exponential backoff on failure, resume on focus
- Optimistic local update on submit, reconciled by the next poll
- Connection indicator; on prolonged failure, offer to continue in pass-and-play with current state
- Lobby gains: **Create room** (shows code) · **Join room** (enter code) · **Pass and play** (existing flow, unchanged)

## Failure handling

Campus wifi drops. Assume it will.

- A player who disconnects mid-hop rejoins with the same `playerId` and resumes (T5's persistence carries the id)
- If a player is gone at timeout, their hop auto-submits unchanged and the chain continues
- The host can force-advance a stuck round
- Never block the whole room on one device

---

## Acceptance criteria

- [ ] Create room returns a code; others join with it
- [ ] Room state syncs across devices within ~2 seconds
- [ ] Simultaneous chains: no player waits on another to finish
- [ ] Disconnect and rejoin restores the player's position
- [ ] Timeout on an absent player advances the chain
- [ ] Rooms expire; no lasting data
- [ ] Pass-and-play still fully works
- [ ] Tested with 4+ real phones on the deployed URL

## Do not

- Replace pass-and-play
- Add accounts or logins
- Store anything beyond ephemeral room state
- Reach for WebSockets because polling feels unsophisticated
