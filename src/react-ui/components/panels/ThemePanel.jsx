import React, { useState, useCallback, useEffect, useRef, useMemo, useSyncExternalStore } from 'react';
import { HslColorPicker } from 'react-colorful';
import clsx from 'clsx';
import { RotateCcw, Download, Upload, Check, Sun, Moon } from 'lucide-react';
import { useLumiverseActions, useLumiverseStore, saveToExtension } from '../../store/LumiverseContext';
import { applyTheme, getDefaultTheme, THEME_PRESETS, exportTheme, importTheme, isValidTheme, isLightMode, hslToRgb, rgbToHsl, hslToHex, hexToHsl } from '../../../lib/themeManager';

/* global toastr */

const store = useLumiverseStore;

// Stable selector
const selectTheme = () => store.getState().theme;

// Color slot definitions
const COLOR_SLOTS = [
    { key: 'primary',    label: 'Primary' },
    { key: 'secondary',  label: 'Secondary' },
    { key: 'background', label: 'Background' },
    { key: 'text',       label: 'Text' },
    { key: 'danger',     label: 'Danger' },
    { key: 'success',    label: 'Success' },
    { key: 'warning',    label: 'Warning' },
];

const presetNames = Object.keys(THEME_PRESETS);

// Split presets into dark and light groups
const darkPresets = presetNames.filter(name =>
    !isLightMode(THEME_PRESETS[name].baseColors.background)
);
const lightPresets = presetNames.filter(name =>
    isLightMode(THEME_PRESETS[name].baseColors.background)
);

/**
 * Convert HSL object to CSS hsl() string for swatch display.
 */
