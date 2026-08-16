import { useEffect, useMemo, useRef, useState } from 'react';
import type { Atom, Claim } from '../types/contracts';
import { ATOMS } from '../types/contracts';
import { useGameDispatch } from '../state/GameContext';
import Icon from '../components/Icon';
import PhraseTagger from '../components/PhraseTagger';
import { ATOM_ICON, ATOM_SHORT } from '../data/atoms';
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
   OWNER: T10 (pack authoring). Design pass: T11 phase 7.

   This is where the theme stops being a metaphor: young people stop being
   the audience for an MIL tool and become the authors of one.

   Two views, because authoring a claim and holding a pack are different
   jobs and the old single scroll made you do both at once:

     LIBRARY   what is in the pack, and how it leaves this device.
     EDITOR    one claim, built in three moves — baseplate, tags, variants —
               with an integrity check that reads the draft continuously
               instead of waiting for a submit to say no.

   Nothing here is scored and nothing is graded. The check panel counts what
   is still missing; it never rates what has been written.

   Do not use AI to generate claims. The authoring is the learning.
   ========================================================================== */

const ATOM_NOTE: Record<Atom, string> = {
  SOURCE: 'Who says so — a named source, not "experts" or "reports say".',
  NUMBER: 'The figure and what it is measured against — the base, not just the headline number.',
  HEDGE: 'How certain the original really is — "may", "suggests", "preliminary".',
  SCOPE: 'Who, where, and when this applies — not everyone, everywhere, always.',
  CAUSE: 'Correlation versus causation — "linked to", never "causes".',
};

type View = 'library' | 'editor';

