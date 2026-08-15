/* ============================================================================
   OWNER: T7 (rooms and simultaneous play).

   Reserved path. Vercel serverless function holding ephemeral room state,
   polled by clients every ~1.5s.

   Returns 501 until T7 lands. Pass-and-play works without it, so this
   deploying as a stub changes nothing for a player.

   ── Shape ──
     POST /api/room                  create → 4-letter code
     POST /api/room/:code/join       { name } → playerId
     GET  /api/room/:code            full room state   ← polled
     POST /api/room/:code/act        { playerId, action, payload }

   Polling, not WebSockets: serverless functions cannot hold open connections,
   and the game is turn-based with roughly one update every thirty seconds. A
   1.5s poll is imperceptible here and avoids reconnection state machines on
   flaky campus wifi — which is exactly where the users are.

   ── Constraints ──
   - Rooms expire after 4 hours. No accounts, no history, nothing identifying
     beyond the display names players type. That claim does real work in the
     proposal, so keep it true.
   - hop.isImposter must NEVER appear in a client payload before the reveal.
     Filter it server-side, or a curious player reads it in DevTools.
   ========================================================================== */

export default async function handler(_req: unknown, res: any) {
  res.status(501).json({
    error: 'not_implemented',
    message: 'Rooms are not built yet (T7). Pass-and-play works without this.',
  });
}
