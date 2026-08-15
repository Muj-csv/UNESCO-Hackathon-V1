import type { CardId } from '../types/contracts';

/* ============================================================================
   OWNER: T6 (AI participants).

   Reserved path. Pre-generated rewrites for every shipped claim × card
   combination, so the game stays fully playable when the AI service is
   unavailable, rate-limited, out of budget, or missing its key.

   On timeout or error, fall back SILENTLY and continue. The room must never
   see an error at the emotional peak of a round.

   Build this in the same session as api/ai-hop.ts, not afterwards. A demo
   that stalls mid-chain is worse than no AI hop at all.
   ========================================================================== */

/** Keyed by claim id, then card id. */
export type FallbackTable = Record<string, Partial<Record<CardId, string>>>;

export const FALLBACKS: FallbackTable = {
  /* T6 fills this in — one rewrite per shipped claim, per card. */
};

/**
 * A pre-generated rewrite, or null when there is none.
 * A null here means the caller should pass the previous text through
 * unchanged rather than showing anything resembling an error.
 */
export function fallbackFor(claimId: string, cardId: CardId | null): string | null {
  if (!cardId) return null;
  return FALLBACKS[claimId]?.[cardId] ?? null;
}
