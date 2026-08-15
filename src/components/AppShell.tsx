import type { ReactNode } from 'react';
import type { ScreenId } from '../types/contracts';
import { useGame } from '../state/GameContext';
import { badgeFor, isInPlay } from '../state/stages';
import Icon from './Icon';
import type { IconName } from './Icon';
import StageRail from './StageRail';
import RoomStatusBar from './RoomStatusBar';

/* ============================================================================
   The chrome.

   A Control Deck around a linear game. The tension the shell has to resolve:
   the visual language is a dashboard, which implies you may go anywhere, but
   the game is a route several devices walk in step. So navigation exists
   ONLY where leaving is harmless — the lobby and its side trips — and the
   moment a round is dealt the sidebar stops offering exits and starts
   reporting position instead (see StageRail).

   That is also why there is no settings gear: the only settings are the
   lobby's own, and a control that silently abandons a room's round in
   progress is worse than no control.
   ========================================================================== */

interface NavItem {
  screen: ScreenId;
  label: string;
  short: string;
  icon: IconName;
  /** Screens that should light this item up as well as its own. */
  also?: ScreenId[];
}

/** Screens that lay panels out side by side rather than reading as a column. */
const WIDE_SCREENS: ScreenId[] = ['lobby', 'packStudio'];

const NAV: NavItem[] = [
  { screen: 'lobby', label: 'Play', short: 'Play', icon: 'grid', also: ['joinRoom'] },
  { screen: 'packStudio', label: 'Pack Studio', short: 'Studio', icon: 'inventory' },
  { screen: 'howToPlay', label: 'How to play', short: 'Help', icon: 'help' },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { state, dispatch, roomStatus } = useGame();
  const { screen, settings, room, session } = state;

  const inPlay = isInPlay(screen);
  const badge = badgeFor(settings.mode, screen);
  const go = (next: ScreenId) => dispatch({ type: 'GO_TO', screen: next });

  return (
    <div className={`app${inPlay ? '' : ' has-mobilenav'}`}>
      <Sidebar inPlay={inPlay} screen={screen} onGo={go} />

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-brand">
            <BrickMark />
            <span className="topbar-word">BRICK-BY-BRICK</span>
            <span className="topbar-word-short">B-B-B</span>
            {badge && <span className="topbar-badge">{badge}</span>}
          </div>

          <div className="topbar-actions">
            {room.code && (
              <span className="topbar-room">
                <span
                  className={`room-status-dot is-${roomStatus}`}
                  aria-hidden="true"
                />
                <span className="mono">{room.code}</span>
              </span>
            )}
            {/* Only when leaving costs nothing. Mid-round this would drop a
                device out of a chain the rest of the room is still walking. */}
            {!inPlay && screen !== 'howToPlay' && (
              <button
                type="button"
                className="icon-btn"
                onClick={() => go('howToPlay')}
                title="How to play"
                aria-label="How to play"
              >
                <Icon name="help" />
              </button>
            )}
          </div>
        </header>

        {/* Room failure handling — only renders when there is something to
            act on. Sits under the bar so it reads as a system message. */}
        <RoomStatusBar />

        {/* The rail lives in the sidebar on a wide screen; on a phone there
            is no sidebar, so it becomes a strip here. */}
        {inPlay && (
          <div className="stagerail-mobile">
            <StageRail orientation="strip" />
          </div>
        )}

        {/* Two column widths. A round is one thing at a time and reads as a
            column; the lobby and the studio are workbenches and need the
            room to lay panels side by side. */}
        <main className={`app-content${inPlay ? ' bg-grid' : ' bg-dots'}`}>
          <div className={`shell${WIDE_SCREENS.includes(screen) ? ' shell-wide' : ''}`}>
            {children}
          </div>
        </main>

        <footer className="statusbar">
          <span className="statusbar-state">
            <span className="statusbar-dot" aria-hidden="true" />
            {inPlay ? `${MODE_LABEL[settings.mode]} · Round ${session.roundNumber}` : 'Ready'}
          </span>
          <span className="statusbar-note">
            Every claim in this game is made up. No real people, organisations or events.
          </span>
        </footer>
      </div>

      {/* Phone navigation. Absent mid-round for the same reason the sidebar
          nav is: there is nowhere to go that isn't abandoning the room. */}
      {!inPlay && (
        <nav className="mobilenav" aria-label="Sections">
          {NAV.map((item) => (
            <button
              key={item.screen}
              type="button"
              className={`mobilenav-item${isActive(item, screen) ? ' is-active' : ''}`}
              onClick={() => go(item.screen)}
            >
              <Icon name={item.icon} className="icon-lg" />
              <span>{item.short}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

const MODE_LABEL: Record<string, string> = {
  chain: 'Chain',
  badfaith: 'Bad Faith',
  crowd: 'Crowd Recall',
};

function isActive(item: NavItem, screen: ScreenId): boolean {
  return item.screen === screen || !!item.also?.includes(screen);
}

/* -------------------------------------------------------------- sidebar -- */

function Sidebar({
  inPlay,
  screen,
  onGo,
}: {
  inPlay: boolean;
  screen: ScreenId;
  onGo: (screen: ScreenId) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-mark">
          <BrickMark large />
        </div>
        <h2 className="sidebar-title">Control Deck</h2>
        <span className="sidebar-state">
          <span className="sidebar-state-dot" aria-hidden="true" />
          {inPlay ? 'Round in progress' : 'System ready'}
        </span>
      </div>

      <div className="sidebar-body">
        {inPlay ? (
          <StageRail orientation="rail" />
        ) : (
          <nav className="sidebar-nav" aria-label="Sections">
            {NAV.map((item) => (
              <button
                key={item.screen}
                type="button"
                className={`sidebar-link${isActive(item, screen) ? ' is-active' : ''}`}
                onClick={() => onGo(item.screen)}
              >
                <Icon name={item.icon} className="icon-lg" />
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      <p className="sidebar-foot">
        A media &amp; information literacy game about how true things stop being true.
      </p>
    </aside>
  );
}

/* ------------------------------------------------------------------ mark -- */

/**
 * Two bricks. The second is offset and dashed — the same claim, one hop on,
 * no longer flush with what it was built from. The whole game in 24 pixels.
 */
function BrickMark({ large }: { large?: boolean }) {
  return (
    <svg
      className={`brickmark${large ? ' brickmark-lg' : ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="4" width="14" height="7" rx="1" className="brickmark-solid" />
      <rect
        x="8"
        y="14"
        width="14"
        height="7"
        rx="1"
        className="brickmark-ghost"
        strokeDasharray="3 2.5"
      />
    </svg>
  );
}
