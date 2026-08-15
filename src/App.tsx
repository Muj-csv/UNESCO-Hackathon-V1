import { useEffect } from 'react';
import type { ComponentType } from 'react';
import type { ScreenId } from './types/contracts';
import { useGame, useGameDispatch } from './state/GameContext';

import Lobby from './screens/Lobby';
import HowToPlay from './screens/HowToPlay';
import Round from './screens/Round';
import Terminal from './screens/Terminal';
import Reveal from './screens/Reveal';
import BlackboxGuess from './screens/BlackboxGuess';
import Ledger from './screens/Ledger';
import Debrief from './screens/Debrief';
import Superlatives from './screens/Superlatives';
import SessionReadout from './screens/SessionReadout';
import SplitDistribute from './screens/SplitDistribute';
import SplitReconstruct from './screens/SplitReconstruct';

/* ============================================================================
   The screen registry.

   SHARED FILE — DO NOT EDIT.
   The full route is already registered, including screens nobody has built
   yet. A screen whose feature does not exist skips itself, so adding a
   feature means filling in your own file and never touching this one.
   ========================================================================== */

const SCREENS: Partial<Record<ScreenId, ComponentType>> = {
  lobby: Lobby,
  howToPlay: HowToPlay,
  round: Round,
  terminal: Terminal,
  reveal: Reveal,
  blackboxGuess: BlackboxGuess,
  ledger: Ledger,
  debrief: Debrief,
  superlatives: Superlatives,
  sessionReadout: SessionReadout,
  splitDistribute: SplitDistribute,
  splitReconstruct: SplitReconstruct,
};

export default function App() {
  const { state } = useGame();
  const Screen = SCREENS[state.screen];

  return (
    <div className="shell">
      {Screen ? <Screen /> : <SelfSkip from={state.screen} />}
    </div>
  );
}

/**
 * Stands in for a screen whose feature has not been built. It steps straight
 * to the next screen in the route, which is what keeps a full round playable
 * while `brief`, `prediction`, `turingHop`, `accusation` and `thesis` are
 * still empty.
 *
 * `from` is not optional here: StrictMode runs this effect twice, and without
 * it the second run skips a screen that was meant to render.
 */
function SelfSkip({ from }: { from: ScreenId }) {
  const dispatch = useGameDispatch();
  useEffect(() => {
    dispatch({ type: 'ADVANCE', from });
  }, [dispatch, from]);
  return null;
}
