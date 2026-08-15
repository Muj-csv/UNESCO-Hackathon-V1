import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

/* Fonts are bundled, not fetched. Both the proposal sheet and the Stitch
   prototype used a Google Fonts <link>; that would be an external request on
   load, and the game runs in classrooms on shared phones with unreliable
   wifi. Self-hosted only.

   Space Grotesk headlines, Work Sans body, JetBrains Mono for anything that
   reads as machine output. Only the weights the design system actually
   names are pulled in. */
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/work-sans/400.css';
import '@fontsource/work-sans/500.css';
import '@fontsource/work-sans/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';

import './styles/global.css';
import App from './App';
import { GameProvider } from './state/GameContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </StrictMode>,
);
