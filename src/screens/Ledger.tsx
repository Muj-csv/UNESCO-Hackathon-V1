import type { Atom, AtomOverride, AtomVerdict, Hop } from '../types/contracts';
import { ATOMS } from '../types/contracts';
import { useGame } from '../state/GameContext';
import { hopsForLedger } from '../state/gameReducer';
import { computeLedger, firstLostAtom, lostAtoms, splitByIntent } from '../engine/ledger';
import { cardName } from '../data/cards';
import StageBar from '../components/StageBar';
import VerifyFeedback from '../components/VerifyFeedback';

/* ============================================================================
   The Decay Ledger.

   SHARED FILE — T2 owns the death rows, T4 owns <VerifyFeedback/>.
   T4 must not open this file; the component is already composed below.

   There is no score on this screen and there never will be. The ledger
   measures what happened to the claim, never who is best.
   ========================================================================== */

const NUMBER_WORDS: Record<number, string> = { 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four' };

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

  /* Recorded through an action, not from inside a render. The prototype pushed
     straight into session.results while rendering and counted the round again
     on every re-render; the reducer now refuses a second record for the round.

     It happens on the way out rather than on the way in, because the room can
     still overturn a row while this screen is open (part C) and the session
     readout has to agree with the ledger the room actually settled on. */
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

  return (
    <div className="screen">
      <StageBar label="Decay ledger" />
      <h2>{isCrowd ? 'What the room could not recover' : 'What it cost'}</h2>
      <p className="muted">
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

      <div className="ledger">
        {ATOMS.map((atom) => {
          const v = result[atom];

          /* A loss the room called rather than the engine located. There is no
             hop to point at, so nothing points at one — the wire stays whole
             and the row says who decided. */
          const roomOnly = !v.alive && proposed?.[atom].deathHop === null;

          /* Read off the engine's own reading, not the settled one — so a row
             the room has already decided keeps its buttons and can be decided
             again. Rows the engine is sure about are never asked about, or the
             payoff screen turns into a form. */
          const engineUnsure = proposed?.[atom].confidence === 'uncertain';

          return (
            <div className="ledger-row" key={atom}>
              <p className={`ledger-head${v.alive ? ' is-alive' : ''}`}>
                {atom}
                {v.alive
                  ? v.recovered
                    ? ' — SURVIVED, AFTER A CHECK'
                    : ' — SURVIVED'
                  : isCrowd
                    ? ' — NOT RECOVERED'
                    : roomOnly
                      ? ' — LOST'
                      : ` — LOST AT HOP ${(v.deathHop ?? 0) + 1}`}
              </p>

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
                  The room could not put this back. Whoever held the version
                  missing it had no way to know.
                </p>
              ) : (
                <DeathRow verdict={v} hops={hops} roomOnly={roomOnly} />
              )}

              {engineUnsure && (
                <AdjudicateRow
                  atom={atom}
                  picked={round.overrides[atom] ?? null}
                  onDecide={(override) =>
                    dispatch({ type: 'SET_LEDGER_OVERRIDE', atom, override })
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      {/* CROWD RECALL has no final reader, so there is no decision to revisit. */}
      {!isCrowd && (
        <div className="card">
          <p className="eyebrow">What you did with it</p>
          <p className="muted">
            {round.terminalDecision === 'share' && 'You passed it on as it stood.'}
            {round.terminalDecision === 'flag' && 'You flagged it.'}
            {round.terminalDecision === 'verify' && 'You wanted to check it first.'}
            {!round.terminalDecision && 'The chain ended without a decision.'}
          </p>
          <VerifyFeedback />
        </div>
      )}

      <button className="btn btn-primary btn-block" onClick={recordAndContinue}>
        Continue
      </button>
    </div>
  );
}

/* ============================================================================
   What was lost, where, and what pressure caused it.

   Telephone shows that a message changed. This says what the change cost, and
   it needs no diff algorithm to do it: the engine already knows the card, the
   authored phrase and the phrase that replaced it, and used to throw the last
   one away.

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
              /* Nothing took its place — it stopped being in the text at all.
                 Saying so in words beats an empty cell. */
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
   a form. Where the text alone does not settle it, the engine has no business
   asserting a loss it cannot see.

   Neither answer is marked right. There is no score on this screen.
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
        The words alone don't settle this one. Did {atom} make it through?
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
                className={`wire-link${
                  deathHop !== null && i > deathHop ? ' is-broken' : ' is-done'
                }`}
              />
            )}
            <span
              className={`wire-node${
                spark ? ' is-spark' : dead ? '' : hop.isAI ? ' is-ai' : ' is-done'
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
