---
name: Neo-Retro Forensic
colors:
  surface: '#faf8ff'
  surface-dim: '#d9d9e5'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fe'
  surface-container: '#ededf9'
  surface-container-high: '#e7e7f3'
  surface-container-highest: '#e1e2ed'
  on-surface: '#191b23'
  on-surface-variant: '#434655'
  inverse-surface: '#2e3039'
  inverse-on-surface: '#f0f0fb'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#735c00'
  on-secondary: '#ffffff'
  secondary-container: '#fed01b'
  on-secondary-container: '#6f5900'
  tertiary: '#006229'
  on-tertiary: '#ffffff'
  tertiary-container: '#007e37'
  on-tertiary-container: '#c1ffc5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#ffe083'
  secondary-fixed-dim: '#eec200'
  on-secondary-fixed: '#231b00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#6bff8f'
  tertiary-fixed-dim: '#4ae176'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005321'
  background: '#faf8ff'
  on-background: '#191b23'
  surface-variant: '#e1e2ed'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Work Sans
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.5'
  body-md:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin: 32px
  offset-sm: 2px
  offset-md: 4px
  offset-lg: 8px
---

## Brand & Style

The design system is a high-energy fusion of early-2000s educational software and modern Neo-Brutalism. It is designed to feel like a "Forensic Game"—where every piece of data is a clue and every interaction is a satisfying, tactile event. The aesthetic targets a youthful, curious audience, evoking the nostalgia of classroom "edutainment" while maintaining the precision required for a blockchain-based truth platform.

The style is defined by **Neo-Brutalism**: bold black strokes, hard shadows, and a rejection of modern gradients and soft blurs. It prioritizes clarity, impact, and a physical sense of "chunkiness." The UI should feel like a tangible machine, rewarding users with deep offsets and immediate visual feedback.

## Colors

The palette utilizes high-vibrancy primary colors to denote functional zones and urgency.

- **Primary Blue (#2563EB):** Used for core actions, branding, and verified "Truth" states.
- **Sunny Yellow (#FACC15):** Used for warnings, highlighted claims, and secondary interactive elements.
- **Vibrant Green (#22C55E):** Reserved for success states, completed chains, and "Correct" indicators.
- **Cautionary Orange/Red (#F97316):** Used for errors, disputed data, and critical system alerts.
- **Off-White (#F8F5F0):** The primary surface color, providing a "paper-like" tactile quality that reduces eye strain compared to pure white.
- **Deep Charcoal (#1A1A1A):** Used for all borders, shadows, and primary text to ensure maximum contrast and a "marker-drawn" feel.

Avoid all gradients. Use solid fills and checkered patterns (dithering style) for depth if necessary.

## Typography

The typography strategy mixes high-impact geometric sans-serifs with technical monospaced fonts to create a "Software UI" hierarchy.

- **Headlines:** Use **Space Grotesk**. Its technical yet quirky personality matches the neo-retro aesthetic. Headings should always be bold and high-contrast against the background.
- **Body:** Use **Work Sans**. It provides excellent legibility for long-form forensic reports and claim descriptions, maintaining a professional yet approachable tone.
- **System Data:** Use **JetBrains Mono** for all claim IDs, wallet addresses, timestamps, and metadata. This reinforces the "Chain" and "Truth" aspect of the product, making data feel like raw, unedited evidence.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy for desktop (max-width 1440px) to simulate the feel of a self-contained software application.

- **Grid Model:** 12-column grid with 24px gutters. Content should feel densely packed but structured, mirroring a "dashboard" or "command center."
- **Rhythm:** All spacing (padding, margins) must be increments of 4px.
- **Breakpoints:** 
  - **Mobile (<768px):** Shift to a 4-column fluid layout. Increase margins to 24px for thumb-friendly navigation.
  - **Tablet (768px - 1024px):** 8-column layout.
- **Physical Offsets:** Elements do not use shadows for depth; instead, they use "hard offsets" where the element is physically moved 2px-8px relative to its border/shadow container.

## Elevation & Depth

This design system rejects ambient lighting. Depth is communicated through **Bold Borders** and **Hard Shadows**.

- **Shadows:** 100% opacity shadows in `#1A1A1A`. They are not blurred. The shadow should be a solid block of color offset to the bottom-right.
- **Borders:** Every interactive surface must have a minimum 2px solid border. Top-level panels or "Primary" cards use a 4px border.
- **Tiers:** 
  - **Tier 1 (Surface):** Neutral base, 2px border, no shadow.
  - **Tier 2 (Cards):** 2px border, 4px hard shadow.
  - **Tier 3 (Active/Pop-up):** 4px border, 8px hard shadow.
- **Pressed States:** On click, the element should move (translate) to exactly cover its shadow, creating a satisfying "physical" click feel.

## Shapes

The shape language is **Soft (0.25rem)**. While the style is brutalist, slightly rounded corners (4px - 12px) prevent the UI from feeling too aggressive or "sharp," maintaining the youthful "edutainment" vibe.

- **Standard Elements:** 4px radius.
- **Buttons & Chips:** 8px radius for a friendlier, "chunky" feel.
- **Input Fields:** 4px radius to maintain a structured, systematic appearance.

## Components

### Buttons
Buttons are the primary "game objects." They must have a 2px black border and a 4px hard shadow. 
- **Hover:** The shadow grows to 6px, and the button translates -2px.
- **Active (Pressed):** The button translates +4px down and right, hiding the shadow entirely.

### Cards & Panels
Panels should look like "windows" within the software. Use a 4px border for the header area and a 2px border for the content area. Backgrounds for headers should be in Primary Blue or Sunny Yellow.

### Input Fields
Inputs are recessed. Instead of an outer shadow, use an "inner-border" look where the bottom and right borders are lighter, simulating an inset depth. Label text should always use the monospaced font.

### Progress & Truth Gauges
Use "pixel-block" progress bars (segmented blocks) rather than a smooth continuous fill. This reinforces the early-2000s software aesthetic.

### Claim Chips
Small metadata tags (e.g., "Verified," "Disputed") should have a "pill" shape (rounded-xl) with a 2px border and no shadow to keep them distinct from primary action buttons.

### Forensic Overlays
When viewing data details, use a "window-in-window" approach with a thick title bar and a "close" icon (X) that is a simple bold graphic.