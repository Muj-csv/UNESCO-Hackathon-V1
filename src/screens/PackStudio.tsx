import { useEffect, useMemo, useRef, useState } from 'react';
import type { Atom, Claim } from '../types/contracts';
import { ATOMS } from '../types/contracts';
import { useGameDispatch } from '../state/GameContext';
import StageBar from '../components/StageBar';
import PhraseTagger from '../components/PhraseTagger';
import {
  ATOM_LABEL,
  draftToClaim,
  emptyClaimDraft,
  makeClaimId,
  validateClaim,
} from '../engine/validateClaim';
import type { ClaimDraft } from '../engine/validateClaim';
import { MAX_LINK_CLAIMS, PackDecodeError, buildShareFragment, parsePackJson } from '../engine/packCodec';

/* ============================================================================
   OWNER: T10 (pack authoring).

   This is where the theme stops being a metaphor: young people stop being
   the audience for an MIL tool and become the authors of one. One claim at a
   time — original text, the five atoms tagged by selecting text rather than
   retyping, and five degraded variants, each with exactly one atom degraded
   and the other four intact.

   Kept deliberately minimal: this screen only authors claims into a local
   list. Sharing that list by link, export, and import land in the next pass
   — see docs/T10-pack-authoring.md.

   Do not use AI to generate claims. The authoring is the learning.
   ========================================================================== */

const ATOM_NOTE: Record<Atom, string> = {
  SOURCE: 'Who says so — a named source, not "experts" or "reports say".',
  NUMBER: 'The figure and what it is measured against — the base, not just the headline number.',
  HEDGE: 'How certain the original really is — "may", "suggests", "preliminary".',
  SCOPE: 'Who, where, and when this applies — not everyone, everywhere, always.',
  CAUSE: 'Correlation versus causation — "linked to", never "causes".',
};

