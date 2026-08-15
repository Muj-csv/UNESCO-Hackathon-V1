import { useEffect } from 'react';
import type { Hop } from '../types/contracts';
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
  const { round, settings, session } = state;
  const hops = hopsForLedger(state);
  const claim = round.claim;

  const result = claim ? computeLedger(claim, hops, round.verifications, round.overrides) : null;

  /* Recorded through an action, not from inside this render. The prototype
     pushed straight into session.results here and counted the round again on
     every re-render; the reducer now refuses a second record for the round. */
  useEffect(() => {
    if (!claim || !result) return;
    const { deliberate, accidental } = splitByIntent(result, hops);
    dispatch({
      type: 'RECORD_ROUND_RESULT',
      result: {
        claimId: claim.id,
        mode: settings.mode,
        playedAt: Date.now(),
        verdicts: result,
        lostAtoms: lostAtoms(result),
        firstLostAtom: firstLostAtom(result),
        deliberateAtoms: deliberate,
        accidentalAtoms: accidental,
        predictions: round.predictions,
        turingCorrect: null,
        terminalDecision: round.terminalDecision,
        verifyChoice: round.verifyChoice,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim?.id, session.roundNumber]);

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
                    : ` — LOST AT HOP ${(v.deathHop ?? 0) + 1}`}
              </p>

              {!isCrowd && <AtomWire hops={hops} deathHop={v.deathHop} />}

              {v.alive ? (
                <p className="alive-note">{claim.atoms[atom]?.truth}</p>
              ) : isCrowd ? (
                /* Nobody in the room was holding this one, so nobody could
                   supply it. That is the whole lesson of the mode. */
                <p className="alive-note">
                  The room could not put this back. Whoever held the version
                  missing it had no way to know.
                </p>
              ) : (
                /* T2 replaces this line with the four-line diagnostic block:
                   trigger, original phrase, final phrase. The engine already
                   carries deathCardId, originalPhrase and finalPhrase. */
                <p className="alive-note">
                  Died at hop {(v.deathHop ?? 0) + 1} under {cardName(v.deathCardId)}
                  {v.deathPlayer ? ` (${attribution(hops, v.deathHop)})` : ''}.
                </p>
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

      <button className="btn btn-primary btn-block" onClick={() => dispatch({ type: 'ADVANCE' })}>
        Continue
      </button>
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
