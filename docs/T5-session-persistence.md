# T5 — Session Persistence

Estimated: 1–2 hours. Small, unglamorous, and it protects every other feature.

Files: `src/state/persistence.ts`, `src/state/GameContext.tsx`.

---

## The problem

Game state lives in memory only. On a phone being physically passed around a room:

- one accidental back-swipe destroys a five-hop round
- a low-memory Android reclaiming the tab destroys it
- an accidental refresh destroys it
- a notification tap that backgrounds the browser can destroy it

There is no recovery. The round is simply gone, with no explanation, and the group has to start over.

This will happen during a classroom session, and it can happen during a demo. **T7 makes it worse**, because a dropped player in a multiplayer room needs to rejoin without losing the room.

---

## Build

**`src/state/persistence.ts`**

```ts
export function saveState(state: GameState): void;
export function loadState(): GameState | null;
export function clearState(): void;
```

- Serialise to `sessionStorage` under one key
- Include a `version` field; on mismatch, discard rather than rehydrating a stale shape
- Strip transient fields — timer handles, in-flight requests
- Wrap every call in try/catch. Private browsing modes throw on storage access, and a storage failure must never break the game.

**`GameContext.tsx`**

- Save on every state change, debounced ~300ms so rapid dispatches don't thrash
- Load on mount, before first render, so there is no flash of the lobby
- Clear on explicit "new game" and when a session completes

**Resume prompt.** If a saved round is found mid-session, do not silently restore. Ask:

> You have a round in progress. Continue where you left off?
> **Continue** · **Start fresh**

Silent restore is confusing when the previous group has left and someone else picked up the phone.

**Why `sessionStorage`, not `localStorage`.** State should not survive a closed tab. A classroom device gets handed to a different group and a stale game is worse than none. It also keeps the no-persistent-user-data claim clean.

---

## Acceptance criteria

- [ ] Mid-round refresh offers resume, and resuming restores the correct hop
- [ ] Choosing "start fresh" clears fully
- [ ] Storage failure degrades silently, game still playable
- [ ] Version mismatch discards rather than crashing
- [ ] No flash of the lobby before restore
- [ ] Closing the tab and reopening starts clean
- [ ] Timer resumes sensibly, not at zero and not stuck

## Do not

- Use `localStorage`
- Persist across a closed tab
- Store anything identifying beyond the player names already entered
