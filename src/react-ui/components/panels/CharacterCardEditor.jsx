import React, { useState, useCallback, useEffect, useRef } from 'react';
import clsx from 'clsx';
import {
    ArrowLeft, Save, RotateCcw, Upload,
    FileText, Settings, User, BookOpen, Sparkles,
    Plus, Trash2, Loader2, Maximize2,
} from 'lucide-react';
import useCharacterEditor from '../../hooks/useCharacterEditor';
import {
    EditorContent, EditorSection, FormField, TextInput, TextArea, Select,
} from '../shared/FormComponents';
import TagPillInput from '../shared/TagPillInput';
import ConfirmationModal from '../shared/ConfirmationModal';
import TextExpanderModal from '../shared/TextExpanderModal';

/**
 * Character Card Editor — renders inside CharacterBrowser, replacing the gallery view.
 *
 * @param {Object} props
 * @param {Object} props.item - Normalized character item from the browser
 * @param {Function} props.onBack - Return to gallery view
 */
export default function CharacterCardEditor({ item, onBack }) {
    const {
        formState, isLoading, isSaving, loadError, isDirty,
        avatarPreview, worldBookNames,
        updateField, save, revert, setAvatarFile,
        addGreeting, updateGreeting, removeGreeting,
    } = useCharacterEditor(item);

    const [showDiscardModal, setShowDiscardModal] = useState(false);
    const [expanderField, setExpanderField] = useState(null);
    const fileInputRef = useRef(null);

    // Ctrl+S / Cmd+S to save
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (isDirty && !isSaving) save();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isDirty, isSaving, save]);

    // Back button with unsaved changes guard
    const handleBack = useCallback(() => {
        if (isDirty) {
            setShowDiscardModal(true);
        } else {
            onBack();
        }
    }, [isDirty, onBack]);

    const handleDiscard = useCallback(() => {
        setShowDiscardModal(false);
        onBack();
    }, [onBack]);

    const handleSaveAndClose = useCallback(async () => {
        setShowDiscardModal(false);
        const ok = await save();
        if (ok) onBack();
    }, [save, onBack]);

    // Avatar upload
    const handleAvatarClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleAvatarChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (file) setAvatarFile(file);
        // Reset input so re-selecting the same file triggers change
        e.target.value = '';
    }, [setAvatarFile]);

    // Resolve display avatar URL
    const displayAvatarUrl = avatarPreview || item.avatarUrl;

    // ─── Loading State ────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="lumiverse-ce-loading">
                <Loader2 size={24} strokeWidth={1.5} className="lumiverse-cb-spinner" />
                <span>Loading character data&hellip;</span>
            </div>
        );
    }

    // ─── Error State ──────────────────────────────────────────
    if (loadError || !formState) {
        return (
            <div className="lumiverse-ce-loading">
                <span style={{ color: 'var(--lumiverse-danger)' }}>
                    {loadError || 'Failed to load character data'}
                </span>
                <button
                    className="lumiverse-ce-btn lumiverse-ce-btn--secondary"
                    onClick={onBack}
                    type="button"
                    style={{ marginTop: '12px' }}
                >
                    <ArrowLeft size={14} strokeWidth={2} />
                    <span>Back</span>
                </button>
            </div>
        );
    }

    return (
        <div className="lumiverse-ce-panel">
            {/* ─── Hero Header ─────────────────────────────── */}
            <div className="lumiverse-ce-hero">
                <div className="lumiverse-ce-hero-avatar" onClick={handleAvatarClick} title="Click to change avatar">
                    {displayAvatarUrl ? (
                        <img src={displayAvatarUrl} alt={formState.name} className="lumiverse-ce-hero-avatar-img" />
                    ) : (
                        <User size={28} strokeWidth={1.5} />
                    )}
                    <div className="lumiverse-ce-avatar-overlay">
                        <Upload size={14} strokeWidth={2} />
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        style={{ display: 'none' }}
                    />
                </div>
                <div className="lumiverse-ce-hero-info">
                    <span className="lumiverse-ce-hero-name" title={formState.name}>
                        {formState.name}
                    </span>
                    {formState.creator && (
                        <span className="lumiverse-ce-hero-creator">by {formState.creator}</span>
                    )}
                </div>
            </div>

            {/* ─── Action Bar ─────────────────────────────── */}
            <div className="lumiverse-ce-header">
                <button
                    className="lumiverse-ce-back-btn"
                    onClick={handleBack}
                    type="button"
                    title="Back to browser"
                >
                    <ArrowLeft size={14} strokeWidth={2} />
                    <span>Back</span>
                </button>

                {isDirty && <span className="lumiverse-ce-dirty-dot" title="Unsaved changes" />}

                <div className="lumiverse-ce-actions">
                    <button
                        className="lumiverse-ce-btn lumiverse-ce-btn--secondary"
                        onClick={revert}
                        disabled={!isDirty || isSaving}
                        type="button"
                        title="Revert changes"
                    >
                        <RotateCcw size={13} strokeWidth={2} />
                    </button>
                    <button
                        className="lumiverse-ce-btn lumiverse-ce-btn--primary"
                        onClick={save}
                        disabled={!isDirty || isSaving}
                        type="button"
                        title="Save changes"
                    >
                        {isSaving ? (
                            <Loader2 size={13} strokeWidth={2} className="lumiverse-cb-spinner" />
                        ) : (
                            <Save size={13} strokeWidth={2} />
                        )}
                        <span>Save</span>
                    </button>
                </div>
            </div>

            {/* ─── Scrollable Content ───────────────────────── */}
            <EditorContent className="lumiverse-ce-content">

                {/* Core Prompts */}
                <EditorSection Icon={FileText} title="Core Prompts" defaultExpanded={true}>
                    <FormField label="Description" hint="Physical/mental traits, backstory">
                        <div className="lumiverse-ce-expandable">
                            <TextArea
                                value={formState.description}
                                onChange={(v) => updateField('description', v)}
                                placeholder="Character description..."
                                rows={5}
                            />
                            <button
                                className="lumiverse-ce-expand-btn"
                                onClick={() => setExpanderField({ field: 'description', title: 'Description' })}
                                type="button"
                                title="Expand editor"
                            >
                                <Maximize2 size={12} />
                            </button>
                        </div>
                    </FormField>
                    <FormField label="Personality" hint="Brief personality summary">
                        <div className="lumiverse-ce-expandable">
                            <TextArea
                                value={formState.personality}
                                onChange={(v) => updateField('personality', v)}
                                placeholder="Personality traits..."
                                rows={3}
                            />
                            <button
                                className="lumiverse-ce-expand-btn"
                                onClick={() => setExpanderField({ field: 'personality', title: 'Personality' })}
                                type="button"
                                title="Expand editor"
                            >
                                <Maximize2 size={12} />
                            </button>
                        </div>
                    </FormField>
                    <FormField label="Scenario" hint="Circumstances and context">
                        <div className="lumiverse-ce-expandable">
                            <TextArea
                                value={formState.scenario}
                                onChange={(v) => updateField('scenario', v)}
                                placeholder="Scenario description..."
                                rows={3}
                            />
                            <button
                                className="lumiverse-ce-expand-btn"
                                onClick={() => setExpanderField({ field: 'scenario', title: 'Scenario' })}
                                type="button"
                                title="Expand editor"
                            >
                                <Maximize2 size={12} />
                            </button>
                        </div>
                    </FormField>
                    <FormField label="First Message" hint="Opening message when chat starts">
                        <div className="lumiverse-ce-expandable">
                            <TextArea
                                value={formState.first_mes}
                                onChange={(v) => updateField('first_mes', v)}
                                placeholder="First message..."
                                rows={4}
                            />
                            <button
                                className="lumiverse-ce-expand-btn"
                                onClick={() => setExpanderField({ field: 'first_mes', title: 'First Message' })}
                                type="button"
                                title="Expand editor"
                            >
                                <Maximize2 size={12} />
                            </button>
                        </div>
                    </FormField>
                    <FormField label="Example Messages" hint="Dialog examples for the AI">
                        <div className="lumiverse-ce-expandable">
                            <TextArea
                                value={formState.mes_example}
                                onChange={(v) => updateField('mes_example', v)}
                                placeholder="<START>\n{{user}}: ...\n{{char}}: ..."
                                rows={4}
                            />
                            <button
                                className="lumiverse-ce-expand-btn"
                                onClick={() => setExpanderField({ field: 'mes_example', title: 'Example Messages' })}
                                type="button"
                                title="Expand editor"
                            >
                                <Maximize2 size={12} />
                            </button>
                        </div>
                    </FormField>
                </EditorSection>

                {/* System */}
                <EditorSection Icon={Settings} title="System" defaultExpanded={false}>
                    <FormField label="System Prompt" hint="V2 system_prompt override">
                        <div className="lumiverse-ce-expandable">
                            <TextArea
                                value={formState.system_prompt}
                                onChange={(v) => updateField('system_prompt', v)}
                                placeholder="System prompt override..."
                                rows={4}
                            />
                            <button
                                className="lumiverse-ce-expand-btn"
                                onClick={() => setExpanderField({ field: 'system_prompt', title: 'System Prompt' })}
                                type="button"
                                title="Expand editor"
                            >
                                <Maximize2 size={12} />
                            </button>
                        </div>
                    </FormField>
                    <FormField label="Post-History Instructions" hint="Injected after chat history (jailbreak/PHI)">
                        <div className="lumiverse-ce-expandable">
                            <TextArea
                                value={formState.post_history_instructions}
                                onChange={(v) => updateField('post_history_instructions', v)}
                                placeholder="Post-history instructions..."
                                rows={3}
                            />
                            <button
                                className="lumiverse-ce-expand-btn"
                                onClick={() => setExpanderField({ field: 'post_history_instructions', title: 'Post-History Instructions' })}
                                type="button"
                                title="Expand editor"
                            >
                                <Maximize2 size={12} />
                            </button>
                        </div>
                    </FormField>
                </EditorSection>

                {/* Alternate Greetings */}
                <EditorSection Icon={Sparkles} title="Alternate Greetings" defaultExpanded={false}>
                    {formState.alternate_greetings.length === 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--lumiverse-text-dim)', marginBottom: '12px' }}>
                            No alternate greetings. Add one below.
                        </div>
                    ) : (
                        formState.alternate_greetings.map((greeting, idx) => (
                            <div key={idx} className="lumiverse-ce-greeting-item">
                                <div className="lumiverse-ce-greeting-header">
                                    <span className="lumiverse-ce-greeting-label">Greeting {idx + 1}</span>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        <button
                                            className="lumiverse-ce-greeting-action"
                                            onClick={() => setExpanderField({ field: `greeting_${idx}`, title: `Greeting ${idx + 1}` })}
                                            type="button"
                                            title="Expand editor"
                                        >
                                            <Maximize2 size={12} strokeWidth={2} />
                                        </button>
                                        <button
                                            className="lumiverse-ce-greeting-delete"
                                            onClick={() => removeGreeting(idx)}
                                            type="button"
                                            title="Remove greeting"
                                        >
                                            <Trash2 size={12} strokeWidth={2} />
                                        </button>
                                    </div>
                                </div>
                                <TextArea
                                    value={greeting}
                                    onChange={(v) => updateGreeting(idx, v)}
                                    placeholder="Alternate greeting..."
                                    rows={3}
                                />
                            </div>
                        ))
                    )}
                    <button
                        className="lumiverse-ce-btn lumiverse-ce-btn--secondary lumiverse-ce-add-greeting"
                        onClick={addGreeting}
                        type="button"
                    >
                        <Plus size={13} strokeWidth={2} />
                        <span>Add Greeting</span>
                    </button>
                </EditorSection>

                {/* Identity & Metadata */}
                <EditorSection Icon={User} title="Identity & Metadata" defaultExpanded={false}>
                    <FormField label="Name">
                        <TextInput
                            value={formState.name}
                            onChange={(v) => updateField('name', v)}
                            placeholder="Character name"
                        />
                    </FormField>
                    <FormField label="Creator">
                        <TextInput
                            value={formState.creator}
                            onChange={(v) => updateField('creator', v)}
                            placeholder="Creator name"
                        />
                    </FormField>
                    <FormField label="Creator Notes">
                        <div className="lumiverse-ce-expandable">
                            <TextArea
                                value={formState.creator_notes}
                                onChange={(v) => updateField('creator_notes', v)}
                                placeholder="Notes from the creator..."
                                rows={3}
                            />
                            <button
                                className="lumiverse-ce-expand-btn"
                                onClick={() => setExpanderField({ field: 'creator_notes', title: 'Creator Notes' })}
                                type="button"
                                title="Expand editor"
                            >
                                <Maximize2 size={12} />
                            </button>
                        </div>
                    </FormField>
                    <FormField label="Version">
                        <TextInput
                            value={formState.character_version}
                            onChange={(v) => updateField('character_version', v)}
                            placeholder="e.g. 1.0"
                        />
                    </FormField>
                    <FormField label="Tags" hint="Press Enter or comma to add">
                        <TagPillInput
                            value={Array.isArray(formState.tags) ? formState.tags : []}
                            onChange={(tags) => updateField('tags', tags)}
                            placeholder="Add tag..."
                        />
                    </FormField>
                </EditorSection>

                {/* Advanced Settings */}
                <EditorSection Icon={BookOpen} title="Advanced Settings" defaultExpanded={false}>
                    {/* Talkativeness */}
                    <FormField label="Talkativeness" hint={`${(formState.talkativeness * 100).toFixed(0)}%`}>
                        <div className="lumiverse-ce-talkativeness">
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={formState.talkativeness}
                                onChange={(e) => updateField('talkativeness', parseFloat(e.target.value))}
                                className="lumiverse-ce-range"
                            />
                            <span className="lumiverse-ce-range-value">
                                {(formState.talkativeness * 100).toFixed(0)}%
                            </span>
                        </div>
                    </FormField>

                    {/* Favorite */}
                    <FormField label="Favorite">
                        <label className="lumiverse-ce-checkbox-label">
                            <input
                                type="checkbox"
                                checked={formState.fav}
                                onChange={(e) => updateField('fav', e.target.checked)}
                            />
                            <span>Mark as favorite</span>
                        </label>
                    </FormField>

                    {/* World/Lorebook */}
                    <FormField label="World / Lorebook" hint="Associated world book">
                        <Select
                            value={formState.world}
                            onChange={(v) => updateField('world', v)}
                            options={[
                                { value: '', label: '--- None ---' },
                                ...worldBookNames.map((name) => ({ value: name, label: name })),
                            ]}
                        />
                    </FormField>

                    {/* Depth Prompt */}
                    <FormField label="Depth Prompt">
                        <div className="lumiverse-ce-expandable">
                            <TextArea
                                value={formState.depth_prompt_prompt}
                                onChange={(v) => updateField('depth_prompt_prompt', v)}
                                placeholder="Depth prompt content..."
                                rows={3}
                            />
                            <button
                                className="lumiverse-ce-expand-btn"
                                onClick={() => setExpanderField({ field: 'depth_prompt_prompt', title: 'Depth Prompt' })}
                                type="button"
                                title="Expand editor"
                            >
                                <Maximize2 size={12} />
                            </button>
                        </div>
                    </FormField>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <FormField label="Depth" className="lumiverse-ce-half-field">
                            <TextInput
                                value={String(formState.depth_prompt_depth)}
                                onChange={(v) => {
                                    const n = parseInt(v, 10);
                                    if (!isNaN(n) && n >= 0) updateField('depth_prompt_depth', n);
                                }}
                                placeholder="4"
                            />
                        </FormField>
                        <FormField label="Role" className="lumiverse-ce-half-field">
                            <Select
                                value={formState.depth_prompt_role}
                                onChange={(v) => updateField('depth_prompt_role', v)}
                                options={[
                                    { value: 'system', label: 'System' },
                                    { value: 'user', label: 'User' },
                                    { value: 'assistant', label: 'Assistant' },
                                ]}
                            />
                        </FormField>
                    </div>
                </EditorSection>

            </EditorContent>

            {/* ─── Text Expander Modal ─────────────────────── */}
            <TextExpanderModal
                isOpen={!!expanderField}
                onClose={() => setExpanderField(null)}
                title={expanderField?.title || ''}
                value={
                    expanderField?.field?.startsWith('greeting_')
                        ? formState.alternate_greetings[parseInt(expanderField.field.split('_')[1], 10)] || ''
                        : (expanderField ? formState[expanderField.field] || '' : '')
                }
                onChange={(v) => {
                    if (!expanderField) return;
                    if (expanderField.field.startsWith('greeting_')) {
                        updateGreeting(parseInt(expanderField.field.split('_')[1], 10), v);
                    } else {
                        updateField(expanderField.field, v);
                    }
                }}
            />

            {/* ─── Unsaved Changes Confirmation ──────────────── */}
            <ConfirmationModal
                isOpen={showDiscardModal}
                onCancel={() => setShowDiscardModal(false)}
                onConfirm={handleSaveAndClose}
                onSecondary={handleDiscard}
                title="Unsaved Changes"
                message="You have unsaved changes. What would you like to do?"
                variant="warning"
                confirmText="Save & Close"
                cancelText="Cancel"
                secondaryText="Discard"
                secondaryVariant="danger"
            />
        </div>
    );
}
