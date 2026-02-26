/**
 * OOC Tag Parser — Pure Function
 *
 * Extracts <lumia_ooc> / <lumiaooc> / <lumio_ooc> / <lumioooc> tags from raw message text.
 * Shared between the DOM-based OOC rendering path (oocComments.js) and the
 * React-based chat sheld path (MessageContent.jsx).
 *
 * This is a stateless, side-effect-free module.
 */

/**
 * Extract a name attribute from an HTML-like attribute string.
 * Handles: name="value", name='value', name=value, name=&quot;value&quot;
 * @param {string} attrString - Raw attribute string from the opening tag
 * @returns {string|null} Extracted name or null
 */
function extractNameFromAttributes(attrString) {
    if (!attrString) return null;

    // Try: name="value" or name='value'
    const quoted = /name\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrString);
    if (quoted) return quoted[1] ?? quoted[2] ?? null;

    // Try: name=&quot;value&quot; (HTML-encoded quotes)
    const encoded = /name\s*=\s*&quot;([^&]*)&quot;/i.exec(attrString);
    if (encoded) return encoded[1] ?? null;

    // Try: name=value (unquoted — grab until space or >)
    const unquoted = /name\s*=\s*([^\s>]+)/i.exec(attrString);
    if (unquoted) return unquoted[1] ?? null;

    return null;
}

/**
 * Sanitize a Lumia name for display.
 * Strips quotes, trims whitespace, returns null for empty strings.
 * @param {string|null} name
 * @returns {string|null}
 */
function sanitizeName(name) {
    if (!name) return null;
    const cleaned = name.replace(/^["']|["']$/g, '').trim();
    return cleaned || null;
}

/**
 * Parse raw message text for OOC tags and extract structured matches.
 *
 * Supports tag variants: lumia_ooc, lumiaooc, lumio_ooc, lumioooc
 * Uses backreference to ensure matching open/close tags.
 *
 * @param {string} rawText - The raw message text (may contain HTML)
 * @returns {Array<{ name: string|null, content: string, fullMatch: string }>}
 */
export function parseOOCTags(rawText) {
    if (!rawText) return [];

    const matches = [];

    // Group 1: Tag variant, Group 2: Attributes, Group 3: Content
    // Backreference \1 ensures matching close tag
    const tagRegex = /<(lumi[ao]_?ooc)([^>]*)>([\s\S]*?)<\/\1>/gi;
    let match;

    while ((match = tagRegex.exec(rawText)) !== null) {
        const attrString = match[2];
        const content = match[3];
        const rawName = extractNameFromAttributes(attrString);

        matches.push({
            name: sanitizeName(rawName),
            content: content.trim(),
            fullMatch: match[0],
        });
    }

    return matches;
}

/**
 * Split raw message text into segments: normal text and OOC blocks.
 * Useful for React rendering where OOC blocks need distinct treatment.
 *
 * @param {string} rawText - The raw message text
 * @returns {Array<{ type: 'text'|'ooc', content: string, name?: string|null }>}
 */
export function segmentMessageContent(rawText) {
    if (!rawText) return [{ type: 'text', content: '' }];

    const segments = [];
    const tagRegex = /<(lumi[ao]_?ooc)([^>]*)>([\s\S]*?)<\/\1>/gi;
    let lastIndex = 0;
    let match;

    while ((match = tagRegex.exec(rawText)) !== null) {
        // Text before this OOC block
        if (match.index > lastIndex) {
            segments.push({
                type: 'text',
                content: rawText.slice(lastIndex, match.index),
            });
        }

        // The OOC block itself
        const attrString = match[2];
        const rawName = extractNameFromAttributes(attrString);
        segments.push({
            type: 'ooc',
            content: match[3].trim(),
            name: sanitizeName(rawName),
        });

        lastIndex = match.index + match[0].length;
    }

    // Remaining text after last OOC block
    if (lastIndex < rawText.length) {
        segments.push({
            type: 'text',
            content: rawText.slice(lastIndex),
        });
    }

    return segments.length > 0 ? segments : [{ type: 'text', content: rawText }];
}
