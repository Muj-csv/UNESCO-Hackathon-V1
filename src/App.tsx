import { useEffect } from 'react';
import type { ComponentType } from 'react';
import type { ScreenId } from './types/contracts';
import { useGame, useGameDispatch } from './state/GameContext';

import Lobby from './screens/Lobby';
import HowToPlay from './screens/HowToPlay';
import Brief from './screens/Brief';
import Prediction from './screens/Prediction';
import Round from './screens/Round';
import Terminal from './screens/Terminal';
import Reveal from './screens/Reveal';
import BlackboxGuess from './screens/BlackboxGuess';
import TuringHop from './screens/TuringHop';
import Accusation from './screens/Accusation';
import Thesis from './screens/Thesis';
import Ledger from './screens/Ledger';
import Debrief from './screens/Debrief';
import Superlatives from './screens/Superlatives';
import SessionReadout from './screens/SessionReadout';
import SplitDistribute from './screens/SplitDistribute';
import SplitReconstruct from './screens/SplitReconstruct';
import PackStudio from './screens/PackStudio';

/* ============================================================================
   The screen registry.

   SHARED FILE — DO NOT EDIT.

   The full route is registered here, including screens whose feature nobody
   has built. Each of those skips itself, so adding a feature means filling in
   your own file and never opening this one or the router.

   lobby → howToPlay → brief → prediction → round → terminal
         → reveal → blackboxGuess → turingHop → accusation
         → thesis → ledger → debrief → superlatives → sessionReadout

   CROWD RECALL diverges after the brief:
   … brief → splitDistribute → splitReconstruct → thesis → ledger → …
   ========================================================================== */

export const SCREENS: Partial<Record<ScreenId, ComponentType>> = {
  lobby: Lobby,
  howToPlay: HowToPlay, //           T3
  brief: Brief, //                   T3
  prediction: Prediction, //         T9  — skips itself
  round: Round,
  terminal: Terminal,
  reveal: Reveal,
  blackboxGuess: BlackboxGuess, //       skips itself unless black box is on
  turingHop: TuringHop, //           T6  — skips itself
  accusation: Accusation, //         T8  — skips itself
  thesis: Thesis, //                 T3
  ledger: Ledger,
  debrief: Debrief,
  superlatives: Superlatives,
  sessionReadout: SessionReadout,
  splitDistribute: SplitDistribute,
  splitReconstruct: SplitReconstruct,
  packStudio: PackStudio, //         T10
  /* joinRoom is T7's. It is not in the round route, and SelfSkip returns to
     the lobby until that screen exists. */
};

export default function App() {
  const { state } = useGame();
  const Screen = SCREENS[state.screen];

  return (
    <div className="shell">{Screen ? <Screen /> : <SelfSkip from={state.screen} />}</div>
  );
}

/**
 * Last resort for a ScreenId with no component yet. Steps to the next screen
 * in the route rather than rendering nothing.
 *
 * `from` is not optional: StrictMode runs this effect twice, and without it
 * the second run skips a screen that was meant to render.
 */
function SelfSkip({ from }: { from: ScreenId }) {
  const dispatch = useGameDispatch();
  useEffect(() => {
    dispatch({ type: 'ADVANCE', from });
  }, [dispatch, from]);
  return null;
}
