/**
 * Theme Manager Module
 * Handles color theming for the Lumiverse Helper extension.
 *
 * Architecture:
 * - Stores theme as 7 HSL base colors (primary, secondary, background, text, danger, success, warning)
 * - Generates ~60 CSS custom properties from those bases
 * - Injects a <style> tag into document.head that overrides the defaults in main.css
 * - Pure JS module with no React dependency
 */

// ─── HSL Color Helpers ───────────────────────────────────────────────

/**
 * Format an HSL color object to an hsla() CSS string.
 * @param {{ h: number, s: number, l: number }} color
 * @param {number} [alpha=1]
 * @returns {string}
 */
function hsla({ h, s, l }, alpha = 1) {
    if (alpha < 1) {
        return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${alpha})`;
    }
    return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

/** Shorthand for full-opacity HSL string. */
function hsl(color) {
    return hsla(color, 1);
}

/** Return a new color with lightness increased by `amount`. */
function lighten({ h, s, l }, amount) {
    return { h, s, l: Math.min(100, l + amount) };
}

/** Return a new color with lightness decreased by `amount`. */
function darken({ h, s, l }, amount) {
    return { h, s, l: Math.max(0, l - amount) };
}

/** Return a new color with saturation decreased by `amount`. */
function desaturate({ h, s, l }, amount) {
    return { h, s: Math.max(0, s - amount), l };
}

/**
 * Determine if a theme uses "light mode" based on background lightness.
 * @param {{ h: number, s: number, l: number }} background
 * @returns {boolean}
 */
export function isLightMode(background) {
    return background.l > 50;
}

// ─── Default Theme ───────────────────────────────────────────────────

const DEFAULT_THEME = {
    name: 'Default Purple',
    baseColors: {
        primary:    { h: 271, s: 54, l: 65 },  // #9370DB - MediumPurple
        secondary:  { h: 219, s: 79, l: 66 },  // #6495ED - CornflowerBlue
        background: { h: 265, s: 23, l: 12 },  // ~#1c1826
        text:       { h: 0,   s: 0,  l: 100 }, // white
        danger:     { h: 0,   s: 84, l: 60 },  // #ef4444
        success:    { h: 142, s: 71, l: 45 },  // #22c55e
        warning:    { h: 38,  s: 92, l: 50 },  // #f59e0b
    },
};

// ─── Built-in Presets ────────────────────────────────────────────────

export const THEME_PRESETS = {
    'Default Purple': DEFAULT_THEME,
    'Ocean Blue': {
        name: 'Ocean Blue',
        baseColors: {
            primary:    { h: 210, s: 70, l: 55 },
            secondary:  { h: 190, s: 60, l: 50 },
            background: { h: 215, s: 25, l: 12 },
            text:       { h: 0, s: 0, l: 100 },
            danger:     { h: 0, s: 84, l: 60 },
            success:    { h: 142, s: 71, l: 45 },
            warning:    { h: 38, s: 92, l: 50 },
        },
    },
    'Emerald Forest': {
        name: 'Emerald Forest',
        baseColors: {
            primary:    { h: 155, s: 55, l: 50 },
            secondary:  { h: 175, s: 50, l: 45 },
            background: { h: 160, s: 20, l: 10 },
            text:       { h: 0, s: 0, l: 100 },
            danger:     { h: 0, s: 84, l: 60 },
            success:    { h: 142, s: 71, l: 45 },
            warning:    { h: 38, s: 92, l: 50 },
        },
    },
    'Rose Gold': {
        name: 'Rose Gold',
        baseColors: {
            primary:    { h: 340, s: 60, l: 65 },
            secondary:  { h: 25,  s: 70, l: 55 },
            background: { h: 345, s: 15, l: 12 },
            text:       { h: 0, s: 0, l: 100 },
            danger:     { h: 0, s: 84, l: 60 },
            success:    { h: 142, s: 71, l: 45 },
            warning:    { h: 38, s: 92, l: 50 },
        },
    },
    'Midnight Crimson': {
        name: 'Midnight Crimson',
        baseColors: {
            primary:    { h: 0,   s: 70, l: 55 },
            secondary:  { h: 280, s: 50, l: 55 },
            background: { h: 0,   s: 15, l: 10 },
            text:       { h: 0, s: 0, l: 100 },
            danger:     { h: 0, s: 84, l: 60 },
            success:    { h: 142, s: 71, l: 45 },
            warning:    { h: 38, s: 92, l: 50 },
        },
    },

    // ── Light Mode Presets ──
    'Lavender Light': {
        name: 'Lavender Light',
        baseColors: {
            primary:    { h: 271, s: 54, l: 55 },
            secondary:  { h: 219, s: 79, l: 50 },
            background: { h: 265, s: 15, l: 95 },
            text:       { h: 265, s: 10, l: 10 },
            danger:     { h: 0,   s: 84, l: 48 },
            success:    { h: 142, s: 71, l: 35 },
            warning:    { h: 38,  s: 92, l: 42 },
        },
    },
    'Cloud Blue': {
        name: 'Cloud Blue',
        baseColors: {
            primary:    { h: 210, s: 70, l: 45 },
            secondary:  { h: 190, s: 60, l: 40 },
            background: { h: 210, s: 20, l: 96 },
            text:       { h: 210, s: 15, l: 12 },
            danger:     { h: 0,   s: 84, l: 48 },
            success:    { h: 142, s: 71, l: 35 },
            warning:    { h: 38,  s: 92, l: 42 },
        },
    },
    'Warm Linen': {
        name: 'Warm Linen',
        baseColors: {
            primary:    { h: 25,  s: 70, l: 50 },
            secondary:  { h: 340, s: 50, l: 50 },
            background: { h: 35,  s: 25, l: 94 },
            text:       { h: 25,  s: 10, l: 12 },
            danger:     { h: 0,   s: 84, l: 48 },
            success:    { h: 142, s: 71, l: 35 },
            warning:    { h: 38,  s: 92, l: 42 },
        },
    },
    'Mint Fresh': {
        name: 'Mint Fresh',
        baseColors: {
            primary:    { h: 155, s: 55, l: 40 },
            secondary:  { h: 175, s: 50, l: 38 },
            background: { h: 155, s: 15, l: 95 },
            text:       { h: 155, s: 10, l: 10 },
            danger:     { h: 0,   s: 84, l: 48 },
            success:    { h: 142, s: 71, l: 35 },
            warning:    { h: 38,  s: 92, l: 42 },
        },
    },
};

// ─── CSS Variable Generation ─────────────────────────────────────────

/**
 * Generate the full set of CSS custom properties from 7 base colors.
 * Automatically adapts derivation direction based on background lightness.
 * @param {Object} baseColors
 * @returns {Object<string, string>} Map of CSS property name → value
 */
function generateThemeVariables(baseColors) {
    const { primary, secondary, background, text, danger, success, warning } = baseColors;
    const vars = {};
    const light = isLightMode(background);

    // ── Mode indicator ──
    vars['--lumiverse-mode'] = light ? 'light' : 'dark';

    // ── Primary color variants ──
    vars['--lumiverse-primary']       = hsla(primary, 0.9);
    vars['--lumiverse-primary-hover'] = hsla(lighten(primary, 8), 0.95);
    vars['--lumiverse-primary-light'] = hsla(primary, 0.1);
    vars['--lumiverse-primary-muted'] = hsla(primary, 0.6);

    // In light mode, darken the accent-text color for readability against light backgrounds
    const primaryLight = light ? darken(primary, 10) : lighten(primary, 15);
    vars['--lumiverse-primary-text']  = hsla(primaryLight, 0.95);

    // Opacity-stepped variants (for migrated hardcoded values)
    vars['--lumiverse-primary-003'] = hsla(primary, 0.03);
    vars['--lumiverse-primary-004'] = hsla(primary, 0.04);
    vars['--lumiverse-primary-005'] = hsla(primary, 0.05);
    vars['--lumiverse-primary-006'] = hsla(primary, 0.06);
    vars['--lumiverse-primary-008'] = hsla(primary, 0.08);
    vars['--lumiverse-primary-010'] = hsla(primary, 0.1);
    vars['--lumiverse-primary-012'] = hsla(primary, 0.12);
    vars['--lumiverse-primary-015'] = hsla(primary, 0.15);
    vars['--lumiverse-primary-018'] = hsla(primary, 0.18);
    vars['--lumiverse-primary-020'] = hsla(primary, 0.2);
    vars['--lumiverse-primary-025'] = hsla(primary, 0.25);
    vars['--lumiverse-primary-030'] = hsla(primary, 0.3);
    vars['--lumiverse-primary-035'] = hsla(primary, 0.35);
    vars['--lumiverse-primary-040'] = hsla(primary, 0.4);
    vars['--lumiverse-primary-045'] = hsla(primary, 0.45);
    vars['--lumiverse-primary-050'] = hsla(primary, 0.5);
    vars['--lumiverse-primary-060'] = hsla(primary, 0.6);
    vars['--lumiverse-primary-070'] = hsla(primary, 0.7);
    vars['--lumiverse-primary-080'] = hsla(primary, 0.8);
    vars['--lumiverse-primary-085'] = hsla(primary, 0.85);
    vars['--lumiverse-primary-090'] = hsla(primary, 0.9);
    vars['--lumiverse-primary-095'] = hsla(primary, 0.95);
    vars['--lumiverse-primary-100'] = hsl(primary);

    // Primary-text opacity variants
    vars['--lumiverse-primary-text-015'] = hsla(primaryLight, 0.15);
    vars['--lumiverse-primary-text-030'] = hsla(primaryLight, 0.3);
    vars['--lumiverse-primary-text-050'] = hsla(primaryLight, 0.5);
    vars['--lumiverse-primary-text-060'] = hsla(primaryLight, 0.6);
    vars['--lumiverse-primary-text-080'] = hsla(primaryLight, 0.8);
    vars['--lumiverse-primary-text-085'] = hsla(primaryLight, 0.85);
    vars['--lumiverse-primary-text-090'] = hsla(primaryLight, 0.9);
    vars['--lumiverse-primary-text-095'] = hsla(primaryLight, 0.95);
    vars['--lumiverse-primary-text-100'] = hsl(primaryLight);

    // ── Secondary color variants ──
    vars['--lumiverse-secondary']        = hsla(secondary, 0.15);
    vars['--lumiverse-secondary-hover']  = hsla(secondary, 0.25);
    vars['--lumiverse-secondary-border'] = hsla(secondary, 0.25);

    // Secondary opacity variants
    vars['--lumiverse-secondary-005'] = hsla(secondary, 0.05);
    vars['--lumiverse-secondary-008'] = hsla(secondary, 0.08);
    vars['--lumiverse-secondary-010'] = hsla(secondary, 0.1);
    vars['--lumiverse-secondary-012'] = hsla(secondary, 0.12);
    vars['--lumiverse-secondary-015'] = hsla(secondary, 0.15);
    vars['--lumiverse-secondary-020'] = hsla(secondary, 0.2);
    vars['--lumiverse-secondary-025'] = hsla(secondary, 0.25);
    vars['--lumiverse-secondary-030'] = hsla(secondary, 0.3);
    vars['--lumiverse-secondary-035'] = hsla(secondary, 0.35);
    vars['--lumiverse-secondary-040'] = hsla(secondary, 0.4);
    vars['--lumiverse-secondary-045'] = hsla(secondary, 0.45);
    vars['--lumiverse-secondary-050'] = hsla(secondary, 0.5);
    vars['--lumiverse-secondary-060'] = hsla(secondary, 0.6);
    vars['--lumiverse-secondary-070'] = hsla(secondary, 0.7);
    vars['--lumiverse-secondary-080'] = hsla(secondary, 0.8);
    vars['--lumiverse-secondary-085'] = hsla(secondary, 0.85);
    vars['--lumiverse-secondary-090'] = hsla(secondary, 0.9);
    vars['--lumiverse-secondary-095'] = hsla(secondary, 0.95);
    vars['--lumiverse-secondary-100'] = hsl(secondary);

    // ── Background variants (mode-aware elevation direction) ──
    // Dark mode: elevated = lighter, deep = darker
    // Light mode: elevated = darker (subtle depth), deep = lighter (receded)
    const bgElevated = light ? darken(background, 4) : lighten(background, 3);
    const bgHover    = light ? darken(background, 7) : lighten(background, 7);
    const bgDeep     = light ? lighten(background, 3) : darken(background, 3);
    const bgDeepest  = light ? lighten(background, 5) : darken(background, 5);
    const bgSurface  = light ? darken(background, 6) : lighten(background, 5);
    const bgSurface2 = light ? darken(background, 10) : lighten(background, 10);

    // Light mode: fully opaque colors — semi-transparent over dark ST page = muddy
    // Dark mode: semi-transparent for layered depth against dark backgrounds
    if (light) {
        vars['--lumiverse-bg']          = hsl(background);
        vars['--lumiverse-bg-elevated'] = hsl(bgElevated);
        vars['--lumiverse-bg-hover']    = hsl(bgHover);
        vars['--lumiverse-bg-dark']     = hsl(darken(background, 6));
        vars['--lumiverse-bg-darker']   = hsl(darken(background, 10));

        // Opacity-named variants → solid colors with progressive depth
        vars['--lumiverse-bg-040']          = hsl(darken(background, 10));
        vars['--lumiverse-bg-050']          = hsl(darken(background, 8));
        vars['--lumiverse-bg-060']          = hsl(darken(background, 6));
        vars['--lumiverse-bg-070']          = hsl(darken(background, 5));
        vars['--lumiverse-bg-080']          = hsl(darken(background, 4));
        vars['--lumiverse-bg-085']          = hsl(darken(background, 3));
        vars['--lumiverse-bg-097']          = hsl(darken(background, 1));
        vars['--lumiverse-bg-098']          = hsl(background);
        vars['--lumiverse-bg-elevated-040'] = hsl(darken(bgElevated, 8));
        vars['--lumiverse-bg-elevated-050'] = hsl(darken(bgElevated, 6));
        vars['--lumiverse-bg-elevated-075'] = hsl(darken(bgElevated, 3));
        vars['--lumiverse-bg-elevated-085'] = hsl(darken(bgElevated, 2));
        vars['--lumiverse-bg-elevated-095'] = hsl(bgElevated);
        vars['--lumiverse-bg-elevated-098'] = hsl(bgElevated);
        vars['--lumiverse-bg-hover-080']    = hsl(darken(bgHover, 3));
        vars['--lumiverse-bg-hover-085']    = hsl(darken(bgHover, 2));
        vars['--lumiverse-bg-hover-095']    = hsl(bgHover);

        // Deeper/surface shades — solid for light mode
        vars['--lumiverse-bg-deep']      = hsl(bgDeep);
        vars['--lumiverse-bg-deep-080']  = hsl(darken(bgDeep, 3));
        vars['--lumiverse-bg-deepest']   = hsl(bgDeepest);
        vars['--lumiverse-bg-surface']   = hsl(bgSurface);
        vars['--lumiverse-bg-surface-2'] = hsl(bgSurface2);
    } else {
        vars['--lumiverse-bg']          = hsla(background, 0.95);
        vars['--lumiverse-bg-elevated'] = hsla(bgElevated, 0.9);
        vars['--lumiverse-bg-hover']    = hsla(bgHover, 0.9);
        vars['--lumiverse-bg-dark']     = 'rgba(0, 0, 0, 0.15)';
        vars['--lumiverse-bg-darker']   = 'rgba(0, 0, 0, 0.25)';

        // Background opacity variants
        vars['--lumiverse-bg-040']          = hsla(background, 0.4);
        vars['--lumiverse-bg-050']          = hsla(background, 0.5);
        vars['--lumiverse-bg-060']          = hsla(background, 0.6);
        vars['--lumiverse-bg-070']          = hsla(background, 0.7);
        vars['--lumiverse-bg-080']          = hsla(background, 0.8);
        vars['--lumiverse-bg-085']          = hsla(background, 0.85);
        vars['--lumiverse-bg-097']          = hsla(background, 0.97);
        vars['--lumiverse-bg-098']          = hsla(background, 0.98);
        vars['--lumiverse-bg-elevated-040'] = hsla(bgElevated, 0.4);
        vars['--lumiverse-bg-elevated-050'] = hsla(bgElevated, 0.5);
        vars['--lumiverse-bg-elevated-075'] = hsla(bgElevated, 0.75);
        vars['--lumiverse-bg-elevated-085'] = hsla(bgElevated, 0.85);
        vars['--lumiverse-bg-elevated-095'] = hsla(bgElevated, 0.95);
        vars['--lumiverse-bg-elevated-098'] = hsla(bgElevated, 0.98);
        vars['--lumiverse-bg-hover-080']    = hsla(bgHover, 0.8);
        vars['--lumiverse-bg-hover-085']    = hsla(bgHover, 0.85);
        vars['--lumiverse-bg-hover-095']    = hsla(bgHover, 0.95);

        // Deeper/surface background shades
        vars['--lumiverse-bg-deep']      = hsla(bgDeep, 0.98);
        vars['--lumiverse-bg-deep-080']  = hsla(bgDeep, 0.8);
        vars['--lumiverse-bg-deepest']   = hsla(bgDeepest, 0.98);
        vars['--lumiverse-bg-surface']   = hsla(bgSurface, 0.9);
        vars['--lumiverse-bg-surface-2'] = hsla(bgSurface2, 0.95);
    }

    // ── Border variants ──
    vars['--lumiverse-border']       = hsla(primary, 0.12);
    vars['--lumiverse-border-hover'] = hsla(primary, 0.25);
    vars['--lumiverse-border-light'] = hsla(desaturate(primary, 100), 0.12);

    // ── Text variants ──
    vars['--lumiverse-text']       = hsla(text, 0.9);
    vars['--lumiverse-text-muted'] = hsla(text, 0.65);
    vars['--lumiverse-text-dim']   = hsla(text, 0.4);
    vars['--lumiverse-text-hint']  = hsla(text, 0.3);

    // ── Status colors ──
    vars['--lumiverse-danger']       = hsl(danger);
    vars['--lumiverse-danger-hover'] = hsl(darken(danger, 5));
    vars['--lumiverse-success']      = hsl(success);
    vars['--lumiverse-warning']      = hsl(warning);

    // Status opacity variants
    vars['--lumiverse-danger-008']  = hsla(danger, 0.08);
    vars['--lumiverse-danger-010']  = hsla(danger, 0.1);
    vars['--lumiverse-danger-015']  = hsla(danger, 0.15);
    vars['--lumiverse-danger-020']  = hsla(danger, 0.2);
    vars['--lumiverse-danger-025']  = hsla(danger, 0.25);
    vars['--lumiverse-danger-040']  = hsla(danger, 0.4);
    vars['--lumiverse-danger-050']  = hsla(danger, 0.5);
    vars['--lumiverse-danger-070']  = hsla(danger, 0.7);
    vars['--lumiverse-danger-080']  = hsla(danger, 0.8);
    vars['--lumiverse-danger-090']  = hsla(danger, 0.9);
    vars['--lumiverse-danger-095']  = hsla(danger, 0.95);
    vars['--lumiverse-danger-100']  = hsl(danger);
    vars['--lumiverse-success-015'] = hsla(success, 0.15);
    vars['--lumiverse-success-030'] = hsla(success, 0.3);
    vars['--lumiverse-success-090'] = hsla(success, 0.9);
    vars['--lumiverse-success-095'] = hsla(success, 0.95);
    vars['--lumiverse-warning-010'] = hsla(warning, 0.1);
    vars['--lumiverse-warning-025'] = hsla(warning, 0.25);
    vars['--lumiverse-warning-040'] = hsla(warning, 0.4);
    vars['--lumiverse-warning-060'] = hsla(warning, 0.6);
    vars['--lumiverse-warning-090'] = hsla(warning, 0.9);
    vars['--lumiverse-warning-012'] = hsla(warning, 0.12);

    // ── Shadows (mode-aware opacity) ──
    const shadowOp   = light ? 0.10 : 0.3;
    const shadowOpLg = light ? 0.18 : 0.5;
    vars['--lumiverse-shadow']    = `0 4px 6px -1px rgba(0, 0, 0, ${shadowOp})`;
    vars['--lumiverse-shadow-lg'] = `0 24px 80px rgba(0, 0, 0, ${shadowOpLg}), 0 0 1px ${hsla(primary, 0.3)}`;

    // ── Fill colors (replace hardcoded rgba(0,0,0,X) backgrounds) ──
    // Light mode: solid colors derived from bg; Dark mode: black overlays
    if (light) {
        vars['--lumiverse-fill-subtle']  = hsl(darken(background, 3));   // 0.08-0.12
        vars['--lumiverse-fill']         = hsl(darken(background, 5));   // 0.15
        vars['--lumiverse-fill-hover']   = hsl(darken(background, 7));   // 0.18-0.2
        vars['--lumiverse-fill-medium']  = hsl(darken(background, 9));   // 0.25
        vars['--lumiverse-fill-strong']  = hsl(darken(background, 12));  // 0.3-0.35
        vars['--lumiverse-fill-heavy']   = hsl(darken(background, 20));  // 0.5
        vars['--lumiverse-fill-deepest'] = hsl(darken(background, 30));  // 0.7
    } else {
        vars['--lumiverse-fill-subtle']  = 'rgba(0, 0, 0, 0.1)';
        vars['--lumiverse-fill']         = 'rgba(0, 0, 0, 0.15)';
        vars['--lumiverse-fill-hover']   = 'rgba(0, 0, 0, 0.2)';
        vars['--lumiverse-fill-medium']  = 'rgba(0, 0, 0, 0.25)';
        vars['--lumiverse-fill-strong']  = 'rgba(0, 0, 0, 0.3)';
        vars['--lumiverse-fill-heavy']   = 'rgba(0, 0, 0, 0.5)';
        vars['--lumiverse-fill-deepest'] = 'rgba(0, 0, 0, 0.7)';
    }

    // ── Card backgrounds ──
    vars['--lumiverse-card-bg'] = light
        ? `linear-gradient(165deg, ${hsl(background)} 0%, ${hsl(darken(background, 4))} 100%)`
        : `linear-gradient(165deg, ${hsla(background, 0.95)} 0%, ${hsla(darken(background, 2), 0.9)} 50%, ${hsla(darken(background, 4), 0.95)} 100%)`;
    vars['--lumiverse-card-image-bg'] = light
        ? `linear-gradient(135deg, ${hsl(darken(background, 6))} 0%, ${hsl(darken(background, 10))} 100%)`
        : `linear-gradient(135deg, ${hsla(bgDeep, 0.8)} 0%, ${hsla(darken(background, 6), 0.6)} 100%)`;

    // ── Neutral border (replacing hardcoded rgba(128,128,128,X)) ──
    vars['--lumiverse-border-neutral'] = light
        ? `hsla(${background.h}, 5%, 50%, 0.25)`
        : 'rgba(128, 128, 128, 0.15)';
    vars['--lumiverse-border-neutral-hover'] = light
        ? `hsla(${background.h}, 5%, 50%, 0.35)`
        : 'rgba(128, 128, 128, 0.25)';

    // ── Mode-aware highlights and overlays ──
    vars['--lumiverse-highlight-inset']    = light
        ? 'inset 0 1px 0 rgba(255, 255, 255, 0.5)'
        : 'inset 0 1px 0 rgba(255, 255, 255, 0.1)';
    vars['--lumiverse-highlight-inset-md'] = light
        ? 'inset 0 1px 0 rgba(255, 255, 255, 0.7)'
        : 'inset 0 1px 0 rgba(255, 255, 255, 0.2)';
    vars['--lumiverse-highlight-inset-lg'] = light
        ? 'inset 0 1px 0 rgba(255, 255, 255, 0.8)'
        : 'inset 0 1px 0 rgba(255, 255, 255, 0.25)';
    vars['--lumiverse-modal-backdrop'] = light
        ? 'rgba(0, 0, 0, 0.35)'
        : 'rgba(0, 0, 0, 0.6)';
    vars['--lumiverse-swatch-border'] = light
        ? 'rgba(0, 0, 0, 0.15)'
        : 'rgba(255, 255, 255, 0.15)';

    // ── Mode-aware shadows (medium/small for element-level shadows) ──
    const shadowMdOp = light ? 0.08 : 0.4;
    const shadowSmOp = light ? 0.05 : 0.2;
    vars['--lumiverse-shadow-md'] = `0 8px 24px rgba(0, 0, 0, ${shadowMdOp})`;
    vars['--lumiverse-shadow-sm'] = `0 2px 8px rgba(0, 0, 0, ${shadowSmOp})`;
    vars['--lumiverse-shadow-xl'] = `0 20px 60px rgba(0, 0, 0, ${light ? 0.12 : 0.5})`;
    vars['--lumiverse-text-shadow'] = 'none';

    // ── Icon colors (derived from text, for SVG stroke/fill) ──
    vars['--lumiverse-icon']       = hsla(text, 0.9);
    vars['--lumiverse-icon-muted'] = hsla(text, 0.6);
    vars['--lumiverse-icon-dim']   = hsla(text, 0.4);

    // ── Gradient presets (mode-aware via derived bg values) ──
    vars['--lumiverse-gradient-panel'] = light
        ? `linear-gradient(165deg, ${hsl(darken(background, 2))} 0%, ${hsl(bgElevated)} 100%)`
        : `linear-gradient(165deg, ${hsla(background, 0.6)} 0%, ${hsla(bgElevated, 0.5)} 100%)`;
    vars['--lumiverse-gradient-header'] = `linear-gradient(180deg, ${hsla(primary, 0.08)} 0%, transparent 100%)`;
    vars['--lumiverse-gradient-bg'] = light
        ? `linear-gradient(165deg, ${hsl(bgDeep)} 0%, ${hsl(background)} 50%, ${hsl(darken(background, 2))} 100%)`
        : `linear-gradient(165deg, ${hsla(bgDeep, 0.98)} 0%, ${hsla(background, 0.97)} 50%, ${hsla(darken(background, 2), 0.98)} 100%)`;
    vars['--lumiverse-gradient-accent'] = `linear-gradient(135deg, ${hsla(primary, 0.9)} 0%, ${hsla(secondary, 0.85)} 100%)`;
    vars['--lumiverse-gradient-accent-light'] = `linear-gradient(135deg, ${hsla(primary, 0.25)} 0%, ${hsla(secondary, 0.15)} 100%)`;
    vars['--lumiverse-gradient-glow1'] = `radial-gradient(circle, ${hsla(primary, 0.25)} 0%, transparent 70%)`;
    vars['--lumiverse-gradient-glow2'] = `radial-gradient(circle, ${hsla(secondary, 0.2)} 0%, transparent 70%)`;
    vars['--lumiverse-gradient-glow3'] = `radial-gradient(circle, ${hsla(primaryLight, 0.15)} 0%, transparent 70%)`;
    vars['--lumiverse-gradient-divider'] = `linear-gradient(90deg, transparent, ${hsla(primary, 0.15)}, transparent)`;
    vars['--lumiverse-gradient-modal'] = `linear-gradient(135deg, ${hsla(bgElevated, 0.98)}, ${hsla(bgDeep, 0.98)})`;

    // ── OOC / inline style colors ──
    vars['--lumiverse-ooc-color']  = hsl(primary);
    vars['--lumiverse-ooc-border'] = hsla(primary, 0.4);
    vars['--lumiverse-ooc-bg']     = hsla(primary, 0.03);

    // OOC card/bubble backgrounds (dark gradient in dark, solid in light)
    vars['--lumiverse-ooc-card-bg'] = light
        ? `linear-gradient(168deg, ${hsl(darken(background, 3))} 0%, ${hsl(darken(background, 5))} 50%, ${hsl(darken(background, 4))} 100%)`
        : `linear-gradient(168deg, rgba(20, 16, 28, 0.85) 0%, rgba(30, 24, 42, 0.75) 50%, rgba(25, 20, 35, 0.8) 100%)`;
    vars['--lumiverse-ooc-bubble-bg'] = light
        ? `linear-gradient(145deg, ${hsl(darken(background, 3))} 0%, ${hsl(darken(background, 5))} 50%, ${hsl(darken(background, 4))} 100%)`
        : `linear-gradient(145deg, rgba(30, 24, 42, 0.85) 0%, rgba(40, 32, 55, 0.8) 50%, rgba(35, 28, 48, 0.85) 100%)`;
    vars['--lumiverse-ooc-margin-bg'] = light
        ? `linear-gradient(135deg, ${hsl(darken(background, 3))} 0%, ${hsl(darken(background, 5))} 100%)`
        : 'linear-gradient(135deg, rgba(30, 24, 42, 0.8) 0%, rgba(40, 32, 55, 0.75) 100%)';

    // ── IRC-specific colors ──
    vars['--lumiverse-irc-text'] = light ? 'hsl(120, 70%, 28%)' : '#00ff00';
    vars['--lumiverse-irc-mention'] = hsl(danger);
    vars['--lumiverse-irc-mention-bg'] = hsla(danger, 0.1);

    return vars;
}

// ─── DOM Injection ───────────────────────────────────────────────────

const STYLE_ID = 'lumiverse-theme-overrides';
let currentTheme = null;

/**
 * Apply a theme by generating CSS variables and injecting them into the DOM.
 * @param {Object} theme - Theme config with `name` and `baseColors`
 */
export function applyTheme(theme) {
    if (!theme || !theme.baseColors) return;

    currentTheme = theme;
    const vars = generateThemeVariables(theme.baseColors);

    let css = ':root {\n';
    for (const [prop, value] of Object.entries(vars)) {
        css += `  ${prop}: ${value};\n`;
    }
    css += '}\n';

    let styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = STYLE_ID;
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
}

/**
 * Remove theme overrides, reverting to CSS defaults in main.css.
 */
export function removeThemeOverrides() {
    currentTheme = null;
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
}

/**
 * Get the currently applied theme config, or null if using defaults.
 * @returns {Object|null}
 */
export function getCurrentTheme() {
    return currentTheme;
}

/**
 * Get the default theme config.
 * @returns {Object}
 */
export function getDefaultTheme() {
    return DEFAULT_THEME;
}

/**
 * Read a computed CSS custom property value from the document root.
 * Useful for JS files that set inline styles and need theme-aware colors.
 * @param {string} varName - CSS variable name (e.g. '--lumiverse-ooc-color')
 * @param {string} [fallback=''] - Fallback if variable is not set
 * @returns {string}
 */
export function getThemeColor(varName, fallback = '') {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(varName).trim() || fallback;
}

/**
 * Validate a theme config object.
 * @param {*} theme
 * @returns {boolean}
 */
export function isValidTheme(theme) {
    if (!theme || typeof theme !== 'object' || !theme.baseColors) return false;
    const requiredKeys = ['primary', 'secondary', 'background', 'text', 'danger', 'success', 'warning'];
    for (const key of requiredKeys) {
        const color = theme.baseColors[key];
        if (!color || typeof color.h !== 'number' || typeof color.s !== 'number' || typeof color.l !== 'number') {
            return false;
        }
    }
    return true;
}

/**
 * Export a theme as a JSON-serializable object with metadata.
 * @param {Object} theme
 * @returns {Object}
 */
export function exportTheme(theme) {
    return {
        lumiverseTheme: true,
        version: 2,
        name: theme.name || 'Custom',
        baseColors: { ...theme.baseColors },
    };
}

/**
 * Import and validate a theme from a parsed JSON object.
 * @param {Object} data
 * @returns {Object|null} Valid theme config, or null if invalid
 */
export function importTheme(data) {
    if (!data || !data.lumiverseTheme) return null;
    if (data.version !== 1 && data.version !== 2) return null;
    const theme = {
        name: data.name || 'Imported',
        baseColors: data.baseColors,
    };
    return isValidTheme(theme) ? theme : null;
}