export default function PackStudio() {
  const dispatch = useGameDispatch();

  const [view, setView] = useState<View>('library');
  const [draft, setDraft] = useState<ClaimDraft>(emptyClaimDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  /* A draft is "started" once anything is in it. Used to offer a resume tile
     in the library rather than silently holding work nobody can see. */
  const draftStarted =
    !!draft.topic.trim() ||
    !!draft.originalText.trim() ||
    ATOMS.some((a) => draft.atoms[a].phrase.trim() || draft.degraded[a].trim());

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

  /* ------------------------------------------------------------- authoring -- */

  const newClaim = () => {
    setDraft(emptyClaimDraft());
    setEditingId(null);
    setActiveAtom('SOURCE');
    setAttempted(false);
    setSavedNote(null);
    setView('editor');
  };

  const editClaim = (claim: Claim) => {
    setDraft(claimToDraft(claim));
    setEditingId(claim.id);
    setActiveAtom('SOURCE');
    setAttempted(false);
    setSavedNote(null);
    setView('editor');
  };

  const saveClaim = () => {
    setAttempted(true);
    if (validation.errors.length) return;

    if (editingId) {
      const updated = draftToClaim(draft, editingId);
      setPack((p) => p.map((c) => (c.id === editingId ? updated : c)));
      setSavedNote(`Updated "${updated.topic}".`);
    } else {
      const claim = draftToClaim(draft, makeClaimId(draft.topic));
      setPack((p) => [...p, claim]);
      setSavedNote(`Added "${claim.topic}" to this pack.`);
    }

    setDraft(emptyClaimDraft());
    setEditingId(null);
    setActiveAtom('SOURCE');
    setAttempted(false);
    setView('library');
  };

  const removeClaim = (id: string) => {
    setPack((p) => p.filter((c) => c.id !== id));
    if (editingId === id) setEditingId(null);
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
    a.download = 'brick-by-brick-pack.json';
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
        setView('library');
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
      {/* No StageBar: the top bar badges this screen and the hero names it. */}
      <header className="lobby-hero">
        <span className="lobby-chip">Pack Studio</span>
        <h1>{view === 'library' ? 'Your claim pack' : editingId ? 'Edit this claim' : 'Build a claim'}</h1>
        <p className="lede">
          Write the claims your room plays with. Fabricated only — no real people, organisations
          or events. One claim, all five atoms tagged, five variants that each degrade exactly one.
        </p>
      </header>

      <div className="pack-tabs" role="tablist" aria-label="Pack Studio view">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'library'}
          className={`pack-tab${view === 'library' ? ' is-active' : ''}`}
          onClick={() => setView('library')}
        >
          <Icon name="inventory" /> Library
          <span className="neo-tag">{pack.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'editor'}
          className={`pack-tab${view === 'editor' ? ' is-active' : ''}`}
          onClick={() => setView('editor')}
        >
          <Icon name="add" /> Editor
          {draftStarted && <span className="neo-tag">Draft</span>}
        </button>
      </div>

      {savedNote && view === 'library' && (
        <p className="pack-saved">
          <Icon name="checkCircle" /> {savedNote}
        </p>
      )}

      {view === 'library' ? (
        <Library
          pack={pack}
          draft={draft}
          draftStarted={draftStarted}
          editingId={editingId}
          onNew={newClaim}
          onEdit={editClaim}
          onRemove={removeClaim}
          onResume={() => setView('editor')}
          share={{
            shareUrl,
            shareError,
            importError,
            copied,
            buildLink,
            copyLink,
            exportFile,
            openImport: () => fileInputRef.current?.click(),
            playPack,
          }}
        />
      ) : (
        <div className="pack-cols">
          <div className="pack-work stack">
            {/* -------------------------------------------------- baseplate -- */}
            <section className="neo-panel">
              <div className="neo-head">
                <span>
                  <span className="pack-step">01</span> Baseplate
                </span>
                <span className="neo-tag">The true claim</span>
              </div>
              <div className="neo-body stack">
                <p className="muted">
                  The version nobody in the room ever sees whole. Everything the ledger measures
                  later is measured against this.
                </p>

                <div className="stack">
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
                </div>

                <div className="stack">
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
                </div>

                {attempted &&
                  fieldErrors('originalText').map((e, i) => (
                    <p key={i} className="pack-error">
                      {e.message}
                    </p>
                  ))}
                {validation.warnings.map((w, i) => (
                  <p key={i} className="pack-warning">
                    <Icon name="alert" /> {w.message}
                  </p>
                ))}
              </div>
            </section>

            {/* ------------------------------------------------- atom palette -- */}
            <section className="neo-panel">
              <div className="neo-head neo-head-amber">
                <span>
                  <span className="pack-step">02</span> Tag the five
                </span>
                <span className="neo-tag">{taggedCount(draft)}/5 tagged</span>
              </div>
              <div className="neo-body stack">
                <div className="pack-palette" role="group" aria-label="Choose an atom to tag">
                  {ATOMS.map((atom) => {
                    const tagged = !!draft.atoms[atom].phrase.trim();
                    const varied = !!draft.degraded[atom].trim();
                    return (
                      <button
                        key={atom}
                        type="button"
                        className={`pack-swatch${activeAtom === atom ? ' is-active' : ''}`}
                        aria-pressed={activeAtom === atom}
                        onClick={() => setActiveAtom(atom)}
                      >
                        <span className={`pack-swatch-icon atomcard-${atom.toLowerCase()}`}>
                          <Icon name={ATOM_ICON[atom]} size={20} />
                        </span>
                        <span className="pack-swatch-name">{atom}</span>
                        <span className="pack-swatch-state">
                          <span className={`pack-dot${tagged ? ' is-on' : ''}`} title="Phrase tagged" />
                          <span className={`pack-dot${varied ? ' is-on' : ''}`} title="Variant written" />
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="pack-atomnote">
                  <span className={`pack-swatch-icon atomcard-${activeAtom.toLowerCase()}`}>
                    <Icon name={ATOM_ICON[activeAtom]} size={20} />
                  </span>
                  <span>
                    <strong>{activeAtom}</strong> — {ATOM_SHORT[activeAtom]}
                    <span className="pack-atomnote-long">{ATOM_NOTE[activeAtom]}</span>
                  </span>
                </div>

                <PhraseTagger
                  text={draft.originalText}
                  activeAtom={activeAtom}
                  phrases={phrases}
                  onTag={(atom, phrase) => setAtomField(atom, { phrase })}
                />

                <div className="paper pack-tagged">
                  <p className="field-label">Tagged phrase for {activeAtom}</p>
                  <p className="paper-text">{atomDraft.phrase || 'Not tagged yet.'}</p>
                </div>
                {attempted &&
                  fieldErrors(`atoms.${activeAtom}.phrase`).map((e, i) => (
                    <p key={i} className="pack-error">
                      {e.message}
                    </p>
                  ))}

                <div className="stack">
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
                </div>

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
                {attempted &&
                  fieldErrors(`atoms.${activeAtom}.keywords`).map((e, i) => (
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
              </div>
            </section>

            {/* -------------------------------------------------- variants -- */}
            <section className="neo-panel">
              <div className="neo-head">
                <span>
                  <span className="pack-step">03</span> Variants
                </span>
                <span className="neo-tag">{variantCount(draft)}/5 written</span>
              </div>
              <div className="neo-body stack">
                <p className="muted">
                  One variant per atom. Rewrite the claim so {ATOM_LABEL[activeAtom]} is the one
                  thing that degrades — keep the other four intact.
                </p>

                <div className="pack-variant-strip">
                  {ATOMS.map((atom) => (
                    <button
                      key={atom}
                      type="button"
                      className={`pack-variant-tab${activeAtom === atom ? ' is-active' : ''}${
                        draft.degraded[atom].trim() ? ' is-written' : ''
                      }`}
                      aria-pressed={activeAtom === atom}
                      onClick={() => setActiveAtom(atom)}
                    >
                      {draft.degraded[atom].trim() ? <Icon name="check" /> : null}
                      {atom}
                    </button>
                  ))}
                </div>

                <div className="paper pack-baseline">
                  <p className="field-label">Original, for reference</p>
                  <p className="paper-text">
                    {draft.originalText.trim() || 'Write the baseplate first.'}
                  </p>
                </div>

                <div className="stack">
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
                </div>
                {attempted &&
                  fieldErrors(`degraded.${activeAtom}`).map((e, i) => (
                    <p key={i} className="pack-error">
                      {e.message}
                    </p>
                  ))}
              </div>
            </section>
          </div>

          {/* --------------------------------------------- integrity check -- */}
          <IntegrityCheck
            draft={draft}
            errors={validation.errors}
            warnings={validation.warnings}
            attempted={attempted}
            editing={!!editingId}
            activeAtom={activeAtom}
            onPick={setActiveAtom}
            onSave={saveClaim}
            onBack={() => setView('library')}
          />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="visually-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importFile(file);
          e.target.value = '';
        }}
      />

      <button
        className="btn btn-ghost btn-block"
        onClick={() => dispatch({ type: 'GO_TO', screen: 'lobby' })}
      >
        <Icon name="arrowBack" /> Back to the lobby
      </button>
    </div>
  );
}

/* ============================================================================
   LIBRARY
   ========================================================================== */

interface ShareProps {
  shareUrl: string | null;
  shareError: string | null;
  importError: string | null;
  copied: boolean;
  buildLink: () => void;
  copyLink: () => void;
  exportFile: () => void;
  openImport: () => void;
  playPack: () => void;
}

function Library({
  pack,
  draft,
  draftStarted,
  editingId,
  onNew,
  onEdit,
  onRemove,
  onResume,
  share,
}: {
  pack: Claim[];
  draft: ClaimDraft;
  draftStarted: boolean;
  editingId: string | null;
  onNew: () => void;
  onEdit: (claim: Claim) => void;
  onRemove: (id: string) => void;
  onResume: () => void;
  share: ShareProps;
}) {
  return (
    <div className="stack">
      <section className="neo-panel">
        <div className="neo-head neo-head-amber">
          Pack library
          <span className="neo-tag">
            {pack.length} claim{pack.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="neo-body stack">
          {pack.length === 0 && (
            <p className="lobby-empty">
              Nothing in this pack yet. A pack of one claim is a perfectly good pack.
            </p>
          )}

          <div className="pack-grid">
            {pack.map((claim) => (
              <article key={claim.id} className="pack-tile">
                <header className="pack-tile-head">
                  <h3 className="pack-tile-topic">{claim.topic}</h3>
                  <span className="neo-tag">5 atoms</span>
                </header>
                <p className="paper-text pack-tile-text">{claim.originalText}</p>
                <div className="pack-tile-atoms" aria-hidden="true">
                  {ATOMS.map((atom) => (
                    <span key={atom} className={`pack-tile-atom atomcard-${atom.toLowerCase()}`}>
                      <Icon name={ATOM_ICON[atom]} size={14} />
                    </span>
                  ))}
                </div>
                <div className="row pack-tile-actions">
                  <button className="btn btn-small" onClick={() => onEdit(claim)}>
                    <Icon name="settings" /> Edit
                  </button>
                  <button
                    className="btn btn-small btn-ghost"
                    onClick={() => onRemove(claim.id)}
                    aria-label={`Remove ${claim.topic}`}
                  >
                    <Icon name="close" /> Remove
                  </button>
                </div>
              </article>
            ))}

            {/* Work in progress is a tile too, so a half-built claim is never
                invisible state the author has to remember they left behind. */}
            {draftStarted && !editingId && (
              <article className="pack-tile pack-tile-draft">
                <header className="pack-tile-head">
                  <h3 className="pack-tile-topic">{draft.topic.trim() || 'Untitled claim'}</h3>
                  <span className="neo-tag">Draft</span>
                </header>
                <p className="paper-text pack-tile-text">
                  {draft.originalText.trim() || 'No text yet.'}
                </p>
                <p className="muted">
                  {taggedCount(draft)}/5 tagged · {variantCount(draft)}/5 variants
                </p>
                <div className="row pack-tile-actions">
                  <button className="btn btn-small btn-primary" onClick={onResume}>
                    Resume <Icon name="arrowForward" />
                  </button>
                </div>
              </article>
            )}

            <button type="button" className="pack-tile pack-tile-new" onClick={onNew}>
              <span className="pack-tile-plus">
                <Icon name="add" size={28} />
              </span>
              <span className="pack-tile-topic">New claim</span>
              <span className="muted">Baseplate, five tags, five variants.</span>
            </button>
          </div>
        </div>
      </section>

      <section className="neo-panel">
        <div className="neo-head neo-head-plain">
          Share this pack
          <span className="neo-tag">No server</span>
        </div>
        <div className="neo-body stack">
          <p className="muted">
            Text stays in the link itself — nothing is sent to a server. A student sends this to
            another school over Messenger; that's the whole distribution model.
          </p>

          {pack.length > MAX_LINK_CLAIMS && (
            <p className="pack-warning">
              <Icon name="alert" /> {pack.length} claims is more than a link handles reliably — some
              messaging apps truncate long links. Export to a file instead, or share in batches of{' '}
              {MAX_LINK_CLAIMS}.
            </p>
          )}

          <div className="row pack-share-actions">
            <button className="btn btn-small" onClick={share.buildLink} disabled={!pack.length}>
              <Icon name="link" /> Build share link
            </button>
            <button className="btn btn-small" onClick={share.exportFile} disabled={!pack.length}>
              <Icon name="download" /> Export to file
            </button>
            <button className="btn btn-small" onClick={share.openImport}>
              <Icon name="upload" /> Import from file
            </button>
          </div>

          {share.shareUrl && (
            <div className="stack">
              <input
                className="field mono"
                readOnly
                value={share.shareUrl}
                aria-label="Share link"
                onFocus={(e) => e.target.select()}
              />
              <button className="btn btn-primary btn-small" onClick={share.copyLink}>
                {share.copied ? (
                  <>
                    <Icon name="check" /> Copied
                  </>
                ) : (
                  'Copy link'
                )}
              </button>
            </div>
          )}
          {share.shareError && <p className="pack-error">{share.shareError}</p>}
          {share.importError && <p className="pack-error">{share.importError}</p>}

          <button
            className="btn btn-primary btn-lg btn-block"
            onClick={share.playPack}
            disabled={!pack.length}
          >
            {pack.length ? 'Play this pack' : 'Write a claim to play this pack'}
            {pack.length ? <Icon name="arrowForward" /> : null}
          </button>
        </div>
      </section>
    </div>
  );
}

/* ============================================================================
   INTEGRITY CHECK

   Reads the draft continuously. It counts what is missing and never rates
   what is there — there is no score in this game, including here.
   ========================================================================== */

function IntegrityCheck({
  draft,
  errors,
  warnings,
  attempted,
  editing,
  activeAtom,
  onPick,
  onSave,
  onBack,
}: {
  draft: ClaimDraft;
  errors: { field: string; message: string }[];
  warnings: { field: string; message: string }[];
  attempted: boolean;
  editing: boolean;
  activeAtom: Atom;
  onPick: (atom: Atom) => void;
  onSave: () => void;
  onBack: () => void;
}) {
  const clean = errors.length === 0;
  const started =
    !!draft.originalText.trim() || ATOMS.some((a) => draft.atoms[a].phrase.trim());

  const headClass = clean && started ? 'neo-head-teal' : attempted ? 'neo-head-red' : 'neo-head-plain';

  return (
    <aside className="pack-check">
      <section className="neo-panel pack-check-panel">
        <div className={`neo-head ${headClass}`}>
          Integrity check
          <span className="neo-tag">{clean && started ? 'Ready' : `${errors.length} open`}</span>
        </div>
        <div className="neo-body stack">
          <ul className="pack-check-rows">
            {ATOMS.map((atom) => {
              const tagged = !!draft.atoms[atom].phrase.trim();
              const varied = !!draft.degraded[atom].trim();
              const issues = errors.filter((e) => e.field.includes(`.${atom}`)).length;
              return (
                <li key={atom}>
                  <button
                    type="button"
                    className={`pack-check-row${activeAtom === atom ? ' is-active' : ''}`}
                    onClick={() => onPick(atom)}
                  >
                    <span className={`pack-swatch-icon atomcard-${atom.toLowerCase()}`}>
                      <Icon name={ATOM_ICON[atom]} size={16} />
                    </span>
                    <span className="pack-check-name">{atom}</span>
                    <span className="pack-check-marks">
                      <span className={`pack-mark${tagged ? ' is-on' : ''}`}>TAG</span>
                      <span className={`pack-mark${varied ? ' is-on' : ''}`}>VAR</span>
                    </span>
                    {issues > 0 && <span className="pack-check-count">{issues}</span>}
                  </button>
                </li>
              );
            })}
          </ul>

          {errors.length > 0 ? (
            <div className="stack pack-check-list">
              <p className="eyebrow">
                {errors.length} thing{errors.length === 1 ? '' : 's'} still open
              </p>
              {errors.slice(0, 6).map((e, i) => (
                <p key={i} className="pack-check-issue">
                  {e.message}
                </p>
              ))}
              {errors.length > 6 && (
                <p className="muted">…and {errors.length - 6} more as you go.</p>
              )}
            </div>
          ) : (
            <p className="pack-check-ok">
              <Icon name="checkCircle" /> {started
                ? 'All five tagged, all five variants written.'
                : 'Nothing to check yet — start with the baseplate.'}
            </p>
          )}

          {/* Entity warnings are NOT repeated here. They live under the text
              that raised them, which is where they get fixed. */}
          {warnings.length > 0 && (
            <p className="muted">
              {warnings.length} name{warnings.length === 1 ? '' : 's'} to double-check in the
              baseplate — never blocking.
            </p>
          )}

          <button className="btn btn-primary btn-block" onClick={onSave}>
            {editing ? 'Save changes' : 'Add to pack'}
          </button>
          <button className="btn btn-ghost btn-block btn-small" onClick={onBack}>
            Back to library
          </button>
        </div>
      </section>
    </aside>
  );
}

/* ============================================================================
   HELPERS
   ========================================================================== */

function taggedCount(draft: ClaimDraft): number {
  return ATOMS.filter((a) => draft.atoms[a].phrase.trim()).length;
}

function variantCount(draft: ClaimDraft): number {
  return ATOMS.filter((a) => draft.degraded[a].trim()).length;
}

/**
 * A saved claim, reopened for editing. The inverse of `draftToClaim`: the
 * tagged phrase is stored first in `keywords`, so the rest are the author's
 * alternatives and go back into the alternatives list.
 */
function claimToDraft(claim: Claim): ClaimDraft {
  const base = emptyClaimDraft();
  for (const atom of ATOMS) {
    const a = claim.atoms[atom];
    if (!a) continue;
    base.atoms[atom] = {
      truth: a.truth ?? '',
      phrase: a.phrase ?? '',
      keywords: (a.keywords ?? []).filter((k) => k !== a.phrase),
      overreach: [...(a.overreach ?? [])],
    };
    base.degraded[atom] = claim.degraded?.[atom] ?? '';
  }
  return { ...base, topic: claim.topic, originalText: claim.originalText };
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
          <Icon name="add" /> Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="row pack-chips">
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
