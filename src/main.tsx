import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

/* Fonts are bundled, not fetched. The proposal sheet used a Google Fonts
   <link>; that would be an external request on load, and the game runs in
   classrooms on shared phones with unreliable wifi. Self-hosted only. */
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/400-italic.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/700.css';
import '@fontsource-variable/inter/wght.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

import './styles/global.css';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
