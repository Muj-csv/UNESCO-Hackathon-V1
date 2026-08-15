/* ============================================================================
   The icon set.

   Inline SVG, not a webfont. The Stitch prototype pulled Material Symbols
   from Google's CDN; this game runs on classroom phones on unreliable wifi,
   so nothing may block on an external request. These are drawn from the same
   Material geometry (24px grid) and inherit `currentColor`, so an icon in a
   yellow title bar is ink and an icon on a blue button is white, with no
   per-use colour prop.

   Sized in `em` (see `.icon` in global.css), so an icon scales with whatever
   text it sits beside. Use `size` only to break that deliberately.

   Add a path here when a screen needs one. Keep them alphabetical.
   ========================================================================== */

export type IconName =
  | 'add'
  | 'alert'
  | 'analytics'
  | 'arrowBack'
  | 'arrowForward'
  | 'block'
  | 'bolt'
  | 'check'
  | 'checkCircle'
  | 'chevronDown'
  | 'close'
  | 'download'
  | 'grid'
  | 'help'
  | 'inventory'
  | 'link'
  | 'lock'
  | 'mask'
  | 'people'
  | 'play'
  | 'publish'
  | 'radar'
  | 'refresh'
  | 'robot'
  | 'search'
  | 'send'
  | 'settings'
  | 'split'
  | 'target'
  | 'terminal'
  | 'timer'
  | 'trendingUp'
  | 'upload'
  | 'vote';

/** 24×24 viewBox path data, one entry per name. */
const PATHS: Record<IconName, string> = {
  add: 'M11 13H5v-2h6V5h2v6h6v2h-6v6h-2v-6z',
  alert: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  analytics: 'M5 21V9h4v12H5zm5.5 0V3h3v18h-3zM16 21v-8h4v8h-4z',
  arrowBack: 'M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2z',
  arrowForward: 'M4 13h12.2l-5.6 5.6L12 20l8-8-8-8-1.4 1.4 5.6 5.6H4v2z',
  block: 'M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z',
  bolt: 'M11 21v-7H7l6-11v7h4l-6 11z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z',
  checkCircle:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.6-4.2-4.2 1.4-1.4 2.8 2.8 5.8-5.8 1.4 1.4-7.2 7.2z',
  chevronDown: 'M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6 1.4-1.4z',
  close: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4z',
  download: 'M12 16 6 10l1.4-1.4L11 12.2V4h2v8.2l3.6-3.6L18 10l-6 6zm-8 4v-2h16v2H4z',
  grid: 'M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z',
  help: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 17h-2v-2h2v2zm2.1-7.7-.9.9c-.7.7-1.2 1.3-1.2 2.8h-2v-.5c0-1.1.5-2.1 1.2-2.8l1.2-1.3c.4-.3.6-.8.6-1.4a2 2 0 1 0-4 0H8a4 4 0 1 1 8 0c0 .9-.4 1.7-.9 2.3z',
  inventory: 'M3 3h18v4H3V3zm1 6h16v12H4V9zm5 3v2h6v-2H9z',
  link: 'M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12zM8 13h8v-2H8v2zm9-6h-4v1.9h4a3.1 3.1 0 1 1 0 6.2h-4V17h4a5 5 0 0 0 0-10z',
  lock: 'M17 9V7a5 5 0 0 0-10 0v2H5v12h14V9h-2zM9 7a3 3 0 1 1 6 0v2H9V7zm3 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
  mask: 'M12 4c-4.4 0-8 2.7-8 6 0 1.5.8 2.9 2 4l-.6 4 4-2c.8.2 1.7.3 2.6.3 4.4 0 8-2.7 8-6.3S16.4 4 12 4zM9 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  people:
    'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.7 0-8 1.3-8 4v2h9v-2c0-1 .4-2.6 2.3-3.7A14 14 0 0 0 8 13zm8 0c-.4 0-.8 0-1.3.1C16.3 14.2 17 15.8 17 17v2h7v-2c0-2.7-5.3-4-8-4z',
  play: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 14.5v-9l6 4.5-6 4.5z',
  publish: 'M5 4h14v2H5V4zm7 3 6 6h-4v6h-4v-6H6l6-6z',
  radar: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  refresh:
    'M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z',
  robot: 'M20 9h-1V7a3 3 0 0 0-3-3h-3V2h-2v2H8a3 3 0 0 0-3 3v2H4v6h1v2a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-2h1V9zM9.5 14a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  search:
    'M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z',
  send: 'M2 21l21-9L2 3v7l15 2-15 2v7z',
  settings:
    'M19.4 13a7.8 7.8 0 0 0 0-2l2-1.6-2-3.4-2.5 1a7.6 7.6 0 0 0-1.7-1L14.8 3H10l-.4 2.9c-.6.3-1.2.6-1.7 1l-2.5-1-2 3.4L5.4 11a7.8 7.8 0 0 0 0 2l-2 1.6 2 3.4 2.5-1c.5.4 1.1.8 1.7 1l.4 3h4.8l.4-3c.6-.2 1.2-.6 1.7-1l2.5 1 2-3.4-2-1.6zM12.4 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
  split: 'M14 4h6v6h-2V7.4l-4.3 4.3-1.4-1.4L16.6 6H14V4zM4 4h6v2H7.4l4.3 4.3-1.4 1.4L6 7.4V10H4V4zm10.3 8.3 4.3 4.3V14h2v6h-6v-2h2.6l-4.3-4.3 1.4-1.4z',
  target:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
  terminal: 'M2 4h20v16H2V4zm3.7 4.3L4.3 9.7 6.6 12l-2.3 2.3 1.4 1.4L9.4 12 5.7 8.3zM11 14h6v2h-6v-2z',
  timer: 'M9 1h6v2H9V1zm2 7h2v6h-2V8zm7.1-1.1 1.4-1.4-1.4-1.4-1.5 1.4A9 9 0 1 0 21 13a8.9 8.9 0 0 0-2.9-6.1zM12 20a7 7 0 1 1 0-14 7 7 0 0 1 0 14z',
  trendingUp: 'M16 6l2.3 2.3-4.9 4.9-4-4L2 16.6 3.4 18l6-6 4 4 6.3-6.3L22 12V6h-6z',
  upload: 'M12 4l6 6-1.4 1.4L13 7.8V16h-2V7.8l-3.6 3.6L6 10l6-6zm-8 16v-2h16v2H4z',
  vote: 'M18 13v-1l-2.6-3.1a1 1 0 0 0-.8-.4H9.4a1 1 0 0 0-.8.4L6 12v1h12zM4 15h16v4H4v-4zm7.3-6.6L8.5 5.6 9.9 4.2l1.4 1.4 3.5-3.5 1.4 1.4-4.9 4.9z',
};

export interface IconProps {
  name: IconName;
  /** Overrides the inherited font size. Accepts any CSS length. */
  size?: string | number;
  className?: string;
  /** Supply only when the icon is the sole content of a control. */
  title?: string;
}

export default function Icon({ name, size, className, title }: IconProps) {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      className={`icon${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      style={size ? { fontSize: typeof size === 'number' ? `${size}px` : size } : undefined}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <path d={path} />
    </svg>
  );
}