function hslToCSS({ h, s, l }) {
    return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

/**
 * Render a row of preset buttons.
 */
function PresetRow({ presets, activePreset, onSelect }) {
    return (
        <div className="lumiverse-theme-preset-row">
            {presets.map(name => (
                <button
                    key={name}
                    type="button"
                    className={clsx(
                        'lumiverse-theme-preset-btn',
                        activePreset === name && 'lumiverse-theme-preset-btn--active'
                    )}
                    onClick={() => onSelect(name)}
                    title={name}
                >
                    <span
                        className="lumiverse-theme-preset-dot"
                        style={{ background: hslToCSS(THEME_PRESETS[name].baseColors.primary) }}
                    />
                    <span className="lumiverse-theme-preset-name">{name}</span>
                    {activePreset === name && <Check size={12} strokeWidth={2.5} />}
                </button>
            ))}
        </div>
    );
}

/**
 * ThemePanel - Color theming settings with color picker, mode toggle, and presets.
 */
export default function ThemePanel() {
    const theme = useSyncExternalStore(store.subscribe, selectTheme);
    const actions = useLumiverseActions();
    const fileInputRef = useRef(null);

    // Local editing state - initialized from store or defaults
    const defaultTheme = getDefaultTheme();
    const [localTheme, setLocalTheme] = useState(() => theme || defaultTheme);
    const [activeSlot, setActiveSlot] = useState('primary');
    const [activePreset, setActivePreset] = useState(() => {
        return theme ? (theme.name || 'Custom') : 'Default Purple';
    });

    // Derived: is the current theme in light mode?
    const currentlyLight = useMemo(
        () => isLightMode(localTheme.baseColors.background),
        [localTheme.baseColors.background]
    );

    // Sync local state when store changes externally (e.g. from sync)
    useEffect(() => {
        if (theme) {
            setLocalTheme(theme);
            setActivePreset(theme.name || 'Custom');
        } else {
            setLocalTheme(defaultTheme);
            setActivePreset('Default Purple');
        }
    }, [theme]);

    // Apply theme live on local changes
    useEffect(() => {
        applyTheme(localTheme);
    }, [localTheme]);

    // Debounced persist to store — version counter prevents stale saves
    const saveTimerRef = useRef(null);
    const persistVersionRef = useRef(0);
    const persistTheme = useCallback((themeToSave) => {
        const version = ++persistVersionRef.current;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            // Discard if a newer persist was queued (race condition guard)
            if (version !== persistVersionRef.current) return;
            // Only persist if different from default
            const isDefault = themeToSave.name === 'Default Purple' &&
                JSON.stringify(themeToSave.baseColors) === JSON.stringify(defaultTheme.baseColors);
            if (isDefault) {
                actions.resetTheme();
            } else {
                actions.setTheme(themeToSave);
            }
        }, 500);
    }, [actions, defaultTheme]);

    // Handle mode toggle (dark ↔ light)
    const handleModeToggle = useCallback(() => {
        setLocalTheme(prev => {
            const bg = prev.baseColors.background;
            const light = isLightMode(bg);

            // Flip background lightness, preserving hue and saturation
            const newBgL = light
                ? Math.max(8, 100 - bg.l)
                : Math.min(97, 100 - bg.l);

            // Text: white for dark mode, near-black for light mode
            const newTxtL = light ? 100 : 10;

            const next = {
                ...prev,
                name: 'Custom',
                baseColors: {
                    ...prev.baseColors,
                    background: { ...bg, l: newBgL },
                    text: { ...prev.baseColors.text, l: newTxtL },
                },
            };
            persistTheme(next);
            return next;
        });
        setActivePreset('Custom');
    }, [persistTheme]);

    // Lock ref: set true on preset/reset clicks to block stale trailing picker
    // events from react-colorful; cleared when the user presses down on the picker again.
    const presetLockRef = useRef(false);

    // Handle color change from picker
    const handleColorChange = useCallback((newColor) => {
        if (presetLockRef.current) return;
        setLocalTheme(prev => {
            const next = {
                ...prev,
                name: 'Custom',
                baseColors: { ...prev.baseColors, [activeSlot]: newColor },
            };
            persistTheme(next);
            return next;
        });
        setActivePreset('Custom');
    }, [activeSlot, persistTheme]);

    // Handle preset selection — synchronous, bypasses debounce to prevent
    // race conditions with late color picker onChange events
    const handlePresetSelect = useCallback((presetName) => {
        const preset = THEME_PRESETS[presetName];
        if (!preset) return;
        // Cancel any in-flight debounced save and lock out stale picker events
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        persistVersionRef.current++;
        presetLockRef.current = true;
        setLocalTheme(preset);
        setActivePreset(presetName);
        // Persist immediately — preset clicks are discrete user actions
        const isDefault = presetName === 'Default Purple' &&
            JSON.stringify(preset.baseColors) === JSON.stringify(defaultTheme.baseColors);
        if (isDefault) {
            actions.resetTheme();
        } else {
            actions.setTheme(preset);
        }
    }, [actions, defaultTheme]);

    // Handle reset — cancel debounce and lock out stale picker events
    const handleReset = useCallback(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        persistVersionRef.current++;
        presetLockRef.current = true;
        setLocalTheme(defaultTheme);
        setActivePreset('Default Purple');
        actions.resetTheme();
        applyTheme(defaultTheme);
    }, [actions, defaultTheme]);

    // Handle export
    const handleExport = useCallback(() => {
        const data = exportTheme(localTheme);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lumiverse-theme-${(localTheme.name || 'custom').toLowerCase().replace(/\s+/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        if (typeof toastr !== 'undefined') {
            toastr.success('Theme exported');
        }
    }, [localTheme]);

    // Handle import
    const handleImport = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                const imported = importTheme(data);
                if (!imported) {
                    if (typeof toastr !== 'undefined') {
                        toastr.error('Invalid theme file');
                    }
                    return;
                }
                setLocalTheme(imported);
                setActivePreset(imported.name || 'Custom');
                persistTheme(imported);
            } catch {
                if (typeof toastr !== 'undefined') {
                    toastr.error('Failed to parse theme file');
                }
            }
        };
        reader.readAsText(file);
        // Reset file input so the same file can be re-imported
        e.target.value = '';
    }, [persistTheme]);

    const currentColor = localTheme.baseColors[activeSlot];

    // Derived hex/RGB values for the active color slot
    const currentRgb = useMemo(() => hslToRgb(currentColor), [currentColor]);
    const currentHex = useMemo(() => hslToHex(currentColor), [currentColor]);

    // Local hex input state — only commits on blur/Enter to allow partial typing
    const [hexInput, setHexInput] = useState(currentHex);
    useEffect(() => { setHexInput(currentHex); }, [currentHex]);

    const commitHex = useCallback((value) => {
        const parsed = hexToHsl(value);
        if (parsed) handleColorChange(parsed);
    }, [handleColorChange]);

    const handleHexKeyDown = useCallback((e) => {
        if (e.key === 'Enter') commitHex(hexInput);
    }, [commitHex, hexInput]);

    const handleRgbChange = useCallback((channel, value) => {
        const clamped = Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
        const newRgb = { ...currentRgb, [channel]: clamped };
        handleColorChange(rgbToHsl(newRgb));
    }, [currentRgb, handleColorChange]);

    return (
        <div className="lumiverse-theme-panel">
            {/* Mode Toggle */}
            <div className="lumiverse-theme-mode-toggle">
                <label className="lumiverse-theme-label">Mode</label>
                <button
                    type="button"
                    className={clsx(
                        'lumiverse-theme-mode-btn',
                        currentlyLight && 'lumiverse-theme-mode-btn--light'
                    )}
                    onClick={handleModeToggle}
                    title={currentlyLight ? 'Switch to dark mode' : 'Switch to light mode'}
                >
                    <Moon size={15} strokeWidth={1.5} className="lumiverse-theme-mode-icon-moon" />
                    <div className="lumiverse-theme-mode-track">
                        <div className="lumiverse-theme-mode-thumb" />
                    </div>
                    <Sun size={15} strokeWidth={1.5} className="lumiverse-theme-mode-icon-sun" />
                </button>
            </div>

            {/* Preset Selector */}
            <div className="lumiverse-theme-presets">
                <label className="lumiverse-theme-label">Presets</label>
                <div className="lumiverse-theme-preset-group">
                    <span className="lumiverse-theme-preset-group-label">Dark</span>
                    <PresetRow presets={darkPresets} activePreset={activePreset} onSelect={handlePresetSelect} />
                </div>
                <div className="lumiverse-theme-preset-group">
                    <span className="lumiverse-theme-preset-group-label">Light</span>
                    <PresetRow presets={lightPresets} activePreset={activePreset} onSelect={handlePresetSelect} />
                </div>
            </div>

            {/* Color Swatches */}
            <div className="lumiverse-theme-swatches-section">
                <label className="lumiverse-theme-label">Base Colors</label>
                <div className="lumiverse-theme-swatches">
                    {COLOR_SLOTS.map(slot => (
                        <button
                            key={slot.key}
                            type="button"
                            className={clsx(
                                'lumiverse-theme-swatch',
                                activeSlot === slot.key && 'lumiverse-theme-swatch--active'
                            )}
                            onClick={() => setActiveSlot(slot.key)}
                            title={slot.label}
                        >
                            <span
                                className="lumiverse-theme-swatch-color"
                                style={{ background: hslToCSS(localTheme.baseColors[slot.key]) }}
                            />
                            <span className="lumiverse-theme-swatch-label">{slot.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Color Picker */}
            <div className="lumiverse-theme-picker-section">
                <label className="lumiverse-theme-label">
                    Editing: <strong>{COLOR_SLOTS.find(s => s.key === activeSlot)?.label}</strong>
                </label>
                <div className="lumiverse-theme-picker" onPointerDown={() => { presetLockRef.current = false; }}>
                    <HslColorPicker
                        color={currentColor}
                        onChange={handleColorChange}
                    />
                </div>
                <div className="lumiverse-color-inputs">
                    <div className="lumiverse-color-input-group lumiverse-color-input-group--hex">
                        <label className="lumiverse-color-input-label">HEX</label>
                        <input
                            type="text"
                            className="lumiverse-input lumiverse-color-input-hex"
                            value={hexInput}
                            onChange={(e) => setHexInput(e.target.value)}
                            onBlur={() => commitHex(hexInput)}
                            onKeyDown={handleHexKeyDown}
                            spellCheck={false}
                            maxLength={7}
                        />
                    </div>
                    {['r', 'g', 'b'].map(ch => (
                        <div key={ch} className="lumiverse-color-input-group">
                            <label className="lumiverse-color-input-label">{ch.toUpperCase()}</label>
                            <input
                                type="number"
                                className="lumiverse-input lumiverse-color-input-rgb"
                                value={currentRgb[ch]}
                                onChange={(e) => handleRgbChange(ch, e.target.value)}
                                min={0}
                                max={255}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="lumiverse-theme-actions">
                <button
                    type="button"
                    className="lumia-btn lumia-btn-secondary lumia-btn-small"
                    onClick={handleReset}
                    title="Reset to default theme"
                >
                    <RotateCcw size={14} strokeWidth={1.5} />
                    Reset
                </button>
                <button
                    type="button"
                    className="lumia-btn lumia-btn-secondary lumia-btn-small"
                    onClick={handleExport}
                    title="Export theme as JSON"
                >
                    <Download size={14} strokeWidth={1.5} />
                    Export
                </button>
                <button
                    type="button"
                    className="lumia-btn lumia-btn-secondary lumia-btn-small"
                    onClick={() => fileInputRef.current?.click()}
                    title="Import theme from JSON"
                >
                    <Upload size={14} strokeWidth={1.5} />
                    Import
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleImport}
                />
            </div>
        </div>
    );
}
