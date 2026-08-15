import { useEffect, useState } from 'react';
import type { Atom } from '../types/contracts';
import { tokenize } from '../engine/redact';

/* ============================================================================
   OWNER: T10 (pack authoring).

   Lets an author mark the phrase that holds an atom by tapping its first and
   last word, rather than retyping it — faster, and typing it fresh is how a
   typo breaks keyword matching later. Tap-tap instead of click-drag, on
   purpose: a drag is fiddly at 375px, and a tap is exactly the interaction
   T1's word-tap redaction already trained this room on.
   ========================================================================== */

const ATOM_CLASS: Record<Atom, string> = {
  SOURCE: 'pack-atom-source',
  NUMBER: 'pack-atom-number',
  HEDGE: 'pack-atom-hedge',
  SCOPE: 'pack-atom-scope',
  CAUSE: 'pack-atom-cause',
};

interface PhraseTaggerProps {
  text: string;
  activeAtom: Atom;
  /** Every atom's currently tagged phrase — shown faintly so an author can
      see what's already spoken for while tagging a different one. */
  phrases: Record<Atom, string>;
  onTag: (atom: Atom, phrase: string) => void;
}

export default function PhraseTagger({ text, activeAtom, phrases, onTag }: PhraseTaggerProps) {
  const tokens = tokenize(text);
  const [anchor, setAnchor] = useState<number | null>(null);

  useEffect(() => setAnchor(null), [activeAtom, text]);

  if (!tokens.length) {
    return <p className="muted">Write the original claim above, then tag its phrases here.</p>;
  }

  const ownerOf = (index: number): Atom | null => {
    for (const atom of Object.keys(phrases) as Atom[]) {
      if (atom === activeAtom) continue;
      const range = phrases[atom] ? findRange(tokens, phrases[atom]) : null;
      if (range && index >= range[0] && index <= range[1]) return atom;
    }
    return null;
  };

  const activeRange = phrases[activeAtom] ? findRange(tokens, phrases[activeAtom]) : null;

  const handleClick = (index: number) => {
    if (anchor === null) {
      setAnchor(index);
      return;
    }
    const [start, end] = anchor <= index ? [anchor, index] : [index, anchor];
    const phrase = tokens
      .slice(start, end + 1)
      .map((t) => t.text)
      .join(' ');
    onTag(activeAtom, phrase);
    setAnchor(null);
  };

  return (
    <div className="pack-tagger">
      <p className="pack-tagger-hint muted">
        {anchor === null
          ? `Tap the first word of the phrase that holds ${activeAtom}.`
          : 'Tap the last word — or the same word again for a single word.'}
      </p>
      <p className="paper-text pack-tagger-text">
        {tokens.map((token, i) => {
          const owner = ownerOf(i);
          const isActive = !!activeRange && i >= activeRange[0] && i <= activeRange[1];
          const classes = ['pack-tagger-word'];
          if (isActive) classes.push(ATOM_CLASS[activeAtom], 'is-tagged');
          else if (owner) classes.push(ATOM_CLASS[owner], 'is-owned');
          if (anchor === i) classes.push('is-anchor');
          return (
            <button
              key={token.index}
              type="button"
              className={classes.join(' ')}
              onClick={() => handleClick(i)}
            >
              {token.text}
            </button>
          );
        })}
      </p>
    </div>
  );
}

/** Locate `phrase` as a contiguous run of tokens, so the highlight tracks it
    even though only the text, not the original indices, survives a re-tag. */
function findRange(tokens: { text: string }[], phrase: string): [number, number] | null {
  const needle = phrase.trim().split(/\s+/);
  if (!needle.length) return null;
  for (let start = 0; start <= tokens.length - needle.length; start++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (tokens[start + j].text !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return [start, start + needle.length - 1];
  }
  return null;
}
