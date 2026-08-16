import { useEffect, useRef, useState } from 'react';
import { ATOMS } from '../types/contracts';
import { useGame } from '../state/GameContext';
import { hopPlayerId, hopPlayerName, textInFrontOfPlayer } from '../state/gameReducer';
import { getCard } from '../data/cards';
import Icon from '../components/Icon';
import AIHopBeat from '../components/AIHopBeat';
import HopInput, { hopInputValid } from '../components/HopInput';

/* ============================================================================
   The hop.

   SHARED FILE — DO NOT EDIT.
   This composes <AIHopBeat/> (T6) and <HopInput/> (T1). Whatever you need to
   change about how a player writes their version belongs in HopInput; whatever
   you need to change about the machine's turn belongs in AIHopBeat.

   T1 also owns the timer's five-second warning and applying card.timerOverride
   — both live in this file's timer, so raise it rather than editing here.

   T6 CHANGE, AGREED BEFORE MAKING IT: the handoff gate below is skipped when
   the current hop belongs to the machine. It could not live in AIHopBeat,
   because this file returns the handoff before AIHopBeat is ever mounted — so
   the room was told to pass the device to a player, tapped to confirm, and
   then watched the machine take that player's turn.

   Skipping the gate also leaves `handedOver` false for a machine hop, which
   is what keeps the timer from starting and auto-submitting underneath it.

   T7 CHANGE, APPROVED BEFORE MAKING IT: in a room, every device polls the
   same state, so without a check every device showed the same "Pass the
   device to <player>" screen — any of them could tap "I'm <player>" and
   write that player's hop. The gate now also asks "is this device that
   player's?" (`isMyTurn`, below) and renders a passive waiting view instead
   of the button when it isn't. Pass-and-play has no room id to check
   against, so `isMyTurn` is always true there — unchanged from before.
   ========================================================================== */

