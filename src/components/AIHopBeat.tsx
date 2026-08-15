/* ============================================================================
   OWNER: T6 (AI participants).

   Round.tsx already composes this, so T6 never opens a shared file.

   T6: when the current hop is in round.aiHopIndexes, hold the screen on a
   brief "Auto-summariser is processing…" beat, call /api/ai-hop, then submit
   the result. On timeout or error, fall back silently to a pre-generated
   rewrite from engine/fallbacks.ts and continue — the room must never see an
   error at the emotional peak of a round.

   The model is a participant under observation. It is never offered to a
   player as help, and it never judges whether an atom survived.
   ========================================================================== */

export default function AIHopBeat() {
  return null;
}
