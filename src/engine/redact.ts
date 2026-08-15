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

/** Trailing punctuation a word can carry — attaches to the word, never its own tap target. */
const TRAILING_PUNCT = /([.,!?;:'"”’)\]]+)$/;
const LEADING_PUNCT = /^([("'“‘[]+)/;
/** Marks worth preserving at the end of the reassembled sentence. */
const SENTENCE_END = /[.!?]$/;

/**
 * Split text into tappable words, each carrying any leading/trailing
 * punctuation as part of its own text. Punctuation is never its own token —
 * a lone comma with nothing in front of it has nothing to attach to and is
 * dropped by reassemble() when its word is removed.
 */
export function tokenize(text: string): Token[] {
  if (!text) return [];

  const words = text.trim().split(/\s+/).filter(Boolean);

  return words.map((word, index) => ({
    text: word,
    index,
    removed: false,
    punctuation: /^[.,!?;:'"”’()[\]-]+$/.test(word),
  }));
}

/**
 * Rebuild readable text from the surviving tokens: collapse doubled spaces,
 * drop punctuation left orphaned by a removed neighbour, keep sentence-ending
 * marks, capitalise the first surviving word.
 */
export function reassemble(tokens: Token[]): string {
  const surviving = tokens.filter((t) => !t.removed).map((t) => t.text);
  if (!surviving.length) return '';

  const cleaned = surviving.map((word, i) => {
    let w = word;
    /* A word that opens with punctuation but is now the first surviving
       token has nothing before it to pair with an opening bracket/quote. */
    if (i === 0) w = w.replace(LEADING_PUNCT, '');
    /* Only the last surviving word may end the sentence; strip trailing
       punctuation everywhere else so a removed neighbour cannot leave a
       comma or colon stranded mid-sentence. */
    if (i !== surviving.length - 1) w = w.replace(TRAILING_PUNCT, '');
    return w;
  });

  let result = cleaned.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (!result) return '';

  /* Keep a sentence-ending mark if the original last word had one; otherwise
     leave it off rather than inventing punctuation that wasn't there. */
  const lastOriginal = surviving[surviving.length - 1];
  const endMatch = lastOriginal.match(SENTENCE_END);
  if (endMatch && !SENTENCE_END.test(result)) {
    result += endMatch[0];
  }

  return result.charAt(0).toUpperCase() + result.slice(1);
}

/** Character count of the reassembled text — what the card's limit is checked against. */
export function charCount(tokens: Token[]): number {
  return reassemble(tokens).length;
}
