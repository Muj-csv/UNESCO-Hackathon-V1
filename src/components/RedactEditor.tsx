import { useEffect, useState } from 'react';
import { charCount, reassemble, tokenize, type Token } from '../engine/redact';

/* ============================================================================
   T1 — the redact editor.

   Compression cards (chars, headline, secs) mount this instead of a textarea.
   The player taps a word to remove it, taps it again to restore it. Removed
   words stay visible, struck through, so the loss is something the player
   watches happen rather than a quiet omission.

   Never auto-suggests a word to remove — the choice is the lesson.
   ========================================================================== */

export interface RedactEditorProps {
  /** The version in front of this player — tokenised fresh whenever it changes. */
  source: string;
  charLimit?: number;
  onChange: (next: string) => void;
}

export default function RedactEditor({ source, charLimit, onChange }: RedactEditorProps) {
  const [tokens, setTokens] = useState<Token[]>(() => tokenize(source));

  /* A new hop hands over a new source string; start clean rather than diffing. */
  useEffect(() => {
    setTokens(tokenize(source));
  }, [source]);

  const preview = reassemble(tokens);
  const count = charCount(tokens);
  const over = charLimit != null && count > charLimit;

  useEffect(() => {
    onChange(preview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  const toggle = (index: number) => {
    setTokens((prev) => prev.map((t) => (t.index === index ? { ...t, removed: !t.removed } : t)));
  };

  return (
    <div className="stack">
      <p className="field-label">Tap words to cut them</p>

      <div className="redact-words">
        {tokens.map((token) => (
          <button
            key={token.index}
            type="button"
            className={`redact-word${token.removed ? ' is-removed' : ''}`}
            onClick={() => toggle(token.index)}
            aria-pressed={token.removed}
          >
            {token.text}
          </button>
        ))}
      </div>

      <div className="paper redact-preview">
        <p className="eyebrow">What you're sending</p>
        <p className="paper-text">{preview || '—'}</p>
      </div>

      {charLimit != null && (
        <p className={`hop-count mono${over ? ' is-over' : ''}`}>
          {count} / {charLimit}
        </p>
      )}
    </div>
  );
}
