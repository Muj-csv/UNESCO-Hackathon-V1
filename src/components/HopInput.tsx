import type { ConstraintCard } from '../types/contracts';

/* ============================================================================
   OWNER: T1 (word-tap redaction).

   Round.tsx composes this and does not branch on the card itself, so T1 can
   add the redact editor here without opening a shared file.

   T1: compression cards (`input: 'redact'`) mount a tap-to-remove editor
   seeded with `source`; the other three keep this textarea. Whatever the
   editor does, call onChange with the finished string — the ledger engine
   reads hop.text and does not change.
   ========================================================================== */

export interface HopInputProps {
  card: ConstraintCard | null;
  /** The version in front of this player — what a redact editor tokenises. */
  source: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

export default function HopInput({ card, value, onChange, disabled }: HopInputProps) {
  const limit = card?.charLimit ?? null;
  const over = limit !== null && value.length > limit;

  return (
    <div className="stack">
      <label className="field-label" htmlFor="hop-input">
        Your version
      </label>
      <textarea
        id="hop-input"
        className="field"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write it as accurately as you can."
        autoComplete="off"
        spellCheck={false}
      />
      {limit !== null && (
        <p className={`hop-count mono${over ? ' is-over' : ''}`}>
          {value.length} / {limit}
        </p>
      )}
    </div>
  );
}

/** Whether this input is in a state the round will accept. */
export function hopInputValid(card: ConstraintCard | null, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (card?.charLimit != null && trimmed.length > card.charLimit) return false;
  return true;
}
