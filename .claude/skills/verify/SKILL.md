---
name: verify
description: Build/launch/drive recipe for BRICK-BY-BRICK (Vite + React SPA, no backend running locally)
---

# Verifying BRICK-BY-BRICK in a browser

## Launch

```
npx vite --port 5183
```

No `.env`, no backend — `/api` functions are Vercel serverless and are not
needed to exercise client state/UI.

## Driving it (no Playwright in devDependencies)

`npx playwright` alone fails with a "run `npm install` first" warning and
does not actually install browsers. What works: install `playwright` into a
scratch dir (not the project — avoid adding deps without asking) and run
node scripts from there against the already-running dev server.

```
cd <scratch-dir>
npm init -y && npm install playwright@1.62.1
npx playwright install chromium   # ~/AppData/Local/ms-playwright, one-time
node your-script.js               # require('playwright') resolves from scratch node_modules
```

`chromium.launch()` (headless, default) works fine on this Windows box.

## Route through a round (for state/persistence work)

1. Lobby: `.lobby-name` input + `button:has-text("Add")`, add >= 2 players.
2. `button:has-text("Start the round")` → Brief screen (`h2:has-text("The brief")`).
3. `button:has-text("Continue")` on Brief → Prediction self-skips → Round's
   handoff screen (`.handoff button`, text `I'm <player>`).
4. Click the handoff button → hop editor (`#hop-input` textarea).
5. Fill `#hop-input`, click `button:has-text("Pass it on")` to submit a hop.

## Gotchas

- `killall node` / `taskkill /F /IM node.exe` kills every node process on the
  box, not just the dev server — fine in a disposable sandbox, don't do it on
  a shared machine.
- sessionStorage is per browser-context in Playwright — `browser.newContext()`
  simulates a fresh tab/closed-tab-reopened; closing and reopening the same
  context does not clear it (matches real browser semantics).
