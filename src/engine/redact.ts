/* ============================================================================
   OWNER: T1 (word-tap redaction).

   Reserved path — the signatures below are the contract T1 builds against, so
   nobody invents a different location or shape for this.

   Under compression cards a player taps words out instead of retyping. That
   turns a ~40 second hop into a ~10 second one, and it makes the loss visible:
   you watch "preliminary" disappear instead of quietly failing to write it.

   Reassembly must produce readable text — collapse doubled spaces, drop
   orphaned punctuation, keep sentence-ending marks, capitalise the first
   surviving word. A redacted claim that reads as broken English breaks
   immersion and makes the ledger comparison unfair.

   Punctuation is not independently tappable; it attaches to the word before
   it. Never auto-suggest which words to remove — the choice is the lesson.
   ========================================================================== */

export interface Token {
  text: string;
  index: number;
  removed: boolean;
  punctuation: boolean;
}

export function tokenize(_text: string): Token[] {
  throw new Error('T1: not implemented');
}

export function reassemble(_tokens: Token[]): string {
  throw new Error('T1: not implemented');
}

export function charCount(_tokens: Token[]): number {
  throw new Error('T1: not implemented');
}
