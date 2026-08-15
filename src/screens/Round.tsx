import { useEffect, useRef, useState } from 'react';
import { ATOMS } from '../types/contracts';
import { useGame } from '../state/GameContext';
import { hopPlayerName, textInFrontOfPlayer } from '../state/gameReducer';
import { getCard } from '../data/cards';
import StageBar from '../components/StageBar';
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
   ========================================================================== */

export default function Round() {
  const { state, dispatch } = useGame();
  const { round, settings } = state;
  const index = round.currentHop;

  const player = hopPlayerName(state, index);
  const card = getCard(round.dealtCards[index] ?? null);
  const source = textInFrontOfPlayer(state);

  /* Component state, not reducer state. The prototype kept _draft, _passHidden
     and _cardShownFor in the store because it rebuilt the DOM every render. */
  const [handedOver, setHandedOver] = useState(false);
  const [draft, setDraft] = useState('');
  const [checked, setChecked] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(settings.timerSeconds);
  const submitted = useRef(false);

  /* New hop, new everything. */
  useEffect(() => {
    setHandedOver(false);
    setDraft('');
    setChecked(false);
    setSecondsLeft(settings.timerSeconds);
    submitted.current = false;
  }, [index, settings.timerSeconds]);

  useEffect(() => {
    if (!handedOver) return;
    const id = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [handedOver]);

  const submit = (text: string) => {
    if (submitted.current) return;
    submitted.current = true;
    dispatch({ type: 'SUBMIT_HOP', text });
  };

  /* Time up. Whatever is in the box goes; if nothing is, the version passes on
     unchanged. Running out is a rule of the game, not a failure state. */
  useEffect(() => {
    if (handedOver && secondsLeft <= 0) submit(draft.trim() || source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handedOver, secondsLeft]);

  if (!round.claim) return null;

  if (!handedOver) {
    return (
      <div className="screen">
        <StageBar label={`Hop ${index + 1} of ${settings.chainLength}`} />
        <div className="handoff">
          <p className="eyebrow">Pass the device to</p>
          <h1>{player}</h1>
          <p className="muted">Only {player} should read the next screen.</p>
          <button className="btn btn-primary btn-block" onClick={() => setHandedOver(true)}>
            I'm {player}
          </button>
        </div>
      </div>
    );
  }

  const valid = hopInputValid(card, draft);
  const timeShort = secondsLeft <= 5;

  return (
    <div className="screen">
      <StageBar label={`Hop ${index + 1} of ${settings.chainLength}`} note={player} />

      <AIHopBeat />

      <div className="row round-clock">
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
            width: `${Math.max(0, Math.min(100, (secondsLeft / settings.timerSeconds) * 100))}%`,
          }}
        />
      </div>

      {card && (
        <div className="constraint">
          <span className="constraint-name">{card.name}</span>
          <span className="constraint-note">{card.note}</span>
        </div>
      )}

      <div className="paper paper-original">
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

      <button className="btn btn-primary btn-block" disabled={!valid} onClick={() => submit(draft.trim())}>
        Pass it on
      </button>

      {!checked && round.verificationsLeft > 0 && (
        <button
          className="btn btn-ghost btn-block"
          onClick={() => {
            dispatch({ type: 'SPEND_VERIFICATION', hopIndex: index, atoms: [...ATOMS] });
            setChecked(true);
          }}
        >
          Check the original ({round.verificationsLeft} left for the whole chain)
        </button>
      )}
    </div>
  );
}
