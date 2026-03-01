/**
 * PersonaManager CSS-in-JS styles
 *
 * Glassmorphic identity wardrobe — avatar-first cards with translucent surfaces.
 * All colors via var(--lumiverse-*). Scoped via .lumiverse-pm-* prefix.
 */

export const personaManagerStyles = /* css */`
/* ─── Root ──────────────────────────────────────────────── */
.lumiverse-pm-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    gap: 0;
}

/* ─── Toolbar ───────────────────────────────────────────── */
.lumiverse-pm-toolbar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px 10px;
    flex-shrink: 0;
}

.lumiverse-pm-toolbar-row {
    display: flex;
    align-items: center;
    gap: 6px;
}

.lumiverse-pm-search {
    position: relative;
    flex: 1;
    min-width: 0;
}

.lumiverse-pm-search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--lumiverse-text-dim);
    pointer-events: none;
    display: flex;
}

.lumiverse-pm-search-input {
    width: 100%;
    padding: 7px 30px 7px 32px;
    background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.15));
    border: 1px solid var(--lumiverse-border);
    border-radius: 8px;
    color: var(--lumiverse-text);
    font-size: 12.5px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.lumiverse-pm-search-input:focus {
    border-color: var(--lumiverse-primary);
    box-shadow: 0 0 0 2px var(--lumiverse-primary-010, rgba(var(--lumiverse-primary-rgb, 139,92,246), 0.1));
}

.lumiverse-pm-search-input::placeholder {
    color: var(--lumiverse-text-dim);
}

.lumiverse-pm-search-clear {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--lumiverse-text-dim);
    cursor: pointer;
    padding: 4px;
    display: flex;
    border-radius: 4px;
}

.lumiverse-pm-search-clear:hover {
    color: var(--lumiverse-text);
    background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.1));
}

/* ─── Filter Pills ──────────────────────────────────────── */
.lumiverse-pm-filters {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
}

.lumiverse-pm-filter-btn {
    padding: 4px 10px;
    border: 1px solid var(--lumiverse-border);
    border-radius: 14px;
    background: transparent;
    color: var(--lumiverse-text-muted);
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
}

.lumiverse-pm-filter-btn:hover {
    border-color: var(--lumiverse-text-dim);
    color: var(--lumiverse-text);
}

.lumiverse-pm-filter-btn--active {
    background: var(--lumiverse-primary-010, rgba(var(--lumiverse-primary-rgb, 139,92,246), 0.12));
    border-color: var(--lumiverse-primary);
    color: var(--lumiverse-primary);
}

/* ─── Toolbar Buttons ───────────────────────────────────── */
.lumiverse-pm-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--lumiverse-border);
    border-radius: 8px;
    background: transparent;
    color: var(--lumiverse-text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s ease;
}

.lumiverse-pm-icon-btn:hover {
    background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.1));
    color: var(--lumiverse-text);
    border-color: var(--lumiverse-text-dim);
}

.lumiverse-pm-icon-btn--primary {
    background: var(--lumiverse-primary-010, rgba(var(--lumiverse-primary-rgb, 139,92,246), 0.12));
    border-color: var(--lumiverse-primary);
    color: var(--lumiverse-primary);
}

.lumiverse-pm-icon-btn--primary:hover {
    background: var(--lumiverse-primary-020, rgba(var(--lumiverse-primary-rgb, 139,92,246), 0.2));
}

/* ─── Sort Dropdown ─────────────────────────────────────── */
.lumiverse-pm-sort {
    position: relative;
}

.lumiverse-pm-sort-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    border: 1px solid var(--lumiverse-border);
    border-radius: 8px;
    background: transparent;
    color: var(--lumiverse-text-muted);
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
}

.lumiverse-pm-sort-btn:hover {
    color: var(--lumiverse-text);
    border-color: var(--lumiverse-text-dim);
}

.lumiverse-pm-sort-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 120px;
    padding: 4px;
    background: var(--lumiverse-bg-elevated, rgba(30,30,40,0.95));
    border: 1px solid var(--lumiverse-border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    z-index: 20;
    backdrop-filter: blur(12px);
}

.lumiverse-pm-sort-option {
    display: block;
    width: 100%;
    padding: 6px 10px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--lumiverse-text-muted);
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s ease;
}

.lumiverse-pm-sort-option:hover {
    background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.15));
    color: var(--lumiverse-text);
}

.lumiverse-pm-sort-option--active {
    color: var(--lumiverse-primary);
}

.lumiverse-pm-sort-divider {
    height: 1px;
    background: var(--lumiverse-border);
    margin: 4px 6px;
}

/* ─── Persona Count ─────────────────────────────────────── */
.lumiverse-pm-count {
    font-size: 11px;
    color: var(--lumiverse-text-dim);
    padding: 0 2px;
    white-space: nowrap;
}

/* ─── Scrollable Content ────────────────────────────────── */
.lumiverse-pm-content {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 6px 14px 14px;
}

/* ─── Grid View ─────────────────────────────────────────── */
.lumiverse-pm-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
}

/* ─── Grid: Inline Editor Span ─────────────────────────── */
.lumiverse-pm-grid > .lumiverse-pm-editor {
    grid-column: 1 / -1;
}

/* ─── List View ─────────────────────────────────────────── */
.lumiverse-pm-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

/* ─── Persona Card (Grid) ───────────────────────────────── */
.lumiverse-pm-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 6px 8px;
    border-radius: 10px;
    background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.12));
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    overflow: hidden;
}

.lumiverse-pm-card:hover {
    background: var(--lumiverse-fill-light, rgba(0,0,0,0.18));
    border-color: var(--lumiverse-border);
}

.lumiverse-pm-card--selected {
    background: var(--lumiverse-primary-010, rgba(var(--lumiverse-primary-rgb, 139,92,246), 0.1));
    border-color: var(--lumiverse-primary);
    box-shadow: 0 0 0 1px var(--lumiverse-primary-010, rgba(var(--lumiverse-primary-rgb, 139,92,246), 0.1));
}

.lumiverse-pm-card--active {
    box-shadow: 0 0 8px var(--lumiverse-primary-020, rgba(var(--lumiverse-primary-rgb, 139,92,246), 0.25));
}

.lumiverse-pm-card-avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--lumiverse-fill-medium, rgba(0,0,0,0.2));
    flex-shrink: 0;
    margin-bottom: 6px;
}

.lumiverse-pm-card-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.lumiverse-pm-card-avatar--placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--lumiverse-text-dim);
}

.lumiverse-pm-card-name {
    font-size: 11.5px;
    font-weight: 500;
    color: var(--lumiverse-text);
    text-align: center;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.3;
}

/* ─── Lock Badges ───────────────────────────────────────── */
.lumiverse-pm-badges {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    gap: 2px;
}

.lumiverse-pm-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 9px;
    font-size: 10px;
}

.lumiverse-pm-badge--default {
    background: var(--lumiverse-warning-010, rgba(250,204,21,0.15));
    color: var(--lumiverse-warning, #facc15);
}

.lumiverse-pm-badge--locked {
    background: var(--lumiverse-primary-010, rgba(var(--lumiverse-primary-rgb, 139,92,246), 0.15));
    color: var(--lumiverse-primary);
}

.lumiverse-pm-badge--connected {
    background: var(--lumiverse-success-010, rgba(34,197,94,0.15));
    color: var(--lumiverse-success, #22c55e);
}

/* ─── Persona Card (List) ───────────────────────────────── */
.lumiverse-pm-list-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.1));
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
}

.lumiverse-pm-list-card:hover {
    background: var(--lumiverse-fill-light, rgba(0,0,0,0.16));
    border-color: var(--lumiverse-border);
}

.lumiverse-pm-list-card--selected {
    background: var(--lumiverse-primary-010, rgba(var(--lumiverse-primary-rgb, 139,92,246), 0.1));
    border-color: var(--lumiverse-primary);
}

.lumiverse-pm-list-card--active {
    box-shadow: 0 0 6px var(--lumiverse-primary-020, rgba(var(--lumiverse-primary-rgb, 139,92,246), 0.2));
}

.lumiverse-pm-list-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--lumiverse-fill-medium, rgba(0,0,0,0.2));
    flex-shrink: 0;
}

.lumiverse-pm-list-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.lumiverse-pm-list-info {
    flex: 1;
    min-width: 0;
}

.lumiverse-pm-list-name {
    font-size: 12.5px;
    font-weight: 500;
    color: var(--lumiverse-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.lumiverse-pm-list-title {
    font-size: 11px;
    color: var(--lumiverse-text-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 1px;
}

.lumiverse-pm-list-badges {
    display: flex;
    gap: 3px;
    flex-shrink: 0;
}

/* ─── Create Form ───────────────────────────────────────── */
.lumiverse-pm-create {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.1));
    border-bottom: 1px solid var(--lumiverse-border);
    flex-shrink: 0;
}

.lumiverse-pm-create-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px dashed var(--lumiverse-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--lumiverse-text-dim);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s ease;
    overflow: hidden;
    background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.1));
}

.lumiverse-pm-create-avatar:hover {
    border-color: var(--lumiverse-primary);
    color: var(--lumiverse-primary);
}

.lumiverse-pm-create-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.lumiverse-pm-create-input {
    flex: 1;
    min-width: 0;
    padding: 7px 10px;
    background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.12));
    border: 1px solid var(--lumiverse-border);
    border-radius: 8px;
    color: var(--lumiverse-text);
    font-size: 12.5px;
    font-family: inherit;
    outline: none;
}

.lumiverse-pm-create-input:focus {
    border-color: var(--lumiverse-primary);
}

.lumiverse-pm-create-input::placeholder {
    color: var(--lumiverse-text-dim);
}

.lumiverse-pm-create-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
}

/* ─── Editor Panel ──────────────────────────────────────── */
.lumiverse-pm-editor {
    background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.08));
    border: 1px solid var(--lumiverse-border);
    border-radius: 10px;
    margin: 8px 0;
    overflow: hidden;
    animation: lumiversePmSlideDown 0.2s ease;
}

@keyframes lumiversePmSlideDown {
    from { opacity: 0; max-height: 0; }
    to { opacity: 1; max-height: 2000px; }
}

.lumiverse-pm-editor-inner {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

/* ─── Editor: Avatar Drop Zone ──────────────────────────── */
.lumiverse-pm-avatar-zone {
    display: flex;
    align-items: center;
    gap: 12px;
}

.lumiverse-pm-avatar-preview {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--lumiverse-fill-medium, rgba(0,0,0,0.2));
    flex-shrink: 0;
    position: relative;
    cursor: pointer;
}

.lumiverse-pm-avatar-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.lumiverse-pm-avatar-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    opacity: 0;
    transition: opacity 0.15s ease;
    border-radius: 50%;
}

.lumiverse-pm-avatar-preview:hover .lumiverse-pm-avatar-overlay {
    opacity: 1;
}

.lumiverse-pm-avatar-fields {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

/* ─── Editor: Section Headers ───────────────────────────── */
.lumiverse-pm-section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--lumiverse-text-dim);
    margin-bottom: 6px;
}

/* ─── Editor: Description Controls ──────────────────────── */
.lumiverse-pm-desc-controls {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.lumiverse-pm-desc-select {
    padding: 5px 8px;
    background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.12));
    border: 1px solid var(--lumiverse-border);
    border-radius: 6px;
    color: var(--lumiverse-text);
    font-size: 11.5px;
    font-family: inherit;
    cursor: pointer;
    appearance: none;
    min-width: 0;
}

.lumiverse-pm-desc-select:focus {
    border-color: var(--lumiverse-primary);
    outline: none;
}

/* ─── Editor: Action Buttons ────────────────────────────── */
.lumiverse-pm-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    padding-top: 10px;
    border-top: 1px solid var(--lumiverse-border);
}

.lumiverse-pm-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 7px;
    font-size: 12px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--lumiverse-border);
    background: transparent;
    color: var(--lumiverse-text-muted);
    transition: all 0.15s ease;
    white-space: nowrap;
}

.lumiverse-pm-btn:hover {
    background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.1));
    color: var(--lumiverse-text);
    border-color: var(--lumiverse-text-dim);
}

.lumiverse-pm-btn--primary {
    background: var(--lumiverse-primary-010, rgba(var(--lumiverse-primary-rgb, 139,92,246), 0.12));
    border-color: var(--lumiverse-primary);
    color: var(--lumiverse-primary);
}

.lumiverse-pm-btn--primary:hover {
    background: var(--lumiverse-primary-020, rgba(var(--lumiverse-primary-rgb, 139,92,246), 0.2));
}

.lumiverse-pm-btn--danger {
    color: var(--lumiverse-danger, #ef4444);
}

.lumiverse-pm-btn--danger:hover {
    background: rgba(239,68,68,0.1);
    border-color: var(--lumiverse-danger, #ef4444);
    color: var(--lumiverse-danger, #ef4444);
}

/* ─── Empty State ───────────────────────────────────────── */
.lumiverse-pm-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    color: var(--lumiverse-text-dim);
    gap: 10px;
}

.lumiverse-pm-empty-icon {
    opacity: 0.4;
}

.lumiverse-pm-empty-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--lumiverse-text-muted);
}

.lumiverse-pm-empty-subtitle {
    font-size: 12px;
    line-height: 1.4;
}

/* ─── Textarea ──────────────────────────────────────────── */
.lumiverse-pm-textarea {
    width: 100%;
    padding: 8px 10px;
    background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.12));
    border: 1px solid var(--lumiverse-border);
    border-radius: 8px;
    color: var(--lumiverse-text);
    font-size: 12.5px;
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
    min-height: 60px;
    outline: none;
    transition: border-color 0.15s ease;
}

.lumiverse-pm-textarea:focus {
    border-color: var(--lumiverse-primary);
}

/* ─── Input ─────────────────────────────────────────────── */
.lumiverse-pm-input {
    width: 100%;
    padding: 7px 10px;
    background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.12));
    border: 1px solid var(--lumiverse-border);
    border-radius: 8px;
    color: var(--lumiverse-text);
    font-size: 12.5px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s ease;
}

.lumiverse-pm-input:focus {
    border-color: var(--lumiverse-primary);
}

/* ─── Connections List ──────────────────────────────────── */
.lumiverse-pm-connections {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.lumiverse-pm-connection {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-radius: 6px;
    background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.08));
    font-size: 12px;
    color: var(--lumiverse-text-muted);
}

.lumiverse-pm-connection-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.lumiverse-pm-connection-remove {
    background: none;
    border: none;
    color: var(--lumiverse-text-dim);
    cursor: pointer;
    padding: 2px;
    display: flex;
    border-radius: 4px;
}

.lumiverse-pm-connection-remove:hover {
    color: var(--lumiverse-danger, #ef4444);
}

/* ─── Toggle Switches ───────────────────────────────────── */
.lumiverse-pm-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
}

.lumiverse-pm-toggle-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: var(--lumiverse-text-muted);
}

.lumiverse-pm-toggle {
    position: relative;
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: var(--lumiverse-fill-medium, rgba(0,0,0,0.25));
    border: 1px solid var(--lumiverse-border);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
}

.lumiverse-pm-toggle--on {
    background: var(--lumiverse-primary);
    border-color: var(--lumiverse-primary);
}

.lumiverse-pm-toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s ease;
}

.lumiverse-pm-toggle--on .lumiverse-pm-toggle-knob {
    transform: translateX(16px);
}

/* ─── Confirmation Overlay ──────────────────────────────── */
.lumiverse-pm-confirm {
    padding: 12px;
    background: var(--lumiverse-fill-medium, rgba(0,0,0,0.2));
    border-radius: 8px;
    text-align: center;
}

.lumiverse-pm-confirm-text {
    font-size: 12.5px;
    color: var(--lumiverse-text);
    margin-bottom: 10px;
}

.lumiverse-pm-confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
}

/* ─── Mobile (2-column grid) ────────────────────────────── */
@media (max-width: 600px) {
    .lumiverse-pm-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}
`;
