/**
 * Syntax Highlighter for ST character card content.
 *
 * Regex-based, ordered by priority. HTML-escapes first, then wraps matches
 * in <span class="lce-hl-*"> for the overlay layer in TextExpanderModal.
 *
 * Zero dependencies.
 */

/**
 * Escape HTML entities so raw text can be safely inserted into a <pre>.
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Ordered highlight rules. Earlier rules win — matched regions are replaced
 * with a sentinel token so later rules don't re-match inside them.
 */
const RULES = [
  // ST macros: {{macro_name}} or {{macro .arg}}
  { pattern: /(\{\{[^}]+\}\})/g, cls: "lce-hl-macro" },
  // Dialog prefixes: {{user}}: or {{char}}: (already macro-captured, but kept for the colon form)
  { pattern: /(\{\{(?:user|char)\}\}\s*:)/g, cls: "lce-hl-dialog" },
  // Markers: <START>, <END>, [Start a new chat], etc.
  { pattern: /(&lt;START&gt;|&lt;END&gt;|\[Start a new chat\])/gi, cls: "lce-hl-marker" },
  // HTML tags (escaped): <tag>, </tag>, <tag attr="...">
  { pattern: /(&lt;\/?[a-zA-Z][^&]*?&gt;)/g, cls: "lce-hl-html" },
  // Headings: # at start of line
  { pattern: /^(#{1,6}\s.+)$/gm, cls: "lce-hl-heading" },
  // Blockquotes: > at start of line
  { pattern: /^(&gt;\s?.+)$/gm, cls: "lce-hl-quote" },
  // Bold: **text**
  { pattern: /(\*\*[^*]+\*\*)/g, cls: "lce-hl-bold" },
  // RP actions / italics: *text* (single asterisk, not double)
  { pattern: /(?<!\*)(\*(?!\*)[^*]+\*(?!\*))/g, cls: "lce-hl-action" },
];

/**
 * Apply syntax highlighting to text content.
 * @param {string} raw - Raw text (NOT HTML-escaped yet)
 * @returns {string} HTML string with <span class="lce-hl-*"> wrappers
 */
export function highlightContent(raw) {
  if (!raw) return "";

  let text = escapeHtml(raw);

  // Use sentinel tokens to protect already-matched regions
  const tokens = [];
  function protect(match, cls) {
    const idx = tokens.length;
    tokens.push(`<span class="${cls}">${match}</span>`);
    return `\x00${idx}\x00`;
  }

  for (const rule of RULES) {
    text = text.replace(rule.pattern, (m) => protect(m, rule.cls));
  }

  // Restore sentinel tokens
  text = text.replace(/\x00(\d+)\x00/g, (_, idx) => tokens[parseInt(idx, 10)]);

  return text;
}