export default function PackStudio() {
  const dispatch = useGameDispatch();

  const [draft, setDraft] = useState<ClaimDraft>(emptyClaimDraft);
  const [activeAtom, setActiveAtom] = useState<Atom>('SOURCE');
  const [kwInput, setKwInput] = useState('');
  const [orInput, setOrInput] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [pack, setPack] = useState<Claim[]>([]);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    setKwInput('');
    setOrInput('');
  }, [activeAtom]);

  const validation = useMemo(() => validateClaim(draft), [draft]);
  const phrases = useMemo(
    () => ATOMS.reduce((acc, a) => ({ ...acc, [a]: draft.atoms[a].phrase }), {} as Record<Atom, string>),
    [draft],
  );

  const setAtomField = (atom: Atom, patch: Partial<ClaimDraft['atoms'][Atom]>) => {
    setDraft((d) => ({ ...d, atoms: { ...d.atoms, [atom]: { ...d.atoms[atom], ...patch } } }));
  };

  const addToList = (atom: Atom, field: 'keywords' | 'overreach', value: string) => {
    const v = value.trim();
    if (!v) return;
    setAtomField(atom, { [field]: [...draft.atoms[atom][field], v] });
  };

  const removeFromList = (atom: Atom, field: 'keywords' | 'overreach', index: number) => {
    setAtomField(atom, { [field]: draft.atoms[atom][field].filter((_, i) => i !== index) });
  };

  const setDegraded = (atom: Atom, text: string) => {
    setDraft((d) => ({ ...d, degraded: { ...d.degraded, [atom]: text } }));
  };

  const fieldErrors = (field: string) => validation.errors.filter((e) => e.field === field);

  const addClaim = () => {
    setAttempted(true);
    if (validation.errors.length) return;
    const claim = draftToClaim(draft, makeClaimId(draft.topic));
    setPack((p) => [...p, claim]);
    setDraft(emptyClaimDraft());
    setActiveAtom('SOURCE');
    setAttempted(false);
    setSavedNote(`Added "${claim.topic}" to this pack.`);
  };

  const removeClaim = (id: string) => {
    setPack((p) => p.filter((c) => c.id !== id));
  };

  /* -------------------------------------------------------------- sharing -- */

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildLink = async () => {
    setShareError(null);
    setCopied(false);
    try {
      const fragment = await buildShareFragment(pack);
      setShareUrl(`${window.location.origin}${window.location.pathname}#${fragment}`);
    } catch {
      setShareError("Couldn't build a link on this browser. Try Export to file instead.");
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setShareError('Copy failed — select and copy the link text instead.');
    }
  };

  const exportFile = () => {
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'truthchain-pack.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = (file: File) => {
    setImportError(null);
    file
      .text()
      .then((text) => {
        const imported = parsePackJson(text);
        setPack((p) => [...p, ...imported]);
      })
      .catch((err) => {
        setImportError(err instanceof PackDecodeError ? err.message : "Couldn't read that file.");
      });
  };

  const playPack = () => {
    dispatch({ type: 'LOAD_PACK', claims: pack });
    dispatch({ type: 'GO_TO', screen: 'lobby' });
  };

  const atomDraft = draft.atoms[activeAtom];
  const degradedForActive = draft.degraded[activeAtom];

  return (
    <div className="screen">
      <StageBar label="Pack Studio" note="Author a claim" />
      <header>
        <h2>Write your own claim</h2>
        <p className="muted">
          Fabricated claims only — no real people, organisations, or events. One claim, all five
          atoms, five variants that each degrade exactly one.
        </p>
      </header>

      <section className="stack">
        <p className="eyebrow">1. The original claim</p>
        <label className="field-label" htmlFor="pack-topic">
          Topic
        </label>
        <input
          id="pack-topic"
          className="field"
          value={draft.topic}
          onChange={(e) => setDraft((d) => ({ ...d, topic: e.target.value }))}
          placeholder="e.g. School attendance"
          maxLength={40}
        />
        <label className="field-label" htmlFor="pack-original">
          Original text — one or two sentences
        </label>
        <textarea
          id="pack-original"
          className="field"
          value={draft.originalText}
          onChange={(e) => setDraft((d) => ({ ...d, originalText: e.target.value }))}
          placeholder="A named source says a specific, hedged, scoped, correlational thing…"
          rows={3}
        />
        {attempted && fieldErrors('originalText').map((e, i) => (
          <p key={i} className="pack-error">
            {e.message}
          </p>
        ))}
        {validation.warnings.map((w, i) => (
          <p key={i} className="pack-warning">
            {w.message}
          </p>
        ))}
      </section>

      <section className="stack">
        <p className="eyebrow">2. Tag the five atoms</p>
        <div className="row pack-atom-tabs">
          {ATOMS.map((atom) => (
            <button
              key={atom}
              type="button"
              className={`atom-chip${activeAtom === atom ? ' is-alive' : ''}`}
              onClick={() => setActiveAtom(atom)}
            >
              {atom}
              {draft.atoms[atom].phrase ? ' ✓' : ''}
            </button>
          ))}
        </div>

        <p className="muted">{ATOM_NOTE[activeAtom]}</p>

        <PhraseTagger
          text={draft.originalText}
          activeAtom={activeAtom}
          phrases={phrases}
          onTag={(atom, phrase) => setAtomField(atom, { phrase })}
        />

        <div className="paper">
          <p className="field-label">Tagged phrase</p>
          <p className="paper-text">{atomDraft.phrase || 'Not tagged yet.'}</p>
        </div>
        {attempted && fieldErrors(`atoms.${activeAtom}.phrase`).map((e, i) => (
          <p key={i} className="pack-error">
            {e.message}
          </p>
        ))}

        <label className="field-label" htmlFor="pack-truth">
          What {activeAtom} holds here, in plain words — shown in the ledger
        </label>
        <input
          id="pack-truth"
          className="field"
          value={atomDraft.truth}
          onChange={(e) => setAtomField(activeAtom, { truth: e.target.value })}
          placeholder="e.g. Preliminary figures that only suggest a trend"
        />

        <ChipInput
          label="Alternative phrasings that still count as this atom surviving"
          value={kwInput}
          onChange={setKwInput}
          onAdd={() => {
            addToList(activeAtom, 'keywords', kwInput);
            setKwInput('');
          }}
          items={atomDraft.keywords}
          onRemove={(i) => removeFromList(activeAtom, 'keywords', i)}
        />
        {attempted && fieldErrors(`atoms.${activeAtom}.keywords`).map((e, i) => (
          <p key={i} className="pack-error">
            {e.message}
          </p>
        ))}

        <ChipInput
          label="Overreach phrases — wording that means this atom already died"
          value={orInput}
          onChange={setOrInput}
          onAdd={() => {
            addToList(activeAtom, 'overreach', orInput);
            setOrInput('');
          }}
          items={atomDraft.overreach}
          onRemove={(i) => removeFromList(activeAtom, 'overreach', i)}
        />
      </section>

      <section className="stack">
        <p className="eyebrow">3. Five degraded variants</p>
        <p className="muted">
          One variant per atom. Rewrite the claim so {ATOM_LABEL[activeAtom]} is the one thing
          that degrades — keep the other four intact.
        </p>
        <label className="field-label" htmlFor="pack-degraded">
          Variant where {activeAtom} degrades
        </label>
        <textarea
          id="pack-degraded"
          className="field"
          value={degradedForActive}
          onChange={(e) => setDegraded(activeAtom, e.target.value)}
          rows={3}
        />
        {attempted && fieldErrors(`degraded.${activeAtom}`).map((e, i) => (
          <p key={i} className="pack-error">
            {e.message}
          </p>
        ))}
        <div className="row pack-variant-status">
          {ATOMS.map((atom) => (
            <span key={atom} className={`atom-chip${draft.degraded[atom].trim() ? ' is-alive' : ''}`}>
              {atom}
            </span>
          ))}
        </div>
      </section>

      {attempted && validation.errors.length > 0 && (
        <section className="card pack-issues">
          <p className="eyebrow">{validation.errors.length} thing{validation.errors.length === 1 ? '' : 's'} to fix</p>
          {validation.errors.map((e, i) => (
            <p key={i} className="muted">
              {e.message}
            </p>
          ))}
        </section>
      )}

      <button className="btn btn-primary btn-block" onClick={addClaim}>
        Add this claim to the pack
      </button>

      {pack.length > 0 && (
        <section className="stack">
          <p className="eyebrow">Claims in this pack ({pack.length})</p>
          {pack.map((c) => (
            <div key={c.id} className="row">
              <span className="paper-text" style={{ flex: 1 }}>
                {c.topic}
              </span>
              <button className="btn btn-ghost btn-small" onClick={() => removeClaim(c.id)}>
                Remove
              </button>
            </div>
          ))}
        </section>
      )}

      {savedNote && <p className="muted center">{savedNote}</p>}

      {pack.length > 0 && (
        <section className="stack">
          <p className="eyebrow">Share this pack</p>
          <p className="muted">
            Text stays in the link itself — nothing is sent to a server. A student sends this to
            another school over Messenger; that's the whole distribution model.
          </p>
          {pack.length > MAX_LINK_CLAIMS && (
            <p className="pack-warning">
              {pack.length} claims is more than a link handles reliably — some messaging apps
              truncate long links. Export to a file instead, or share in batches of {MAX_LINK_CLAIMS}.
            </p>
          )}
          <div className="row">
            <button className="btn btn-small" onClick={buildLink}>
              Build share link
            </button>
            <button className="btn btn-small" onClick={exportFile}>
              Export to file
            </button>
            <button className="btn btn-small" onClick={() => fileInputRef.current?.click()}>
              Import from file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importFile(file);
                e.target.value = '';
              }}
            />
          </div>
          {shareUrl && (
            <div className="stack">
              <input className="field mono" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
              <button className="btn btn-primary btn-small" onClick={copyLink}>
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          )}
          {shareError && <p className="pack-error">{shareError}</p>}
          {importError && <p className="pack-error">{importError}</p>}
          <button className="btn btn-primary btn-block" onClick={playPack}>
            Play this pack
          </button>
        </section>
      )}

      <button
        className="btn btn-ghost btn-block"
        onClick={() => dispatch({ type: 'GO_TO', screen: 'lobby' })}
      >
        Back to the lobby
      </button>
    </div>
  );
}

/* -------------------------------------------------------------- ChipInput -- */

function ChipInput({
  label,
  value,
  onChange,
  onAdd,
  items,
  onRemove,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  items: string[];
  onRemove: (index: number) => void;
}) {
  return (
    <div className="stack">
      <label className="field-label">{label}</label>
      <div className="row">
        <input
          className="field"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder="Type a phrase, then Add"
        />
        <button type="button" className="btn btn-small" onClick={onAdd} disabled={!value.trim()}>
          Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="row">
          {items.map((item, i) => (
            <span key={i} className="atom-chip">
              {item}
              <button
                type="button"
                className="pack-chip-remove"
                onClick={() => onRemove(i)}
                aria-label={`Remove "${item}"`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
