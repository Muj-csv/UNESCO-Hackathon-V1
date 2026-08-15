/* ============================================================================
   OWNER: T6 (AI participants).

   Reserved path. Vercel serverless function proxying the AI participant so
   the API key never reaches the client.

   Returns 501 until T6 lands. The client MUST already treat any non-200 as a
   silent fallback (engine/fallbacks.ts), so this deploying as a stub changes
   nothing for a player.

   ── Non-negotiable system prompt constraints ──
   The model may only COMPRESS OR REPHRASE THE TEXT IT WAS GIVEN. It may not
   introduce new facts, entities, numbers, names or claims, and may not add
   commentary or framing. It returns only the rewritten text.

   Minors are in the room and the output goes on a shared screen. Treat the
   prompt as a safety control, not a formatting instruction.

   Also required: rate-limit by IP (the endpoint is public), cap request and
   response length, and time out at 6 seconds.

   The model NEVER judges whether an atom survived. That stays with the room —
   a game about opaque systems does not seat an opaque system as arbiter.
   ========================================================================== */

export default async function handler(_req: unknown, res: any) {
  res.status(501).json({
    error: 'not_implemented',
    message: 'AI participant is not built yet (T6). Use the pre-generated fallback.',
  });
}