export default function Round() {
  const { state, dispatch } = useGame();
  const { round, settings } = state;
  const index = round.currentHop;

  const isMachineHop = round.aiHopIndexes.includes(index);
  const player = hopPlayerName(state, index);
  const card = getCard(round.dealtCards[index] ?? null);
  const source = textInFrontOfPlayer(state);
  /* T7: which device this hop actually belongs to. No room means pass-and-play
     — one shared device, so it's always "this one". */
  const isMyTurn = !state.room.code || hopPlayerId(state, index) === state.room.playerId;

  /* Component state, not reducer state. The prototype kept _draft, _passHidden
     and _cardShownFor in the store because it rebuilt the DOM every render. */
  const [handedOver, setHandedOver] = useState(false);
  const [draft, setDraft] = useState('');
  const [checked, setChecked] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(card?.timerOverride ?? settings.timerSeconds);
  const submitted = useRef(false);

  /* New hop, new everything. T1: the secs card names a 25-second pressure and
     the prototype never actually changed the clock — timerOverride does. */
  useEffect(() => {
    setHandedOver(false);
    setDraft('');
    setChecked(false);
    setSecondsLeft(card?.timerOverride ?? settings.timerSeconds);
    submitted.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, settings.timerSeconds, card?.timerOverride]);

  useEffect(() => {
    if (!handedOver) return;
    const id = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [handedOver]);

  const submit = (text: string, forfeited = false) => {
    if (submitted.current) return;
    submitted.current = true;
    dispatch({ type: 'SUBMIT_HOP', text, forfeited });
  };

  /* Time up. Whatever is in the box goes; if nothing is, the version passes on
     unchanged. Running out is a rule of the game, not a failure state.

     BBB-004, APPROVED: it is still not the same fact as choosing to pass it on,
     so the hop is stamped `forfeited` and the reveal and the ledger say so.
     The distinction only holds if it is drawn honestly — a player who wrote a
     real version and was beaten to the button by the clock did author it. The
     test is therefore "did anything of theirs survive into the text", not "was
     the box empty": the word-tap editor hands back the whole source until the
     first word is cut, so an untouched redaction is an empty box by any other
     name. */
  useEffect(() => {
    if (!handedOver || secondsLeft > 0) return;
    const text = draft.trim() || source;
    submit(text, text === source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handedOver, secondsLeft]);

  if (!round.claim) return null;

  if (!handedOver && !isMachineHop) {
    if (!isMyTurn) {
      return (
        <div className="screen">
          <div className="handoff">
            <span className="handoff-mark" aria-hidden="true">
              <Icon name="timer" size={28} />
            </span>
            <p className="eyebrow">Waiting on</p>
            <h1>{player}</h1>
            <p className="muted">This isn't your device's turn — sit tight.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="screen">
        <div className="handoff">
          <span className="handoff-mark" aria-hidden="true">
            <Icon name="send" size={28} />
          </span>
          <p className="eyebrow">Pass the device to</p>
          <h1>{player}</h1>
          <p className="muted">Only {player} should read the next screen.</p>
          <button className="btn btn-primary btn-lg btn-block" onClick={() => setHandedOver(true)}>
            I'm {player}
          </button>
        </div>
      </div>
    );
  }

  const valid = hopInputValid(card, draft);
  const timeShort = secondsLeft <= 5;
  const timerTotal = card?.timerOverride ?? settings.timerSeconds;

  return (
    <div className="screen">
      <AIHopBeat />

      <section className="neo-panel round-panel">
        <div className="neo-head">
          <span className="round-who">
            <Icon name="play" className="icon-lg" />
            {isMachineHop ? 'AI participant' : `${player}'s turn`}
          </span>
          <span className="neo-tag">
            Hop {index + 1} / {settings.chainLength}
          </span>
        </div>

        <div className="neo-body stack">
          <div className="row round-clock">
            <Icon name="timer" className={timeShort ? 'round-clock-icon is-warning' : 'round-clock-icon'} />
            <span className={`timer${timeShort ? ' is-warning' : ''}`}>
              {Math.max(0, secondsLeft)}s
            </span>
            <span className="spacer" />
            <span className="muted">Stay as accurate as you can.</span>
          </div>
          <div className="timer-track">
            <div
              className={`timer-fill${timeShort ? ' is-warning' : ''}`}
              style={{
                width: `${Math.max(0, Math.min(100, (secondsLeft / timerTotal) * 100))}%`,
              }}
            />
          </div>

          {card && (
            <div className="constraint">
              <span className="eyebrow">Active constraint</span>
              <span className="constraint-name">{card.name}</span>
              <span className="constraint-note">{card.note}</span>
            </div>
          )}

          {/* BBB-011: green marks the true original, and only hop 1 is looking
              at one. Every later hop is reading somebody's retelling, which may
              already have lost something — so it gets the neutral treatment
              rather than a colour that vouches for it. */}
          <div className={`paper ${index === 0 ? 'paper-original' : 'paper-received'}`}>
            <p className="eyebrow">{index === 0 ? 'The claim' : 'What you were given'}</p>
            <p className="paper-text">{source}</p>
          </div>

          {checked && (
            <div className="paper round-checked">
              <p className="eyebrow">You checked the original</p>
              <p className="paper-text">{round.claim.originalText}</p>
            </div>
          )}

          <HopInput card={card} source={source} value={draft} onChange={setDraft} />

          <button
            className="btn btn-primary btn-lg btn-block"
            disabled={!valid}
            onClick={() => submit(draft.trim())}
          >
            Pass it on <Icon name="send" />
          </button>

          {/* BBB-009, APPROVED: not offered at hop 1. The original is already
              the text on screen there, so spending one of the room's limited
              checks buys nothing but takes one away from a later hop that
              needs it. */}
          {!checked && index > 0 && round.verificationsLeft > 0 && (
            <button
              className="btn btn-block"
              onClick={() => {
                dispatch({ type: 'SPEND_VERIFICATION', hopIndex: index, atoms: [...ATOMS] });
                setChecked(true);
              }}
            >
              <Icon name="search" /> Check the original ({round.verificationsLeft} left)
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
