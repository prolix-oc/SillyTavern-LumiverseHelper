/**
 * ChatSheldStyles — Glassmorphic Chat Override Stylesheet
 *
 * Scoped via `.lcs-app` selector for style isolation without Shadow DOM.
 * Uses Lumiverse theme CSS custom properties with dark/light mode awareness.
 *
 * Design direction: Frosted crystalline — every surface feels like looking
 * through tinted, lightly frosted glass. Depth is conveyed through layered
 * translucency rather than drop-shadows. Accent bars glow softly as if
 * backlit by neon behind the glass pane.
 */

export const chatSheldStyles = `
/* ═══════════════════════════════════════════════════════════════════════
   RESET & HOST
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-app {
  --lcs-radius: 14px;
  --lcs-radius-sm: 8px;
  --lcs-radius-xs: 5px;
  --lcs-gap: 10px;
  --lcs-accent-width: 3px;
  --lcs-transition: 220ms cubic-bezier(0.4, 0, 0.2, 1);
  --lcs-transition-fast: 120ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Glass surface defaults (dark mode) — overridden contextually for light */
  --lcs-glass-bg: rgba(18, 16, 28, 0.55);
  --lcs-glass-bg-hover: rgba(24, 22, 36, 0.65);
  --lcs-glass-border: rgba(255, 255, 255, 0.06);
  --lcs-glass-border-hover: rgba(255, 255, 255, 0.1);
  --lcs-glass-blur: 14px;
  --lcs-glass-char-tint: rgba(100, 120, 255, 0.03);
  --lcs-glass-user-tint: rgba(255, 180, 100, 0.03);

  /* Scrollbar */
  --lcs-scrollbar-w: 5px;
  --lcs-scrollbar-track: transparent;
  --lcs-scrollbar-thumb: var(--lumiverse-fill, rgba(255,255,255,0.08));
  --lcs-scrollbar-thumb-hover: var(--lumiverse-fill-hover, rgba(255,255,255,0.15));

  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 0;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  font-size: 15px;
  line-height: 1.55;
  color: var(--lumiverse-text, rgba(230, 230, 240, 0.92));
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.lcs-app *, .lcs-app *::before, .lcs-app *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Lucide icons: inherit color, flex-friendly sizing */
svg.lucide {
  flex-shrink: 0;
  color: inherit;
  fill: none;
  stroke: currentColor;
}

/* ═══════════════════════════════════════════════════════════════════════
   CONTAINER
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-container {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

/* ═══════════════════════════════════════════════════════════════════════
   SCROLL CONTAINER
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-scroll-container {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  padding: 8px 12px 16px;
  overscroll-behavior-y: contain;
}

/* Custom scrollbar */
.lcs-scroll-container::-webkit-scrollbar {
  width: var(--lcs-scrollbar-w);
}
.lcs-scroll-container::-webkit-scrollbar-track {
  background: var(--lcs-scrollbar-track);
}
.lcs-scroll-container::-webkit-scrollbar-thumb {
  background: var(--lcs-scrollbar-thumb);
  border-radius: 10px;
  transition: background 0.2s;
}
.lcs-scroll-container::-webkit-scrollbar-thumb:hover {
  background: var(--lcs-scrollbar-thumb-hover);
}

/* Firefox */
.lcs-scroll-container {
  scrollbar-width: thin;
  scrollbar-color: var(--lcs-scrollbar-thumb) var(--lcs-scrollbar-track);
}

/* ═══════════════════════════════════════════════════════════════════════
   MESSAGE LIST
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-message-list {
  display: flex;
  flex-direction: column;
  gap: var(--lcs-gap);
}

/* ═══════════════════════════════════════════════════════════════════════
   MESSAGE CARD — Base
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-message {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  border-radius: var(--lcs-radius);
  background: var(--lcs-glass-bg);
  backdrop-filter: blur(var(--lcs-glass-blur));
  -webkit-backdrop-filter: blur(var(--lcs-glass-blur));
  border: 1px solid var(--lcs-glass-border);
  transition:
    background var(--lcs-transition),
    border-color var(--lcs-transition),
    box-shadow var(--lcs-transition),
    transform var(--lcs-transition);
  overflow: hidden;
}

.lcs-message:hover {
  background: var(--lcs-glass-bg-hover);
  border-color: var(--lcs-glass-border-hover);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.12);
}

/* During streaming, the main thread freezes for 170-600ms (assembleMessages,
   syncFullChat, council tools). If the user scrolls during this freeze, the GPU
   compositor shifts stale backdrop-filter textures — when the thread unblocks,
   those textures aren't repainted and render as a black void.
   Fix: disable backdrop-filter on ALL cards while any card is streaming. The
   parent .lcs-app gets a class and we use it to bypass the expensive blur.
   The opaque fallback background is visually close enough that the transition
   is imperceptible. will-change on the streaming card keeps its own layer
   stable during rapid height changes from incoming tokens. */
.lcs-container--streaming .lcs-message {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.lcs-message--streaming {
  will-change: transform, contents;
}

/* ── Accent bars ── */
.lcs-message::before {
  content: '';
  position: absolute;
  top: 8px;
  bottom: auto;
  height: calc(100% - 16px);
  width: var(--lcs-accent-width);
  border-radius: 2px;
  opacity: 0.85;
  transition: opacity var(--lcs-transition), box-shadow var(--lcs-transition), height 180ms ease-out;
}

.lcs-message:hover::before {
  opacity: 1;
}

/* ── Character variant ── */
.lcs-message--character {
  background:
    linear-gradient(135deg, var(--lcs-glass-char-tint) 0%, transparent 60%),
    var(--lcs-glass-bg);
}
.lcs-message--character::before {
  left: 0;
  background: linear-gradient(
    180deg,
    var(--lumiverse-primary, rgba(140, 130, 255, 0.9)) 0%,
    var(--lumiverse-primary-060, rgba(140, 130, 255, 0.6)) 100%
  );
  box-shadow: 0 0 8px var(--lumiverse-primary-025, rgba(140, 130, 255, 0.25));
}
.lcs-message--character:hover::before {
  box-shadow: 0 0 14px var(--lumiverse-primary-040, rgba(140, 130, 255, 0.4));
}

/* ── User variant ── */
.lcs-message--user {
  background:
    linear-gradient(225deg, var(--lcs-glass-user-tint) 0%, transparent 60%),
    var(--lcs-glass-bg);
}
.lcs-message--user::before {
  right: 0;
  left: auto;
  background: linear-gradient(
    180deg,
    var(--lumiverse-secondary-080, rgba(255, 180, 100, 0.8)) 0%,
    var(--lumiverse-secondary-045, rgba(255, 180, 100, 0.45)) 100%
  );
  box-shadow: 0 0 8px var(--lumiverse-secondary-020, rgba(255, 180, 100, 0.2));
}
.lcs-message--user:hover::before {
  box-shadow: 0 0 14px var(--lumiverse-secondary-035, rgba(255, 180, 100, 0.35));
}

/* ── System variant ── */
.lcs-message--system {
  text-align: center;
  padding: 8px 16px;
  font-size: 0.88em;
  color: var(--lumiverse-text-muted, rgba(230,230,240,0.6));
  background: var(--lumiverse-fill-subtle, rgba(255,255,255,0.03));
  border-color: transparent;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.lcs-message--system::before { display: none; }
.lcs-message--system:hover {
  background: var(--lumiverse-fill, rgba(255,255,255,0.06));
}

/* ═══════════════════════════════════════════════════════════════════════
   MESSAGE HEADER (avatar + name + timestamp)
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-message-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.lcs-message--character .lcs-message-header {
  padding-left: 8px;
}
.lcs-message--user .lcs-message-header {
  flex-direction: row-reverse;
  padding-right: 8px;
}

.lcs-message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1.5px solid var(--lumiverse-border, rgba(255,255,255,0.08));
  background: var(--lumiverse-fill-subtle, rgba(255,255,255,0.04));
}

.lcs-message-avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--lumiverse-text-muted, rgba(230,230,240,0.6));
  background: var(--lumiverse-fill, rgba(255,255,255,0.06));
}

.lcs-message-meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.lcs-message--user .lcs-message-meta {
  align-items: flex-end;
}

.lcs-message-name {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.015em;
  color: var(--lumiverse-text, rgba(230,230,240,0.92));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lcs-message--character .lcs-message-name {
  color: var(--lumiverse-primary-text, rgba(160, 150, 255, 0.95));
}

.lcs-message-timestamp {
  font-size: 10.5px;
  color: var(--lumiverse-text-dim, rgba(230,230,240,0.35));
  letter-spacing: 0.03em;
  font-variant-numeric: tabular-nums;
}

/* ═══════════════════════════════════════════════════════════════════════
   MESSAGE CONTENT — Prose
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-message-content {
  padding: 0 4px;
  word-wrap: break-word;
  overflow-wrap: break-word;
  min-height: 1.55em;
  /* Explicit resets — prevent ST global styles from leaking in */
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  color: inherit;
  text-indent: 0;
  text-transform: none;
  letter-spacing: normal;
  text-shadow: none;
}

.lcs-message--character .lcs-message-content {
  padding-left: 8px;
}
.lcs-message--user .lcs-message-content {
  padding-right: 8px;
}

/* ── Suppress browser/ST-generated quotation marks ──
   ST's messageFormatting wraps speech in <q> tags. Browsers add curly quotes
   via ::before/::after, doubling up with the straight quotes already in text. */
.lcs-message-content q {
  quotes: none;
}
.lcs-message-content q::before,
.lcs-message-content q::after {
  content: none;
}

/* ── Content element reset ──
   Overrides any ST global styles for bare HTML elements rendered by Marked.
   Without Shadow DOM, ST's selectors for #chat p, .mes_text em, etc.
   can leak through — these scoped rules take priority.
   Elements inside [data-lumia-ooc] are excluded so the DOM factory
   templates from oocComments.js can use their own style.css classes. */

.lcs-message-content p:not([data-lumia-ooc] *, [data-lumia-ooc]),
.lcs-message-content span:not([data-lumia-ooc] *, [data-lumia-ooc]),
.lcs-message-content div:not([data-lumia-ooc] *, [data-lumia-ooc]) {
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  color: inherit;
  text-indent: 0;
  text-transform: none;
  letter-spacing: normal;
  text-decoration: none;
  text-shadow: none;
}

.lcs-message-content p:not([data-lumia-ooc] *, [data-lumia-ooc]) { margin: 0 0 0.6em; }
.lcs-message-content p:not([data-lumia-ooc] *, [data-lumia-ooc]):last-child { margin-bottom: 0; }

/* ── Themed prose colors ──
   Dialogue, italics, and bold use theme-derived colors for visual
   distinction between spoken words, thoughts, and emphasis. */

.lcs-message-content em,
.lcs-message-content .lcs-prose-italic {
  font-style: italic;
  color: var(--lumiverse-prose-italic, var(--lumiverse-text-muted, rgba(230,230,240,0.7)));
  text-decoration: none;
  background: none;
}

.lcs-message-content strong,
.lcs-message-content .lcs-prose-bold {
  font-weight: 600;
  color: var(--lumiverse-prose-bold, inherit);
  text-decoration: none;
  background: none;
}

.lcs-message-content .lcs-prose-dialogue {
  color: var(--lumiverse-prose-dialogue, inherit);
}

.lcs-message-content a {
  color: var(--lumiverse-primary-text, rgba(160, 150, 255, 0.95));
  text-decoration: none;
  border-bottom: 1px solid var(--lumiverse-primary-025, rgba(140, 130, 255, 0.25));
  background: none;
  transition: border-color var(--lcs-transition-fast);
}
.lcs-message-content a:hover {
  border-color: var(--lumiverse-primary-060, rgba(140, 130, 255, 0.6));
  text-decoration: none;
}

/* Code (inline) */
.lcs-message-content code {
  font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 0.88em;
  padding: 1.5px 5px;
  border-radius: var(--lcs-radius-xs);
  background: var(--lumiverse-fill, rgba(255,255,255,0.06));
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.06));
  color: var(--lumiverse-primary-text, rgba(160, 150, 255, 0.95));
  text-decoration: none;
  text-shadow: none;
  letter-spacing: normal;
}

/* Code block */
.lcs-message-content pre {
  margin: 8px 0;
  padding: 12px 14px;
  border-radius: var(--lcs-radius-sm);
  background: var(--lumiverse-bg-deep, rgba(10, 8, 18, 0.9));
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.06));
  overflow-x: auto;
  font-size: 0.88em;
  line-height: 1.5;
  text-indent: 0;
  text-shadow: none;
}
.lcs-message-content pre code {
  padding: 0;
  border: none;
  background: none;
  color: var(--lumiverse-text, rgba(230,230,240,0.92));
  font-size: inherit;
}

/* Blockquote */
.lcs-message-content blockquote {
  margin: 6px 0;
  padding: 6px 14px;
  border: none;
  border-left: 2px solid var(--lumiverse-primary-030, rgba(140, 130, 255, 0.3));
  background: var(--lumiverse-fill-subtle, rgba(255,255,255,0.02));
  border-radius: 0 var(--lcs-radius-xs) var(--lcs-radius-xs) 0;
  color: var(--lumiverse-prose-blockquote, var(--lumiverse-text-muted, rgba(230,230,240,0.7)));
  font-style: italic;
  font-size: inherit;
  line-height: inherit;
  text-indent: 0;
  text-shadow: none;
}

/* Lists */
.lcs-message-content ul, .lcs-message-content ol {
  padding-left: 1.4em;
  margin: 4px 0;
  list-style-position: outside;
  background: none;
}
.lcs-message-content ul { list-style-type: disc; }
.lcs-message-content ol { list-style-type: decimal; }
.lcs-message-content li {
  margin-bottom: 2px;
  padding: 0;
  border: none;
  background: none;
  text-indent: 0;
}

/* Headings */
.lcs-message-content h1,
.lcs-message-content h2,
.lcs-message-content h3,
.lcs-message-content h4,
.lcs-message-content h5,
.lcs-message-content h6 {
  margin: 0.7em 0 0.35em;
  padding: 0;
  border: none;
  background: none;
  font-weight: 600;
  font-family: inherit;
  line-height: 1.3;
  color: var(--lumiverse-text, rgba(230,230,240,0.92));
  white-space: normal;
  text-indent: 0;
  text-transform: none;
  text-decoration: none;
  text-shadow: none;
  letter-spacing: normal;
}
.lcs-message-content h1 { font-size: 1.35em; }
.lcs-message-content h2 { font-size: 1.2em; }
.lcs-message-content h3 { font-size: 1.1em; }
.lcs-message-content h4 { font-size: 1.02em; }
.lcs-message-content h5 { font-size: 0.95em; }
.lcs-message-content h6 { font-size: 0.9em; color: var(--lumiverse-text-muted, rgba(230,230,240,0.7)); }
.lcs-message-content h1:first-child,
.lcs-message-content h2:first-child,
.lcs-message-content h3:first-child { margin-top: 0; }

/* Horizontal rule */
.lcs-message-content hr {
  border: none;
  height: 1px;
  background: var(--lumiverse-border, rgba(255,255,255,0.06));
  margin: 12px 0;
  padding: 0;
}

/* Images */
.lcs-message-content img {
  max-width: 100%;
  border-radius: var(--lcs-radius-sm);
  margin: 6px 0;
  border: none;
}

/* ═══════════════════════════════════════════════════════════════════════
   MESSAGE ACTIONS — Hover Reveal
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-message-actions {
  position: absolute;
  top: 8px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transform: translateY(-2px);
  pointer-events: none;
  transition:
    opacity var(--lcs-transition),
    transform var(--lcs-transition);
  z-index: 5;
}

.lcs-message--user .lcs-message-actions {
  right: auto;
  left: 12px;
}

.lcs-message:hover .lcs-message-actions {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.lcs-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--lcs-radius-xs);
  background: var(--lumiverse-bg-elevated, rgba(28, 26, 40, 0.85));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--lumiverse-text-muted, rgba(230,230,240,0.6));
  cursor: pointer;
  transition:
    color var(--lcs-transition-fast),
    background var(--lcs-transition-fast);
  font-size: 13px;
  line-height: 1;
  padding: 0;
}

.lcs-action-btn:hover {
  color: var(--lumiverse-text, rgba(230,230,240,0.92));
  background: var(--lumiverse-fill-hover, rgba(255,255,255,0.12));
}

.lcs-action-btn--danger:hover {
  color: var(--lumiverse-danger, #ef4444);
  background: var(--lumiverse-danger-010, rgba(239, 68, 68, 0.1));
}

/* ═══════════════════════════════════════════════════════════════════════
   SWIPE CONTROLS
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-swipe {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 4px 0 0;
  margin-top: 4px;
}

.lcs-swipe-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--lcs-glass-border);
  border-radius: 50%;
  background: var(--lumiverse-fill-subtle, rgba(255,255,255,0.04));
  color: var(--lumiverse-text-muted, rgba(230,230,240,0.55));
  cursor: pointer;
  transition:
    color var(--lcs-transition-fast),
    background var(--lcs-transition-fast),
    border-color var(--lcs-transition-fast);
  font-size: 12px;
  padding: 0;
}

.lcs-swipe-btn:hover {
  color: var(--lumiverse-text, rgba(230,230,240,0.92));
  background: var(--lumiverse-fill-hover, rgba(255,255,255,0.1));
  border-color: var(--lcs-glass-border-hover);
}

.lcs-swipe-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.lcs-swipe-counter {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--lumiverse-text-dim, rgba(230,230,240,0.4));
  min-width: 36px;
  text-align: center;
  user-select: none;
}

/* ═══════════════════════════════════════════════════════════════════════
   INPUT AREA
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-input-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 14px 10px;
  margin: 0 12px 12px;
  background: var(--lumiverse-bg-elevated, rgba(22, 20, 34, 0.75));
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid var(--lcs-glass-border);
  border-radius: var(--lcs-radius);
  box-shadow: 0 -2px 20px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.12), inset 0 0.5px 0 rgba(255,255,255,0.06);
  flex-shrink: 0;
  position: relative;
  z-index: 20;
  transition: background var(--lcs-transition), border-color var(--lcs-transition), box-shadow var(--lcs-transition);
}

/* ── Action Bar (regenerate, continue, impersonate, close) ── */

.lcs-action-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 2px;
}

.lcs-action-bar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 26px;
  border: none;
  border-radius: var(--lcs-radius-xs);
  background: transparent;
  color: var(--lumiverse-text-dim, rgba(230,230,240,0.4));
  cursor: pointer;
  transition:
    color var(--lcs-transition-fast),
    background var(--lcs-transition-fast);
  padding: 0;
}

.lcs-action-bar-btn:hover {
  color: var(--lumiverse-text, rgba(230,230,240,0.92));
  background: var(--lumiverse-fill, rgba(255,255,255,0.06));
}

.lcs-action-bar-btn--stop {
  color: var(--lumiverse-danger, #ef4444);
}
.lcs-action-bar-btn--stop:hover {
  color: #fff;
  background: var(--lumiverse-danger, #ef4444);
}

.lcs-action-bar-btn--close {
  margin-left: auto;
}
.lcs-action-bar-btn--close:hover {
  color: var(--lumiverse-danger, #ef4444);
  background: var(--lumiverse-danger-010, rgba(239, 68, 68, 0.1));
}

/* ── Input Row (textarea + send) ── */

.lcs-input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.lcs-input-wrapper {
  flex: 1;
  display: flex;
  align-items: flex-end;
  min-height: 40px;
  max-height: 180px;
  border-radius: var(--lcs-radius);
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.08));
  background: var(--lumiverse-fill-subtle, rgba(255,255,255,0.04));
  transition:
    border-color var(--lcs-transition),
    background var(--lcs-transition),
    box-shadow var(--lcs-transition);
  overflow: hidden;
}

.lcs-input-wrapper:focus-within {
  border-color: var(--lumiverse-primary-040, rgba(140, 130, 255, 0.4));
  background: var(--lumiverse-fill, rgba(255,255,255,0.06));
  box-shadow: 0 0 0 2px var(--lumiverse-primary-010, rgba(140, 130, 255, 0.1));
}

.lcs-textarea {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--lumiverse-text, rgba(230,230,240,0.92));
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  padding: 9px 14px;
  min-height: 40px;
  max-height: 180px;
  overflow-y: auto;
}

.lcs-textarea::placeholder {
  color: var(--lumiverse-text-dim, rgba(230,230,240,0.3));
}

.lcs-textarea::-webkit-scrollbar { width: 3px; }
.lcs-textarea::-webkit-scrollbar-thumb {
  background: var(--lcs-scrollbar-thumb);
  border-radius: 4px;
}

.lcs-send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: var(--lcs-radius);
  background: var(--lumiverse-primary, rgba(140, 130, 255, 0.9));
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background var(--lcs-transition-fast),
    transform var(--lcs-transition-fast),
    opacity var(--lcs-transition-fast);
  font-size: 16px;
  padding: 0;
}

.lcs-send-btn:hover {
  background: var(--lumiverse-primary-hover, rgba(160, 150, 255, 0.95));
  transform: scale(1.04);
}

.lcs-send-btn:active {
  transform: scale(0.96);
}

.lcs-send-btn:disabled {
  opacity: 0.35;
  cursor: default;
  transform: none;
}

.lcs-send-btn--stop {
  background: var(--lumiverse-danger, #ef4444);
}
.lcs-send-btn--stop:hover {
  background: var(--lumiverse-danger-hover, #dc2626);
}

/* ═══════════════════════════════════════════════════════════════════════
   STREAMING INDICATOR
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-streaming {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 0 2px;
}

.lcs-streaming-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--lumiverse-primary, rgba(140, 130, 255, 0.9));
  animation: lcs-bounce 1.2s ease-in-out infinite;
}

.lcs-streaming-dot:nth-child(2) { animation-delay: 0.15s; }
.lcs-streaming-dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes lcs-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-5px); opacity: 1; }
}

/* ═══════════════════════════════════════════════════════════════════════
   SCROLL-TO-BOTTOM FAB
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-scroll-fab {
  position: absolute;
  bottom: 120px;
  right: 18px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid var(--lcs-glass-border);
  background: var(--lumiverse-bg-elevated, rgba(28, 26, 40, 0.85));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--lumiverse-text-muted, rgba(230,230,240,0.6));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 15;
  box-shadow: var(--lumiverse-shadow-md, 0 8px 24px rgba(0,0,0,0.2));
  transition:
    opacity var(--lcs-transition),
    transform var(--lcs-transition),
    color var(--lcs-transition-fast),
    background var(--lcs-transition-fast);
  font-size: 16px;
  padding: 0;
}

.lcs-scroll-fab:hover {
  color: var(--lumiverse-text, rgba(230,230,240,0.92));
  background: var(--lumiverse-fill-hover, rgba(255,255,255,0.12));
  transform: scale(1.06);
}

.lcs-scroll-fab--hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateY(8px) scale(0.9);
}

/* ═══════════════════════════════════════════════════════════════════════
   REASONING BLOCK (collapsible thinking)
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-reasoning {
  margin: 6px 0 4px;
  border-radius: var(--lcs-radius-sm);
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.06));
  overflow: hidden;
  font-size: 0.88em;
}

.lcs-reasoning-toggle {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 7px 12px;
  border: none;
  background: var(--lumiverse-fill-subtle, rgba(255,255,255,0.03));
  color: var(--lumiverse-text-muted, rgba(230,230,240,0.6));
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-align: left;
  font-family: inherit;
  transition:
    background var(--lcs-transition-fast),
    color var(--lcs-transition-fast);
}

.lcs-reasoning-toggle:hover {
  background: var(--lumiverse-fill, rgba(255,255,255,0.06));
  color: var(--lumiverse-text, rgba(230,230,240,0.9));
}

.lcs-reasoning-chevron {
  transition: transform var(--lcs-transition);
  flex-shrink: 0;
}

.lcs-reasoning-chevron--open {
  transform: rotate(90deg);
}

.lcs-reasoning-body {
  padding: 10px 12px;
  color: var(--lumiverse-text-muted, rgba(230,230,240,0.65));
  line-height: 1.55;
  border-top: 1px solid var(--lumiverse-border, rgba(255,255,255,0.04));
  background: var(--lumiverse-fill-subtle, rgba(255,255,255,0.015));
  max-height: 400px;
  overflow-y: auto;
}

/* Markdown prose inside reasoning body */
.lcs-reasoning-body p { margin: 0 0 0.5em; }
.lcs-reasoning-body p:last-child { margin-bottom: 0; }
.lcs-reasoning-body strong { font-weight: 600; color: var(--lumiverse-text, rgba(230,230,240,0.85)); }
.lcs-reasoning-body em { font-style: italic; }
.lcs-reasoning-body code {
  font-family: 'SF Mono', 'Fira Code', Menlo, Consolas, monospace;
  font-size: 0.88em;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--lumiverse-fill, rgba(255,255,255,0.06));
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.06));
}
.lcs-reasoning-body pre {
  margin: 6px 0;
  padding: 10px 12px;
  border-radius: var(--lcs-radius-xs);
  background: var(--lumiverse-bg-deep, rgba(10, 8, 18, 0.9));
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.06));
  overflow-x: auto;
  font-size: 0.88em;
  line-height: 1.5;
  white-space: pre;
}
.lcs-reasoning-body pre code {
  padding: 0;
  border: none;
  background: none;
  color: var(--lumiverse-text, rgba(230,230,240,0.8));
}
.lcs-reasoning-body ul, .lcs-reasoning-body ol {
  padding-left: 1.3em;
  margin: 4px 0;
}
.lcs-reasoning-body li { margin-bottom: 2px; }
.lcs-reasoning-body blockquote {
  margin: 4px 0;
  padding: 4px 12px;
  border-left: 2px solid var(--lumiverse-primary-030, rgba(140, 130, 255, 0.3));
  color: var(--lumiverse-text-dim, rgba(230,230,240,0.5));
  font-style: italic;
}
.lcs-reasoning-body h1, .lcs-reasoning-body h2, .lcs-reasoning-body h3,
.lcs-reasoning-body h4, .lcs-reasoning-body h5, .lcs-reasoning-body h6 {
  margin: 0.65em 0 0.3em;
  color: var(--lumiverse-text, rgba(230,230,240,0.92));
  font-weight: 600;
  line-height: 1.3;
  white-space: normal;
}
.lcs-reasoning-body h1:first-child, .lcs-reasoning-body h2:first-child,
.lcs-reasoning-body h3:first-child { margin-top: 0; }
.lcs-reasoning-body h1 { font-size: 1.4em; }
.lcs-reasoning-body h2 { font-size: 1.25em; }
.lcs-reasoning-body h3 { font-size: 1.15em; }
.lcs-reasoning-body h4 { font-size: 1.05em; }
.lcs-reasoning-body h5 { font-size: 0.95em; }
.lcs-reasoning-body h6 { font-size: 0.9em; color: var(--lumiverse-text-muted, rgba(230,230,240,0.7)); }

/* Animated expand/collapse wrapper (CSS grid row trick) */
.lcs-reasoning-body-wrap {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.lcs-reasoning-body-wrap--open {
  grid-template-rows: 1fr;
  opacity: 1;
}
.lcs-reasoning-body-overflow {
  overflow: hidden;
}

/* ═══════════════════════════════════════════════════════════════════════
   LOAD MORE SENTINEL
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  min-height: 42px;
}

.lcs-load-more-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--lumiverse-fill, rgba(255,255,255,0.06));
  border-top-color: var(--lumiverse-primary-050, rgba(140, 130, 255, 0.5));
  border-radius: 50%;
  animation: lcs-spin 0.75s linear infinite;
}

@keyframes lcs-spin {
  to { transform: rotate(360deg); }
}

/* ═══════════════════════════════════════════════════════════════════════
   LOADING SKELETON (shown by service layer before React mounts)
   ═══════════════════════════════════════════════════════════════════════ */

#lcs-loading-skeleton {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  height: 100%;
  position: relative;
}

#lcs-loading-skeleton .lcs-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.lcs-skeleton-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--lumiverse-fill, rgba(255,255,255,0.06));
  border-top-color: var(--lumiverse-primary-050, rgba(140, 130, 255, 0.5));
  border-radius: 50%;
  animation: lcs-spin 0.75s linear infinite;
}

.lcs-skeleton-label {
  margin-top: 14px;
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  color: var(--lumiverse-text-050, rgba(255,255,255,0.5));
  font-family: var(--lumiverse-font, inherit);
}

.lcs-skeleton-joke {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 14px;
  font-style: italic;
  color: var(--lumiverse-text, rgba(255,255,255,0.7));
  max-width: 80%;
  text-align: center;
  pointer-events: none;
  line-height: 1.4;
  opacity: 0.75;
}

.lcs-skeleton-joke:empty {
  display: none;
}

/* ═══════════════════════════════════════════════════════════════════════
   BOOKMARK INDICATOR
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-bookmark {
  position: absolute;
  top: 0;
  right: 16px;
  font-size: 14px;
  color: var(--lumiverse-warning-060, rgba(245, 158, 11, 0.6));
  pointer-events: none;
}

.lcs-message--user .lcs-bookmark {
  right: auto;
  left: 16px;
}

/* ═══════════════════════════════════════════════════════════════════════
   SUMMARY MARKERS
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-summary-marker {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  vertical-align: middle;
}

.lcs-summary-icon {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
}

.lcs-summary-marker--complete {
  color: var(--lumiverse-primary-text, rgba(160, 150, 255, 0.95));
  opacity: 0.7;
}
.lcs-summary-marker--complete:hover { opacity: 1; }

.lcs-summary-marker--error {
  color: var(--lumiverse-danger, #ef4444);
  opacity: 0.7;
}

.lcs-summary-marker--loading {
  color: var(--lumiverse-primary, rgba(140, 130, 255, 0.9));
}

.lcs-summary-spinner {
  animation: lcs-spin 0.75s linear infinite;
}

/* ═══════════════════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 10px;
  padding: 40px 20px;
  color: var(--lumiverse-text-dim, rgba(230,230,240,0.35));
  text-align: center;
}

.lcs-empty-icon {
  font-size: 32px;
  opacity: 0.4;
  margin-bottom: 4px;
}

.lcs-empty-text {
  font-size: 14px;
  max-width: 260px;
  line-height: 1.5;
}

/* ═══════════════════════════════════════════════════════════════════════
   RESPONSIVE
   ═══════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .lcs-app {
    font-size: 14px;
  }

  .lcs-app .lcs-header {
    padding: 8px 12px !important;
    min-height: 46px !important;
  }

  .lcs-scroll-container {
    padding: 6px 8px 12px;
  }

  .lcs-message {
    padding: 10px 12px;
    border-radius: 10px;
  }

  .lcs-message-avatar {
    width: 30px;
    height: 30px;
  }

  .lcs-message-name { font-size: 12px; }
  .lcs-message-timestamp { font-size: 10px; }

  /* ── Mobile input area — larger touch targets ── */
  .lcs-input-area {
    padding: 10px 12px 14px;
    gap: 8px;
  }

  .lcs-action-bar {
    gap: 4px;
  }

  .lcs-action-bar-btn {
    width: 38px;
    height: 34px;
    border-radius: 8px;
  }

  .lcs-input-wrapper {
    min-height: 46px;
  }

  .lcs-textarea {
    font-size: 16px; /* Prevents iOS zoom on focus */
    min-height: 46px;
    padding: 12px 14px;
  }

  .lcs-send-btn {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    font-size: 18px;
  }

  .lcs-batch-bar {
    padding: 10px 12px;
    gap: 10px;
  }

  .lcs-batch-bar-text {
    font-size: 13px;
  }

  .lcs-scroll-fab {
    bottom: 130px;
    right: 12px;
    width: 38px;
    height: 38px;
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .lcs-message-header { gap: 7px; }
  .lcs-message { padding: 8px 10px; }
  .lcs-message--character .lcs-message-content,
  .lcs-message--character .lcs-message-header {
    padding-left: 6px;
  }
  .lcs-message--user .lcs-message-content,
  .lcs-message--user .lcs-message-header {
    padding-right: 6px;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   REDUCED MOTION
   ═══════════════════════════════════════════════════════════════════════ */

@media (prefers-reduced-motion: reduce) {
  .lcs-app {
    --lcs-transition: 0ms;
    --lcs-transition-fast: 0ms;
  }

  .lcs-streaming-dot,
  .lcs-load-more-spinner,
  .lcs-header-status--streaming {
    animation: none;
  }

  .lcs-streaming-dot { opacity: 0.7; }
  .lcs-load-more-spinner { border-top-color: var(--lumiverse-primary, rgba(140, 130, 255, 0.9)); }
}

/* ═══════════════════════════════════════════════════════════════════════
   TOKEN BADGE
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-token-badge {
  display: inline-block;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--lumiverse-text-dim, rgba(230,230,240,0.3));
  padding: 1px 4px;
  border-radius: 3px;
  background: transparent;
  margin-left: 6px;
  cursor: pointer;
  transition: color var(--lcs-transition-fast), background var(--lcs-transition-fast);
  user-select: none;
}

.lcs-token-badge:hover {
  color: var(--lumiverse-text-muted, rgba(230,230,240,0.55));
  background: var(--lumiverse-fill-subtle, rgba(255,255,255,0.04));
}

/* ═══════════════════════════════════════════════════════════════════════
   TOOLS MENU DROPDOWN
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-tools-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 14px;
  min-width: 200px;
  padding: 5px;
  border-radius: var(--lcs-radius);
  background: color-mix(in srgb, var(--lcs-page-bg, #0a0a0c) 92%, white 8%);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: 1px solid var(--lcs-glass-border-hover, rgba(255,255,255,0.1));
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 0 1px var(--lumiverse-border, rgba(255,255,255,0.06));
  z-index: 30;
  animation: lcs-tools-enter 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes lcs-tools-enter {
  from { opacity: 0; transform: translateY(4px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.lcs-tools-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: var(--lcs-radius-sm);
  background: transparent;
  color: var(--lumiverse-text-muted, rgba(230,230,240,0.7));
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--lcs-transition-fast), color var(--lcs-transition-fast);
  text-align: left;
}

.lcs-tools-menu-item:hover {
  color: var(--lumiverse-text, rgba(230,230,240,0.92));
  background: var(--lumiverse-fill, rgba(255,255,255,0.06));
}

.lcs-tools-menu-item--danger:hover {
  color: var(--lumiverse-danger, #ef4444);
  background: var(--lumiverse-danger-010, rgba(239, 68, 68, 0.1));
}

.lcs-tools-menu-divider {
  height: 1px;
  margin: 4px 8px;
  background: var(--lumiverse-border, rgba(255,255,255,0.06));
}

/* ═══════════════════════════════════════════════════════════════════════
   BATCH DELETE MODE
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--lcs-radius-sm);
  background: var(--lumiverse-danger-010, rgba(239, 68, 68, 0.08));
  border: 1px solid var(--lumiverse-danger-020, rgba(239, 68, 68, 0.2));
  flex-wrap: wrap;
  min-height: 36px;
}

.lcs-batch-bar-text {
  font-size: 12px;
  color: var(--lumiverse-text-muted, rgba(230,230,240,0.7));
  padding: 2px 4px;
  flex: 1 1 auto;
  min-width: 0;
}

.lcs-batch-bar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.lcs-action-bar-btn--delete {
  color: var(--lumiverse-danger, #ef4444);
  min-width: fit-content;
}
.lcs-action-bar-btn--delete:hover {
  color: #fff;
  background: var(--lumiverse-danger, #ef4444);
}
.lcs-action-bar-btn--delete:disabled {
  opacity: 0.35;
  cursor: default;
}

.lcs-message--batch-marked {
  border-color: var(--lumiverse-danger-030, rgba(239, 68, 68, 0.3)) !important;
  background: linear-gradient(
    135deg,
    rgba(239, 68, 68, 0.06) 0%,
    transparent 60%
  ), var(--lcs-glass-bg) !important;
}

.lcs-message--batch-cutpoint {
  border-color: var(--lumiverse-danger-050, rgba(239, 68, 68, 0.5)) !important;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.15) !important;
}

.lcs-message--batch-marked::before {
  background: var(--lumiverse-danger, #ef4444) !important;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.3) !important;
  opacity: 0.7 !important;
}

.lcs-message--batch-cutpoint::before {
  opacity: 1 !important;
  box-shadow: 0 0 14px rgba(239, 68, 68, 0.5) !important;
}

/* ═══════════════════════════════════════════════════════════════════════
   STREAMING — Per-Chunk Text Fade-In
   New tokens fade in as they arrive, zero DOM overhead when streaming ends.
   ═══════════════════════════════════════════════════════════════════════ */

@keyframes lcs-chunk-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.lcs-chunk-fade {
  animation: lcs-chunk-fade 180ms ease-out both;
}

/* ═══════════════════════════════════════════════════════════════════════
   IMMERSIVE MODE — Large Blended Avatars & Depth
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-immersive .lcs-message {
  position: relative;
  overflow: hidden;
}

/* ── Large Avatar Background ───────────────────────────────────────── */
.lcs-immersive-avatar-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 50%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.lcs-immersive-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  mask-image: linear-gradient(to right, rgba(0,0,0,0.6) 0%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, rgba(0,0,0,0.6) 0%, transparent 100%);
  filter: saturate(0.8);
  opacity: 0.48;
  transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.lcs-immersive .lcs-message:hover .lcs-immersive-avatar-img {
  opacity: 0.54;
}

/* User messages: avatar on right, subtler mask */
.lcs-immersive .lcs-message--user .lcs-immersive-avatar-bg {
  left: auto;
  right: 0;
}
.lcs-immersive .lcs-message--user .lcs-immersive-avatar-img {
  mask-image: linear-gradient(to left, rgba(0,0,0,0.55) 0%, transparent 100%);
  -webkit-mask-image: linear-gradient(to left, rgba(0,0,0,0.55) 0%, transparent 100%);
  opacity: 0.52;
}

/* ── Content Repositioning ──────────────────────────────────────────── */
.lcs-immersive .lcs-message-header,
.lcs-immersive .lcs-message-content,
.lcs-immersive .lcs-message-actions,
.lcs-immersive .lcs-swipe-controls,
.lcs-immersive .lcs-reasoning,
.lcs-immersive .lcs-bookmark,
.lcs-immersive .lcs-token-badge {
  position: relative;
  z-index: 1;
}

/* Hide small header avatar in immersive mode — the large bg avatar replaces it */
.lcs-immersive .lcs-message-avatar {
  display: none;
}

/* Immersive: larger character name */
.lcs-immersive .lcs-message-name {
  font-size: 15px;
  font-weight: 700;
}

/* Immersive: transparent action buttons */
.lcs-immersive .lcs-action-btn {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.lcs-immersive .lcs-action-btn:hover {
  background: var(--lumiverse-fill, rgba(255,255,255,0.08));
}

/* Immersive: frosted glass reasoning accordion */
.lcs-immersive .lcs-reasoning {
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.08);
}
.lcs-immersive .lcs-reasoning-toggle {
  background: transparent;
  font-size: 12.5px;
}
.lcs-immersive .lcs-reasoning-body {
  background: rgba(255,255,255,0.02);
  border-top-color: rgba(255,255,255,0.06);
}

/* Immersive: message number badge — top-right corner */
.lcs-immersive-mesid {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 2;
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--lumiverse-text-muted, rgba(230,230,240,0.35));
  pointer-events: none;
  letter-spacing: 0.02em;
  opacity: 0.6;
  transition: opacity var(--lcs-transition-fast);
}
.lcs-immersive .lcs-message:hover .lcs-immersive-mesid {
  opacity: 1;
}

/* Immersive: hide accent bars — tinted card backgrounds provide differentiation */
.lcs-immersive .lcs-message::before {
  display: none;
}

/* ── Floating Depth Elements (assistant only) ──────────────────────── */
.lcs-immersive-depth {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

/* Soft radial gradient orb */
.lcs-immersive-depth::before {
  content: '';
  position: absolute;
  top: 10%;
  left: 5%;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--lumiverse-primary-010, rgba(140, 130, 255, 0.06)) 0%, transparent 70%);
  animation: lcs-float-orb 8s ease-in-out infinite alternate;
  will-change: transform;
}

/* Faint geometric border shape */
.lcs-immersive-depth::after {
  content: '';
  position: absolute;
  bottom: 15%;
  right: 8%;
  width: 50px;
  height: 50px;
  border: 1px solid var(--lumiverse-primary-010, rgba(140, 130, 255, 0.04));
  border-radius: 6px;
  transform: rotate(15deg);
  animation: lcs-float-geo 10s ease-in-out infinite alternate-reverse;
  will-change: transform;
}

@keyframes lcs-float-orb {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(12px, -8px) scale(1.1); }
}

@keyframes lcs-float-geo {
  0% { transform: rotate(15deg) translate(0, 0); }
  100% { transform: rotate(25deg) translate(-6px, 6px); }
}

/* ── System Message Pass-Through ───────────────────────────────────── */
.lcs-immersive .lcs-message--system .lcs-immersive-avatar-bg,
.lcs-immersive .lcs-message--system .lcs-immersive-depth {
  display: none;
}

/* ── Reduced Motion for Immersive ──────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .lcs-chunk-fade {
    animation: none;
  }
  .lcs-immersive-depth::before,
  .lcs-immersive-depth::after {
    animation: none;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   BUBBLE MODE — Cinematic Chat Bubbles
   Signature: dissolving avatar backgrounds, squircle thumbnails,
   glassmorphic meta pills, wider cards with generous padding.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Card Overrides ───────────────────────────────────────────────── */
.lcs-bubble .lcs-message {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  padding: 0;
  border: none;
  background:
    linear-gradient(145deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.007) 40%, rgba(255,255,255,0.013) 100%),
    var(--lcs-glass-bg);
  backdrop-filter: blur(40px) saturate(1.2);
  -webkit-backdrop-filter: blur(40px) saturate(1.2);
  box-shadow:
    0 0 0 0.5px var(--lcs-glass-border),
    0 1px 2px rgba(0,0,0,0.25),
    0 4px 12px rgba(0,0,0,0.18),
    0 16px 48px rgba(0,0,0,0.10),
    inset 0 0.5px 0 rgba(255,255,255,0.04);
}

.lcs-bubble .lcs-message:hover {
  box-shadow:
    0 0 0 0.5px var(--lcs-glass-border-hover),
    0 1px 2px rgba(0,0,0,0.28),
    0 4px 16px rgba(0,0,0,0.22),
    0 20px 56px rgba(0,0,0,0.12),
    inset 0 0.5px 0 rgba(255,255,255,0.06);
  background:
    linear-gradient(145deg, rgba(255,255,255,0.028) 0%, rgba(255,255,255,0.01) 40%, rgba(255,255,255,0.018) 100%),
    var(--lcs-glass-bg-hover);
}

/* Bottom specular highlight */
.lcs-bubble .lcs-message::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 12%;
  right: 12%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
  pointer-events: none;
  z-index: 2;
}

/* Hide accent bars — the bubble itself is the visual anchor */
.lcs-bubble .lcs-message::before {
  display: none;
}

/* ── Character variant tint ── */
.lcs-bubble .lcs-message--character {
  background:
    linear-gradient(145deg, var(--lcs-glass-char-tint) 0%, transparent 40%),
    linear-gradient(145deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.007) 40%, rgba(255,255,255,0.013) 100%),
    var(--lcs-glass-bg);
}

/* ── User variant tint ── */
.lcs-bubble .lcs-message--user {
  background:
    linear-gradient(225deg, var(--lcs-glass-user-tint) 0%, transparent 40%),
    linear-gradient(145deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.007) 40%, rgba(255,255,255,0.013) 100%),
    var(--lcs-glass-bg);
}

/* System stays compact */
.lcs-bubble .lcs-message--system {
  border-radius: var(--lcs-radius);
  padding: 8px 16px;
  background: var(--lumiverse-fill-subtle, rgba(255,255,255,0.03));
  box-shadow: none;
  border: 1px solid transparent;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.lcs-bubble .lcs-message--system::after { display: none; }

/* ── Content wrapper zone — z-index above avatar bg ──
   NOTE: .lcs-message-actions is EXCLUDED — it must keep base
   position: absolute for top-right hover reveal. */
.lcs-bubble .lcs-message-header,
.lcs-bubble .lcs-message-content,
.lcs-bubble .lcs-swipe,
.lcs-bubble .lcs-reasoning,
.lcs-bubble .lcs-bookmark {
  position: relative;
  z-index: 1;
}

/* ── Dissolving Avatar Background ─────────────────────────────────── */
.lcs-bubble-avatar-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 50%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  mask-image:
    linear-gradient(to right, black 0%, black 25%, transparent 90%),
    linear-gradient(to bottom, black 0%, black 55%, transparent 100%),
    linear-gradient(to top, black 0%, black 85%, transparent 100%);
  mask-composite: intersect;
  -webkit-mask-image:
    linear-gradient(to right, black 0%, black 25%, transparent 90%),
    linear-gradient(to bottom, black 0%, black 55%, transparent 100%),
    linear-gradient(to top, black 0%, black 85%, transparent 100%);
  -webkit-mask-composite: source-in;
}

/* User messages: dissolve from right */
.lcs-bubble .lcs-message--user .lcs-bubble-avatar-bg {
  left: auto;
  right: 0;
  mask-image:
    linear-gradient(to left, black 0%, black 25%, transparent 90%),
    linear-gradient(to bottom, black 0%, black 55%, transparent 100%),
    linear-gradient(to top, black 0%, black 85%, transparent 100%);
  -webkit-mask-image:
    linear-gradient(to left, black 0%, black 25%, transparent 90%),
    linear-gradient(to bottom, black 0%, black 55%, transparent 100%),
    linear-gradient(to top, black 0%, black 85%, transparent 100%);
}

.lcs-bubble-avatar-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  opacity: 0.38;
  transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.lcs-bubble .lcs-message:hover .lcs-bubble-avatar-img {
  opacity: 0.44;
}

/* Inner scrim for text readability */
.lcs-bubble-avatar-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to right,
    var(--lcs-page-bg, #0a0a0c) 0%,
    color-mix(in srgb, var(--lcs-page-bg, #0a0a0c) 50%, transparent) 60%,
    color-mix(in srgb, var(--lcs-page-bg, #0a0a0c) 70%, transparent) 100%
  );
  pointer-events: none;
}

.lcs-bubble .lcs-message--user .lcs-bubble-avatar-scrim {
  background: linear-gradient(
    to left,
    var(--lcs-page-bg, #0a0a0c) 0%,
    color-mix(in srgb, var(--lcs-page-bg, #0a0a0c) 50%, transparent) 60%,
    color-mix(in srgb, var(--lcs-page-bg, #0a0a0c) 70%, transparent) 100%
  );
}

/* ── Bubble Header ─────────────────────────────────────────────────── */
.lcs-bubble-header {
  display: flex !important;
  align-items: flex-start !important;
  justify-content: space-between;
  padding: 20px 24px 0 !important;
  gap: 12px;
  margin-bottom: 0 !important;
}

.lcs-bubble-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

/* ── Squircle Avatar ───────────────────────────────────────────────── */
.lcs-bubble .lcs-message-avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  flex-shrink: 0;
  background: rgba(255,255,255,0.05);
  box-shadow:
    0 0 0 0.5px rgba(255,255,255,0.08),
    0 2px 8px rgba(0,0,0,0.3);
  border: none;
}

.lcs-bubble .lcs-message-avatar--placeholder {
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
}

/* ── Name Styling ──────────────────────────────────────────────────── */
.lcs-bubble .lcs-message-name {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.2;
  color: var(--lumiverse-text, #ffffff);
}

.lcs-bubble .lcs-message--character .lcs-message-name {
  color: var(--lumiverse-text, #ffffff);
}

/* Prevent flex column from stretching inline-flex pill to full width */
.lcs-bubble .lcs-message-meta {
  align-items: flex-start;
}

/* ── Meta Pill ─────────────────────────────────────────────────────── */
.lcs-bubble-meta-pill {
  display: inline-flex;
  align-items: center;
  margin-top: 5px;
  padding: 3px 10px;
  border-radius: 16px;
  font-size: 11px;
  font-family: ui-monospace, 'SF Mono', SFMono-Regular, 'Cascadia Code', Menlo, Consolas, monospace;
  color: var(--lumiverse-text-dim, rgba(255,255,255,0.5));
  letter-spacing: 0.02em;
  flex-wrap: wrap;
  gap: 0;
  background: rgba(0,0,0,0.1);
  backdrop-filter: blur(16px) brightness(0.45) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) brightness(0.45) saturate(1.4);
  border: 1px solid rgba(255,255,255,0.05);
  line-height: 1;
}

.lcs-bubble-meta-dot {
  margin: 0 6px;
  opacity: 0.35;
}

/* ── Message Content Padding ───────────────────────────────────────── */
.lcs-bubble .lcs-message-content {
  padding: 16px 24px 22px !important;
}

.lcs-bubble .lcs-message--system .lcs-message-content {
  padding: 0 4px !important;
}

/* ── Actions — Glassmorphic Utility Bar (top-right on hover) ───────── */
/* The container IS the glassmorphic pill; buttons inside are transparent. */
.lcs-bubble .lcs-message-actions {
  position: absolute;
  top: 20px;
  right: 24px;
  z-index: 5;
  gap: 1px;
  padding: 2px 3px;
  background: rgba(0,0,0,0.1);
  backdrop-filter: blur(16px) brightness(0.45) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) brightness(0.45) saturate(1.4);
  border-radius: 9px;
  border: 1px solid rgba(255,255,255,0.05);
}

.lcs-bubble .lcs-message--user .lcs-message-actions {
  left: 24px;
  right: auto;
}

.lcs-bubble .lcs-action-btn {
  width: 26px;
  height: 26px;
  background: transparent;
  border: none;
  border-radius: 6px;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  color: rgba(255,255,255,0.4);
}

.lcs-bubble .lcs-action-btn:hover {
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.7);
  border: none;
}

/* ── Reasoning — Compact Glassmorphic Pill ─────────────────────────── */
/* Outer wrapper is bare — the toggle and body each get their own glass surface */
.lcs-bubble .lcs-reasoning {
  margin: 14px 24px 0;
  border: none;
  background: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  overflow: visible;
  border-radius: 0;
}

.lcs-bubble .lcs-reasoning-toggle {
  width: auto;
  display: inline-flex;
  padding: 4px 11px;
  background: rgba(0,0,0,0.1);
  backdrop-filter: blur(16px) brightness(0.45) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) brightness(0.45) saturate(1.4);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  font-family: ui-monospace, 'SF Mono', SFMono-Regular, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 11.5px;
  letter-spacing: 0.02em;
  color: var(--lumiverse-text-dim, rgba(255,255,255,0.5));
  line-height: 1;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.lcs-bubble .lcs-reasoning-toggle:hover {
  background: rgba(0,0,0,0.15);
  border-color: rgba(255,255,255,0.1);
}

.lcs-bubble .lcs-reasoning-body {
  margin-top: 10px;
  padding: 10px 14px;
  background: rgba(0,0,0,0.1);
  backdrop-filter: blur(16px) brightness(0.45) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) brightness(0.45) saturate(1.4);
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.05);
  border-top: 1px solid rgba(255,255,255,0.05);
  font-family: ui-monospace, 'SF Mono', SFMono-Regular, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--lumiverse-text-dim, rgba(255,255,255,0.45));
}

/* ── Swipe Controls — Glassmorphic Footer Pill ─────────────────────── */
/* align-self: flex-end right-aligns within the column flex parent (.lcs-message).
   The pill auto-sizes to content width. */
.lcs-bubble .lcs-swipe {
  align-self: flex-end;
  margin: 0 24px 18px 0;
  padding: 2px 4px;
  gap: 2px;
  border-radius: 16px;
  background: rgba(0,0,0,0.1);
  backdrop-filter: blur(16px) brightness(0.45) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) brightness(0.45) saturate(1.4);
  border: 1px solid rgba(255,255,255,0.05);
  font-family: ui-monospace, 'SF Mono', SFMono-Regular, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  letter-spacing: 0.04em;
}

.lcs-bubble .lcs-swipe-btn {
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: rgba(255,255,255,0.5);
}

.lcs-bubble .lcs-swipe-btn:hover {
  background: rgba(255,255,255,0.08);
}

.lcs-bubble .lcs-swipe-btn:disabled {
  color: rgba(255,255,255,0.15);
}

.lcs-bubble .lcs-swipe-counter {
  min-width: 32px;
  text-align: center;
  user-select: none;
  font-size: inherit;
  color: inherit;
  letter-spacing: inherit;
}

/* ── Bookmark ──────────────────────────────────────────────────────── */
.lcs-bubble .lcs-bookmark {
  top: 4px;
  right: 20px;
}
.lcs-bubble .lcs-message--user .lcs-bookmark {
  left: 20px;
  right: auto;
}

/* ── User Header Direction ─────────────────────────────────────────── */
.lcs-bubble .lcs-message--user .lcs-bubble-header {
  flex-direction: row-reverse;
}
.lcs-bubble .lcs-message--user .lcs-bubble-header-left {
  flex-direction: row-reverse;
}
.lcs-bubble .lcs-message--user .lcs-message-meta {
  align-items: flex-end;
}
.lcs-bubble .lcs-message--user .lcs-message-content {
  text-align: right;
}

/* ── Responsive ────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .lcs-bubble .lcs-message {
    border-radius: 14px;
  }

  .lcs-bubble-header {
    padding: 16px 16px 0 !important;
  }

  .lcs-bubble .lcs-message-content {
    padding: 12px 16px 16px !important;
  }

  .lcs-bubble .lcs-message-avatar {
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }

  .lcs-bubble .lcs-message-name {
    font-size: 17px;
  }

  .lcs-bubble .lcs-swipe {
    margin: 0 16px 14px 0;
  }

  .lcs-bubble .lcs-message-actions {
    top: 16px;
    right: 16px;
  }
  .lcs-bubble .lcs-message--user .lcs-message-actions {
    left: 16px;
  }

  .lcs-bubble .lcs-reasoning {
    margin: 10px 16px 0;
  }

  .lcs-bubble .lcs-reasoning {
    margin: 0 16px 0;
  }
}

@media (max-width: 480px) {
  .lcs-bubble-header {
    padding: 12px 12px 0 !important;
  }
  .lcs-bubble .lcs-message-content {
    padding: 10px 12px 14px !important;
  }
  .lcs-bubble .lcs-message-name {
    font-size: 15px;
  }
  .lcs-bubble .lcs-reasoning {
    margin: 8px 12px 0;
  }
  .lcs-bubble .lcs-swipe {
    margin: 0 12px 14px 0;
  }
}

/* ── Reduced Motion for Bubble ─────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .lcs-bubble-avatar-img {
    transition: none;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   EDIT MODE
   Inline editing UI — glassmorphic textareas with save/cancel actions
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-edit-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px 14px;
  margin: 0;
  position: relative;
  z-index: 2;
}

.lcs-edit-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--lumiverse-text-dim, rgba(255,255,255,0.45));
  margin: 0 0 2px 2px;
}

.lcs-edit-textarea {
  width: 100%;
  min-height: 60px;
  max-height: 45em;
  padding: 10px 12px;
  border-radius: var(--lcs-radius-sm, 8px);
  border: 1px solid var(--lcs-glass-border, rgba(255,255,255,0.06));
  background: var(--lcs-glass-bg, rgba(18,16,28,0.55));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--lumiverse-text, rgba(255,255,255,0.92));
  font-family: inherit;
  font-size: 14px;
  line-height: 1.55;
  resize: none;
  overflow-y: auto;
  outline: none;
  transition: border-color var(--lcs-transition-fast, 120ms);
  box-sizing: border-box;
}

.lcs-edit-textarea:focus {
  border-color: var(--lumiverse-primary, rgba(100,120,255,0.5));
}

.lcs-edit-textarea--reasoning {
  font-family: ui-monospace, 'SF Mono', SFMono-Regular, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--lumiverse-text-dim, rgba(255,255,255,0.6));
}

.lcs-edit-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.lcs-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 14px;
  border-radius: var(--lcs-radius-xs, 5px);
  border: 1px solid var(--lcs-glass-border, rgba(255,255,255,0.06));
  background: var(--lcs-glass-bg, rgba(18,16,28,0.55));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--lumiverse-text-dim, rgba(255,255,255,0.6));
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--lcs-transition-fast, 120ms);
  line-height: 1;
}

.lcs-edit-btn:hover {
  border-color: var(--lcs-glass-border-hover, rgba(255,255,255,0.1));
  color: var(--lumiverse-text, rgba(255,255,255,0.92));
}

.lcs-edit-btn--save {
  background: var(--lumiverse-primary, rgba(100,120,255,0.25));
  border-color: var(--lumiverse-primary, rgba(100,120,255,0.35));
  color: var(--lumiverse-text, rgba(255,255,255,0.92));
}

.lcs-edit-btn--save:hover {
  background: var(--lumiverse-primary-hover, rgba(100,120,255,0.35));
  border-color: var(--lumiverse-primary, rgba(100,120,255,0.5));
}

.lcs-edit-btn--cancel:hover {
  background: rgba(255,60,60,0.12);
  border-color: rgba(255,60,60,0.25);
  color: var(--lumiverse-danger, rgba(255,100,100,0.9));
}

/* ═══════════════════════════════════════════════════════════════════════
   AVATAR LIGHTBOX
   Full-screen image overlay for character/persona avatars.
   Triggered by clicking avatars in immersive/bubble mode.
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-avatar-lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: lcs-lightbox-fade-in 200ms ease-out both;
  cursor: pointer;
}

@keyframes lcs-lightbox-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.lcs-avatar-lightbox-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  cursor: default;
}

.lcs-avatar-lightbox-img {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  touch-action: pinch-zoom;
  animation: lcs-lightbox-scale-in 250ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes lcs-lightbox-scale-in {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.lcs-avatar-lightbox-name {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  letter-spacing: 0.02em;
}

/* ═══════════════════════════════════════════════════════════════════════
   QUICK REPLY POPOVER
   Glassmorphic QR selector anchored above the input action bar.
   ═══════════════════════════════════════════════════════════════════════ */

.lcs-qr-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
  margin-left: auto;
  margin-right: auto;
  width: min(100%, 520px);
  max-height: min(55vh, 400px);
  overflow-y: auto;
  z-index: 30;
  background: color-mix(in srgb, var(--lcs-page-bg, #0d0b14) 92%, white 8%);
  border: 1px solid var(--lcs-glass-border, rgba(255,255,255,0.06));
  border-radius: var(--lcs-radius, 14px);
  box-shadow:
    0 8px 32px rgba(0,0,0,0.35),
    0 0 0 0.5px rgba(255,255,255,0.04) inset;
  backdrop-filter: blur(var(--lcs-glass-blur, 14px));
  -webkit-backdrop-filter: blur(var(--lcs-glass-blur, 14px));
  padding: 6px;
  animation: lcs-tools-enter 180ms cubic-bezier(0.16, 1, 0.3, 1) both;

  /* Thin scrollbar */
  scrollbar-width: thin;
  scrollbar-color: var(--lcs-scrollbar-thumb, rgba(255,255,255,0.08)) transparent;
}

.lcs-qr-popover::-webkit-scrollbar {
  width: var(--lcs-scrollbar-w, 5px);
}
.lcs-qr-popover::-webkit-scrollbar-track {
  background: transparent;
}
.lcs-qr-popover::-webkit-scrollbar-thumb {
  background: var(--lcs-scrollbar-thumb, rgba(255,255,255,0.08));
  border-radius: 4px;
}
.lcs-qr-popover::-webkit-scrollbar-thumb:hover {
  background: var(--lcs-scrollbar-thumb-hover, rgba(255,255,255,0.15));
}

/* ── Set Group ──────────────────────────────────────────────────────── */

.lcs-qr-set-group {
  margin-bottom: 2px;
}

.lcs-qr-set-group:last-child {
  margin-bottom: 0;
}

.lcs-qr-set-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px 5px;
  border-left: 3px solid var(--lumiverse-primary, rgba(100,120,255,0.5));
  margin: 2px 4px 2px 2px;
}

.lcs-qr-set-name {
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--lumiverse-text-dim, rgba(255,255,255,0.5));
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lcs-qr-set-badges {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.lcs-qr-badge {
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1px 6px;
  border-radius: 4px;
  line-height: 1.4;
}

.lcs-qr-badge--global {
  background: rgba(100,120,255,0.12);
  color: var(--lumiverse-primary, rgba(130,150,255,0.8));
}

.lcs-qr-badge--chat {
  background: rgba(100,220,160,0.12);
  color: var(--lumiverse-success, rgba(100,220,160,0.8));
}

/* ── Entry Row ──────────────────────────────────────────────────────── */

.lcs-qr-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: var(--lcs-radius-sm, 8px);
  cursor: default;
  transition: background var(--lcs-transition-fast, 120ms);
}

.lcs-qr-entry:hover {
  background: var(--lumiverse-fill-subtle, rgba(255,255,255,0.04));
}

.lcs-qr-entry-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  color: var(--lumiverse-text-dim, rgba(255,255,255,0.45));
  font-size: 13px;
}

.lcs-qr-entry-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lcs-qr-entry-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--lumiverse-text, rgba(255,255,255,0.92));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lcs-qr-entry-preview {
  font-size: 11.5px;
  color: var(--lumiverse-text-dim, rgba(255,255,255,0.38));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.lcs-qr-entry-send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: 1px solid var(--lumiverse-primary, rgba(100,120,255,0.3));
  border-radius: var(--lcs-radius-xs, 5px);
  background: var(--lumiverse-primary, rgba(100,120,255,0.1));
  color: var(--lumiverse-text, rgba(255,255,255,0.85));
  cursor: pointer;
  transition: all var(--lcs-transition-fast, 120ms);
}

.lcs-qr-entry-send:hover {
  background: var(--lumiverse-primary-hover, rgba(100,120,255,0.25));
  border-color: var(--lumiverse-primary, rgba(100,120,255,0.5));
}

.lcs-qr-entry-send:disabled {
  opacity: 0.4;
  cursor: default;
}

/* ── Empty State ────────────────────────────────────────────────────── */

.lcs-qr-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 16px;
  color: var(--lumiverse-text-dim, rgba(255,255,255,0.35));
  font-size: 13px;
  text-align: center;
}

/* ── Responsive ─────────────────────────────────────────────────────── */

@media (max-width: 480px) {
  .lcs-qr-popover {
    width: 100%;
    max-height: min(50vh, 360px);
    padding: 4px;
  }
  .lcs-qr-entry {
    padding: 6px 8px;
    gap: 8px;
  }
  .lcs-qr-entry-label {
    font-size: 12.5px;
  }
  .lcs-qr-entry-preview {
    font-size: 11px;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   AUTHOR'S NOTE SIDE PANEL
   Slides in from left or right within .lcs-container.
   ═══════════════════════════════════════════════════════════════════════ */

/* Portal mount element is created in AuthorsNotePortal.jsx with inline styles
   (position:fixed, z-index:1050, etc.) for reliable mobile positioning.
   CSS-class-based fixed positioning breaks on mobile due to ST's
   -webkit-transform:translateZ(0) on <html> creating a containing block. */

.lcs-an-panel {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 340px;
  max-width: 85vw;
  z-index: 1050;
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--lcs-page-bg, #0d0b14) 92%, white 8%);
  border: 1px solid var(--lcs-glass-border, rgba(255,255,255,0.06));
  box-shadow:
    0 8px 32px rgba(0,0,0,0.35),
    0 0 0 0.5px rgba(255,255,255,0.04) inset;
  transition: transform var(--lcs-transition, 220ms cubic-bezier(0.4, 0, 0.2, 1));
  pointer-events: auto;
}

.lcs-an-panel--right {
  right: 0;
  border-right: none;
  border-radius: var(--lcs-radius, 14px) 0 0 var(--lcs-radius, 14px);
  transform: translateX(100%);
}

.lcs-an-panel--left {
  left: 0;
  border-left: none;
  border-radius: 0 var(--lcs-radius, 14px) var(--lcs-radius, 14px) 0;
  transform: translateX(-100%);
}

.lcs-an-panel--open {
  transform: translateX(0);
}

/* ── Header ── */
.lcs-an-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--lcs-glass-border, rgba(255,255,255,0.06));
  flex-shrink: 0;
}

.lcs-an-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--lumiverse-text-muted, rgba(230,230,240,0.6));
  text-align: center;
}

.lcs-an-header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--lcs-radius-xs, 5px);
  border: 1px solid var(--lcs-glass-border, rgba(255,255,255,0.06));
  background: transparent;
  color: var(--lumiverse-text-dim, rgba(255,255,255,0.45));
  cursor: pointer;
  transition: all var(--lcs-transition-fast, 120ms);
}

.lcs-an-header-btn:hover {
  background: var(--lumiverse-fill-subtle, rgba(255,255,255,0.04));
  border-color: var(--lcs-glass-border-hover, rgba(255,255,255,0.1));
  color: var(--lumiverse-text, rgba(255,255,255,0.92));
}

/* ── Body ── */
.lcs-an-panel-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  scrollbar-width: thin;
  scrollbar-color: var(--lcs-scrollbar-thumb, rgba(255,255,255,0.08)) transparent;
}

.lcs-an-panel-body::-webkit-scrollbar {
  width: var(--lcs-scrollbar-w, 5px);
}
.lcs-an-panel-body::-webkit-scrollbar-track {
  background: transparent;
}
.lcs-an-panel-body::-webkit-scrollbar-thumb {
  background: var(--lcs-scrollbar-thumb, rgba(255,255,255,0.08));
  border-radius: 4px;
}

/* ── Field group ── */
.lcs-an-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ── Label ── */
.lcs-an-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--lumiverse-text-dim, rgba(255,255,255,0.45));
}

/* ── Textarea ── */
.lcs-an-textarea {
  width: 100%;
  min-height: 100px;
  padding: 10px 12px;
  border-radius: var(--lcs-radius-sm, 8px);
  border: 1px solid var(--lcs-glass-border, rgba(255,255,255,0.06));
  background: var(--lcs-glass-bg, rgba(18,16,28,0.55));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--lumiverse-text, rgba(255,255,255,0.92));
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.55;
  resize: vertical;
  outline: none;
  transition: border-color var(--lcs-transition-fast, 120ms);
  box-sizing: border-box;
}

.lcs-an-textarea:focus {
  border-color: var(--lumiverse-primary, rgba(100,120,255,0.5));
}

.lcs-an-textarea::placeholder {
  color: var(--lumiverse-text-dim, rgba(255,255,255,0.25));
}

/* ── Token count ── */
.lcs-an-token-count {
  font-size: 11px;
  color: var(--lumiverse-text-dim, rgba(255,255,255,0.35));
  text-align: right;
  min-height: 15px;
  font-variant-numeric: tabular-nums;
}

/* ── Input (number) ── */
.lcs-an-input {
  width: 100%;
  padding: 7px 10px;
  border-radius: var(--lcs-radius-xs, 5px);
  border: 1px solid var(--lcs-glass-border, rgba(255,255,255,0.06));
  background: var(--lcs-glass-bg, rgba(18,16,28,0.55));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--lumiverse-text, rgba(255,255,255,0.92));
  font-family: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color var(--lcs-transition-fast, 120ms);
  box-sizing: border-box;
  -moz-appearance: textfield;
}

.lcs-an-input::-webkit-inner-spin-button,
.lcs-an-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.lcs-an-input:focus {
  border-color: var(--lumiverse-primary, rgba(100,120,255,0.5));
}

/* ── Select ── */
.lcs-an-select {
  width: 100%;
  padding: 7px 10px;
  border-radius: var(--lcs-radius-xs, 5px);
  border: 1px solid var(--lcs-glass-border, rgba(255,255,255,0.06));
  background: var(--lcs-glass-bg, rgba(18,16,28,0.55));
  color: var(--lumiverse-text, rgba(255,255,255,0.92));
  font-family: inherit;
  font-size: 13px;
  outline: none;
  cursor: pointer;
  transition: border-color var(--lcs-transition-fast, 120ms);
  box-sizing: border-box;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}

.lcs-an-select option {
  background: #1a1825;
  color: rgba(255,255,255,0.92);
}

.lcs-an-select:focus {
  border-color: var(--lumiverse-primary, rgba(100,120,255,0.5));
}

/* ── Radio group ── */
.lcs-an-radio-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lcs-an-radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--lumiverse-text, rgba(255,255,255,0.85));
  cursor: pointer;
  padding: 4px 0;
}

.lcs-an-radio {
  -webkit-appearance: none;
  appearance: none;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 1.5px solid var(--lumiverse-text-dim, rgba(255,255,255,0.3));
  background: transparent;
  flex-shrink: 0;
  cursor: pointer;
  transition: all var(--lcs-transition-fast, 120ms);
  position: relative;
}

.lcs-an-radio:checked {
  border-color: var(--lumiverse-primary, rgba(100,120,255,0.8));
}

.lcs-an-radio:checked::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--lumiverse-primary, rgba(100,120,255,0.9));
}

.lcs-an-radio:focus-visible {
  outline: 2px solid var(--lumiverse-primary, rgba(100,120,255,0.5));
  outline-offset: 2px;
}

/* ── Helper text ── */
.lcs-an-helper {
  font-size: 11px;
  font-style: italic;
  color: var(--lumiverse-text-dim, rgba(255,255,255,0.3));
}

/* ── Responsive ── */
@media (max-width: 480px) {
  .lcs-an-panel {
    width: 100%;
    max-width: 100%;
    border-radius: 0;
  }
}

/* ── Author's Note Modal (mobile) ── */
.lcs-an-modal-content {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
}

.lcs-an-modal-content .lcs-an-panel-header {
  flex-shrink: 0;
}

.lcs-an-modal-content .lcs-an-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
`;
