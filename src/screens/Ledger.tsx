import type { Atom, AtomOverride, AtomVerdict, Hop, LedgerResult } from '../types/contracts';
import { ATOMS } from '../types/contracts';
import { useGame } from '../state/GameContext';
import { hopsForLedger } from '../state/gameReducer';
import { computeLedger, firstLostAtom, lostAtoms, splitByIntent } from '../engine/ledger';
import { cardName } from '../data/cards';
import { ATOM_ICON } from '../data/atoms';
import Icon from '../components/Icon';
import StageBar from '../components/StageBar';
import VerifyFeedback from '../components/VerifyFeedback';

/* ============================================================================
   The Decay Ledger.

   The signature screen. T2 owns the death rows, T4 owns <VerifyFeedback/>.

   There is no score on this screen and there never will be. The strip at the
   top counts atoms because counting atoms is what a ledger DOES — five rows,
   each alive or not. It is a legend for the rows underneath, not a rating of
   the room, and it must never acquire a percentage, a grade or a comparison
   with another round.
   ========================================================================== */

const NUMBER_WORDS: Record<number, string> = { 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four' };

/**
 * How many rows may ask the room a question at the same time.
 *
 * The engine can be unsure about all five at once — CROWD RECALL is the case
 * that does it, because a group's reconstruction is short enough against the
 * original that nearly every atom comes back a weak signal. Five questions in
 * a column is a form, and this screen is the payoff, so the room is asked two
 * at a time and the next surfaces as each one is settled.
 */
const ASK_AT_ONCE = 2;

export default function Ledger() {
  const { state, dispatch } = useGame();
  const { round, settings } = state;
  const hops = hopsForLedger(state);
  const claim = round.claim;

  const result = claim ? computeLedger(claim, hops, round.verifications, round.overrides) : null;

  /* What the engine read before the room touched it. The same pure call, minus
     the overrides, so a row the room called gone can be told apart from one the
     engine located a death for. Without it an override backfills the last hop
     and the death row names a player who was never found to have broken it. */
  const proposed = claim ? computeLedger(claim, hops, round.verifications) : null;

  /* Recorded through an action, not from inside a render. It happens on the
     way out rather than on the way in, because the room can still overturn a
     row while this screen is open (part C) and the session readout has to
     agree with the ledger the room actually settled on. */
  const recordAndContinue = () => {
    const { deliberate, accidental } = splitByIntent(result!, hops);
    dispatch({
      type: 'RECORD_ROUND_RESULT',
      result: {
        claimId: claim!.id,
        mode: settings.mode,
        playedAt: Date.now(),
        verdicts: result!,
        lostAtoms: lostAtoms(result!),
        firstLostAtom: firstLostAtom(result!),
        deliberateAtoms: deliberate,
        accidentalAtoms: accidental,
        predictions: round.predictions,
        turingCorrect: null,
        terminalDecision: round.terminalDecision,
        verifyChoice: round.verifyChoice,
      },
    });
    dispatch({ type: 'ADVANCE' });
  };

  if (!claim || !result) return null;

  const lost = lostAtoms(result);
  const isCrowd = settings.mode === 'crowd';

  /* The queue of rows still waiting on the room. Settling one lets the next in.
     A row the room has already decided keeps its buttons whatever else is
     waiting, so a call can always be taken back. */
  const waitingOnTheRoom = ATOMS.filter(
    (atom) => proposed?.[atom].confidence === 'uncertain' && !round.overrides[atom],
  ).slice(0, ASK_AT_ONCE);

  return (
    <div className="screen">
      <StageBar label="Decay ledger" note={`${5 - lost.length} of 5 intact`} />

      <section className="neo-panel">
        <div className="neo-head neo-head-plain">
          {isCrowd ? 'What the room could not recover' : 'What it cost'}
          <span className="neo-tag">No score</span>
        </div>
        <div className="neo-body stack">
          <p className="lede">
            {lost.length === 0 &&
              (isCrowd
                ? 'Between you, the room put all five back.'
                : 'Every property made it through this time.')}
            {lost.length === 5 &&
              (isCrowd
                ? 'None of the five came back.'
                : 'None of the five properties survived the retelling.')}
            {lost.length > 0 &&
              lost.length < 5 &&
              `${NUMBER_WORDS[lost.length]} of the five ${
                isCrowd ? 'did not come back.' : 'properties did not survive the retelling.'
              }`}
          </p>

          {/* A legend for the rows below — five cells, one per property.
              Never a percentage, never a grade. */}
          <ul className="atomstrip">
            {ATOMS.map((atom) => (
              <li
                key={atom}
                className={`atomstrip-cell${result[atom].alive ? ' is-alive' : ' is-lost'}`}
              >
                <Icon name={ATOM_ICON[atom]} />
                <span className="atomstrip-name">{atom}</span>
                <span className="atomstrip-state">
                  {result[atom].alive ? 'Held' : isCrowd ? 'Gone' : `Hop ${(result[atom].deathHop ?? 0) + 1}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ledger">
        {ATOMS.map((atom) => {
          const v = result[atom];

          /* A loss the room called rather than the engine located. There is no
             hop to point at, so nothing points at one — the wire stays whole
             and the row says who decided. */
          const roomOnly = !v.alive && proposed?.[atom].deathHop === null;

          /* Rows the engine is sure about are never asked about. Of the rest,
             the ones already decided stay open to a change of mind, and the
             undecided ones come up a couple at a time. */
          const engineUnsure = proposed?.[atom].confidence === 'uncertain';
          const asksTheRoom =
            engineUnsure && (Boolean(round.overrides[atom]) || waitingOnTheRoom.includes(atom));

          return (
            <div className={`ledger-row${v.alive ? ' is-alive' : ' is-lost'}`} key={atom}>
              <div className="ledger-rowhead">
                <span className="ledger-rowicon">
                  <Icon name={ATOM_ICON[atom]} size={20} />
                </span>
                <span className="ledger-atom">{atom}</span>
                <span className={`ledger-head${v.alive ? ' is-alive' : ''}`}>
                  {v.alive
                    ? v.recovered
                      ? 'Survived, after a check'
                      : 'Survived'
                    : isCrowd
                      ? 'Not recovered'
                      : roomOnly
                        ? 'Lost'
                        : `Lost at hop ${(v.deathHop ?? 0) + 1}`}
                </span>
              </div>

              {!isCrowd && <AtomWire hops={hops} deathHop={roomOnly ? null : v.deathHop} />}

              {v.alive ? (
                <>
                  <p className="alive-note">{claim.atoms[atom]?.truth}</p>
                  {v.confidence === 'override' && (
                    <p className="ledger-diag-room">The room called this one still there.</p>
                  )}
                </>
              ) : isCrowd ? (
                /* Nobody in the room was holding this one, so nobody could
                   supply it. That is the whole lesson of the mode. */
                <p className="alive-note">
                  The room could not put this back. Whoever held the version missing it had no way
                  to know.
                </p>
              ) : (
                <DeathRow verdict={v} hops={hops} roomOnly={roomOnly} />
              )}

              {asksTheRoom && (
                <AdjudicateRow
                  atom={atom}
                  picked={round.overrides[atom] ?? null}
                  onDecide={(override) => dispatch({ type: 'SET_LEDGER_OVERRIDE', atom, override })}
                />
              )}
            </div>
          );
        })}
      </section>

      {/* T8. This is the number BAD FAITH exists to produce: the room has just
          spent an argument hunting one person, and this is where it learns
          that person did less damage than the people trying to help. */}
      {settings.mode === 'badfaith' && round.imposter && (
        <IntentSplit result={result} hops={hops} targetAtom={round.imposter.targetAtom} />
      )}

      {/* CROWD RECALL has no final reader, so there is no decision to revisit. */}
      {!isCrowd && (
        <section className="neo-panel">
          <div className="neo-head neo-head-plain">What you did with it</div>
          <div className="neo-body stack">
            <p className="muted">
              {round.terminalDecision === 'share' && 'You passed it on as it stood.'}
              {round.terminalDecision === 'flag' && 'You flagged it.'}
              {round.terminalDecision === 'verify' && 'You wanted to check it first.'}
              {!round.terminalDecision && 'The chain ended without a decision.'}
            </p>
            <VerifyFeedback />
          </div>
        </section>
      )}

      <button className="btn btn-primary btn-lg btn-block" onClick={recordAndContinue}>
        Continue <Icon name="arrowForward" />
      </button>
    </div>
  );
}

/* ============================================================================
   What was lost, where, and what pressure caused it.

   Telephone shows that a message changed. This says what the change cost, and
   it needs no diff algorithm to do it: the engine already knows the card, the
   authored phrase and the phrase that replaced it.

   The card is the subject of the sentence and the person never is. Nobody in
   the chain was trying to mislead anyone, and the copy has to keep saying so.
   ========================================================================== */
function DeathRow({
  verdict,
  hops,
  roomOnly,
}: {
  verdict: AtomVerdict;
  hops: Hop[];
  roomOnly: boolean;
}) {
  const who = attribution(hops, verdict.deathHop);

  return (
    <>
      {roomOnly && <p className="ledger-diag-room">The room called this one gone.</p>}

      <dl className="ledger-diag">
        {/* No trigger when the room made the call — there is no hop that did
            it, and naming one would blame a player for the room's reading. */}
        {!roomOnly && (
          <>
            <dt className="ledger-diag-label">Trigger</dt>
            <dd className="ledger-diag-value ledger-diag-trigger">
              {cardName(verdict.deathCardId)}
              {who && <span className="ledger-diag-who"> ({who})</span>}
            </dd>
          </>
        )}

        {verdict.originalPhrase && (
          <>
            <dt className="ledger-diag-label">Original</dt>
            <dd className="ledger-diag-value ledger-diag-original">“{verdict.originalPhrase}”</dd>
          </>
        )}

        {!roomOnly && (
          <>
            <dt className="ledger-diag-label">Final</dt>
            {verdict.finalPhrase ? (
              <dd className="ledger-diag-value ledger-diag-final">“{verdict.finalPhrase}”</dd>
            ) : (
              /* Nothing took its place — it stopped being in the text at all. */
              <dd className="ledger-diag-value ledger-diag-dropped">dropped</dd>
            )}
          </>
        )}
      </dl>
    </>
  );
}

/* ============================================================================
   The engine proposes, the room decides.

   Only rows the engine could not read are asked about — a keyword match is
   evidence, and overruling it on every row would turn the payoff screen into
   a form. Neither answer is marked right. There is no score on this screen.
   ========================================================================== */
function AdjudicateRow({
  atom,
  picked,
  onDecide,
}: {
  atom: Atom;
  picked: AtomOverride | null;
  onDecide: (override: AtomOverride) => void;
}) {
  return (
    <div className="ledger-diag-ask">
      <p className="ledger-diag-ask-note">
        <Icon name="help" /> The words alone don't settle this one. Did {atom} make it through?
      </p>
      <div className="ledger-diag-choices">
        <button
          type="button"
          className={`ledger-diag-choice${picked === 'alive' ? ' is-alive' : ''}`}
          aria-pressed={picked === 'alive'}
          onClick={() => onDecide('alive')}
        >
          Still there
        </button>
        <button
          type="button"
          className={`ledger-diag-choice${picked === 'lost' ? ' is-lost' : ''}`}
          aria-pressed={picked === 'lost'}
          onClick={() => onDecide('lost')}
        >
          Gone
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   T8 — on purpose, and by accident.

   One person was told to make a property disappear. Nobody told anybody else
   to do anything, and the chain lost more anyway. That comparison is the
   whole reason the mode exists.

   No score, and no blame. The two counts are set at the same size on purpose:
   the difference between them is the finding, and weighting one would put a
   thumb on it.
   ========================================================================== */
function IntentSplit({
  result,
  hops,
  targetAtom,
}: {
  result: LedgerResult;
  hops: Hop[];
  targetAtom: Atom;
}) {
  const { deliberate, accidental } = splitByIntent(result, hops);

  const list = (atoms: Atom[]) =>
    atoms.map((atom) => `${atom} (hop ${(result[atom].deathHop ?? 0) + 1})`).join(' · ');

  return (
    <section className="neo-panel">
      <div className="neo-head neo-head-red">
        On purpose, and by accident
        <span className="neo-tag">Bad Faith</span>
      </div>
      <div className="neo-body stack">
        <div className="intent-split">
          <div className="intent-cell">
            <span className="intent-cell-label">Deliberate</span>
            <span className={`intent-cell-count${deliberate.length ? '' : ' is-none'}`}>
              {deliberate.length}
            </span>
            <span className="intent-cell-atoms">
              {deliberate.length ? list(deliberate) : 'nothing'}
            </span>
          </div>
          <div className="intent-cell">
            <span className="intent-cell-label">Accidental</span>
            <span className={`intent-cell-count${accidental.length ? '' : ' is-none'}`}>
              {accidental.length}
            </span>
            <span className="intent-cell-atoms">
              {accidental.length ? list(accidental) : 'nothing'}
            </span>
          </div>
        </div>

        <p className="muted">
          {accidental.length > deliberate.length
            ? `One person was asked to make ${targetAtom} disappear. Nobody asked anyone else for anything, and the chain lost ${accidental.length} more ${accidental.length === 1 ? 'property' : 'properties'} anyway.`
            : deliberate.length
              ? `One person was asked to make ${targetAtom} disappear, and the rest of the chain held on to what it was given. That is rarer than it looks.`
              : `One person was asked to make ${targetAtom} disappear and did not manage it. Everything lost here was lost by somebody trying to help.`}
        </p>
      </div>
    </section>
  );
}

/** The chain for one atom, sparking where it stopped being true. */
function AtomWire({ hops, deathHop }: { hops: Hop[]; deathHop: number | null }) {
  if (!hops.length) return null;
  return (
    <div className="wire">
      {hops.map((hop, i) => {
        const dead = deathHop !== null && i >= deathHop;
        const spark = deathHop === i;
        return (
          <span key={i} style={{ display: 'contents' }}>
            {i > 0 && (
              <span
                className={`wire-link${deathHop !== null && i > deathHop ? ' is-broken' : ' is-done'}`}
              />
            )}
            <span
              className={`wire-node${
                spark
                  ? ' is-spark'
                  : dead
                    ? ''
                    : /* BBB-004, APPROVED. A live node says somebody carried this
                         atom past their hop. Nobody carried a forfeit — the clock
                         did, and the text went on untouched. The wire stays whole
                         because the atom did survive; the node goes hollow because
                         surviving is not the same act as being kept. */
                      hop.forfeited
                      ? ' is-forfeit'
                      : hop.isAI
                        ? ' is-ai'
                        : ' is-done'
              }`}
            />
          </span>
        );
      })}
    </div>
  );
}

/* Name the pressure, not the person. The player sits in parentheses, and a
   machine hop is never given someone's name. */
function attribution(hops: Hop[], deathHop: number | null): string {
  if (deathHop === null) return '';
  const hop = hops[deathHop];
  if (!hop) return '';
  return hop.isAI ? 'AI participant' : `${hop.player}'s turn`;
}
