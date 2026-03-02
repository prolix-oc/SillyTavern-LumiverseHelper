import React, { useState, useCallback, useEffect, useRef } from 'react';
import clsx from 'clsx';
import {
    ArrowLeft, Save, RotateCcw, Upload,
    FileText, Settings, User, BookOpen, Sparkles,
    Plus, Trash2, Loader2, Maximize2,
} from 'lucide-react';
import useCharacterEditor from '../../hooks/useCharacterEditor';
import LazyImage from '../shared/LazyImage';
import {
    EditorContent, EditorSection, FormField, TextInput, TextArea, Select,
} from '../shared/FormComponents';
import TagPillInput from '../shared/TagPillInput';
import ConfirmationModal from '../shared/ConfirmationModal';
import TextExpanderModal from '../shared/TextExpanderModal';
import SyntaxTextArea from '../shared/SyntaxTextArea';

// ─── Wide Mode Tab Definitions ──────────────────────────────────
const WIDE_TABS = [
    { id: 'core', label: 'Core Prompts', Icon: FileText },
    { id: 'system', label: 'System', Icon: Settings },
    { id: 'greetings', label: 'Greetings', Icon: Sparkles },
    { id: 'identity', label: 'Identity', Icon: User },
    { id: 'advanced', label: 'Advanced', Icon: BookOpen },
];

/**
 * Character Card Editor — renders inside CharacterBrowser, replacing the gallery view.
 *
 * Sidebar mode: compact accordion sections with expand-to-modal buttons.
 * Wide mode (gallery modal): horizontal tab bar with inline syntax-highlighted fields.
 */
export default function CharacterCardEditor({ item, onBack, wideMode = false }) {
    const {
        formState, isLoading, isSaving, loadError, isDirty, isNew,
        avatarPreview, worldBookNames,
        updateField, save, revert, setAvatarFile,
        addGreeting, updateGreeting, removeGreeting,
        deleteCharacter, isDeletePending,
    } = useCharacterEditor(item);

    const [showDiscardModal, setShowDiscardModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [expanderField, setExpanderField] = useState(null);
    const [activeTab, setActiveTab] = useState('core');
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
        e.target.value = '';
    }, [setAvatarFile]);

    const displayAvatarUrl = avatarPreview || item.avatarUrl;

    // Renders SyntaxTextArea in wide mode, or TextArea + expand button in sidebar
    const renderTextField = (fieldValue, onFieldChange, { rows, wideRows, placeholder, expandField, expandTitle }) => {
        if (wideMode) {
            return (
                <SyntaxTextArea
                    value={fieldValue}
                    onChange={onFieldChange}
                    rows={wideRows || rows + 3}
                    placeholder={placeholder}
                />
            );
        }
        return (
            <div className="lumiverse-ce-expandable">
                <TextArea
                    value={fieldValue}
                    onChange={onFieldChange}
                    placeholder={placeholder}
                    rows={rows}
                />
                <button
                    className="lumiverse-ce-expand-btn"
                    onClick={() => setExpanderField({ field: expandField, title: expandTitle })}
                    type="button"
                    title="Expand editor"
                >
                    <Maximize2 size={12} />
                </button>
            </div>
        );
    };

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

    // ─── Tab Content Renderers (wide mode) ────────────────────
    const renderCorePrompts = () => (
        <>
            <FormField label="Description" hint="Physical/mental traits, backstory">
                {renderTextField(formState.description, (v) => updateField('description', v), {
                    rows: 5, wideRows: 10, placeholder: 'Character description...',
                    expandField: 'description', expandTitle: 'Description',
                })}
            </FormField>
            <FormField label="Personality" hint="Brief personality summary">
                {renderTextField(formState.personality, (v) => updateField('personality', v), {
                    rows: 3, wideRows: 6, placeholder: 'Personality traits...',
                    expandField: 'personality', expandTitle: 'Personality',
                })}
            </FormField>
            <FormField label="Scenario" hint="Circumstances and context">
                {renderTextField(formState.scenario, (v) => updateField('scenario', v), {
                    rows: 3, wideRows: 6, placeholder: 'Scenario description...',
                    expandField: 'scenario', expandTitle: 'Scenario',
                })}
            </FormField>
            <FormField label="First Message" hint="Opening message when chat starts">
                {renderTextField(formState.first_mes, (v) => updateField('first_mes', v), {
                    rows: 4, wideRows: 8, placeholder: 'First message...',
                    expandField: 'first_mes', expandTitle: 'First Message',
                })}
            </FormField>
            <FormField label="Example Messages" hint="Dialog examples for the AI">
                {renderTextField(formState.mes_example, (v) => updateField('mes_example', v), {
                    rows: 4, wideRows: 8, placeholder: '<START>\n{{user}}: ...\n{{char}}: ...',
                    expandField: 'mes_example', expandTitle: 'Example Messages',
                })}
            </FormField>
        </>
    );

    const renderSystem = () => (
        <>
            <FormField label="System Prompt" hint="V2 system_prompt override">
                {renderTextField(formState.system_prompt, (v) => updateField('system_prompt', v), {
                    rows: 4, wideRows: 8, placeholder: 'System prompt override...',
                    expandField: 'system_prompt', expandTitle: 'System Prompt',
                })}
            </FormField>
            <FormField label="Post-History Instructions" hint="Injected after chat history (jailbreak/PHI)">
                {renderTextField(formState.post_history_instructions, (v) => updateField('post_history_instructions', v), {
                    rows: 3, wideRows: 6, placeholder: 'Post-history instructions...',
                    expandField: 'post_history_instructions', expandTitle: 'Post-History Instructions',
                })}
            </FormField>
        </>
    );

    const renderGreetings = () => (
        <>
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
                                {!wideMode && (
                                    <button
                                        className="lumiverse-ce-greeting-action"
                                        onClick={() => setExpanderField({ field: `greeting_${idx}`, title: `Greeting ${idx + 1}` })}
                                        type="button"
                                        title="Expand editor"
                                    >
                                        <Maximize2 size={12} strokeWidth={2} />
                                    </button>
                                )}
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
                        {wideMode ? (
                            <SyntaxTextArea
                                value={greeting}
                                onChange={(v) => updateGreeting(idx, v)}
                                rows={6}
                                placeholder="Alternate greeting..."
                            />
                        ) : (
                            <TextArea
                                value={greeting}
                                onChange={(v) => updateGreeting(idx, v)}
                                placeholder="Alternate greeting..."
                                rows={3}
                            />
                        )}
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
        </>
    );

    const renderIdentity = () => (
        <>
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
                {renderTextField(formState.creator_notes, (v) => updateField('creator_notes', v), {
                    rows: 3, wideRows: 6, placeholder: 'Notes from the creator...',
                    expandField: 'creator_notes', expandTitle: 'Creator Notes',
                })}
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
        </>
    );

    const renderAdvanced = () => (
        <>
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
            <FormField label="Depth Prompt">
                {renderTextField(formState.depth_prompt_prompt, (v) => updateField('depth_prompt_prompt', v), {
                    rows: 3, wideRows: 6, placeholder: 'Depth prompt content...',
                    expandField: 'depth_prompt_prompt', expandTitle: 'Depth Prompt',
                })}
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
        </>
    );

    const TAB_RENDERERS = { core: renderCorePrompts, system: renderSystem, greetings: renderGreetings, identity: renderIdentity, advanced: renderAdvanced };

    return (
        <div className={clsx('lumiverse-ce-panel', wideMode && 'lumiverse-ce-panel--wide')}>
            {/* ─── Hero Header ─────────────────────────────── */}
            <div className="lumiverse-ce-hero">
                <div className="lumiverse-ce-hero-avatar" onClick={handleAvatarClick} title="Click to change avatar">
                    <LazyImage
                        src={displayAvatarUrl}
                        alt={formState.name}
                        className="lumiverse-ce-hero-avatar-img"
                        spinnerSize={16}
                        fallback={<User size={28} strokeWidth={1.5} />}
                    />
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
                    {!isNew && (
                        <button
                            className="lumiverse-ce-btn lumiverse-ce-btn--danger"
                            onClick={() => setShowDeleteModal(true)}
                            disabled={isSaving || isDeletePending}
                            type="button"
                            title="Delete character"
                        >
                            <Trash2 size={13} strokeWidth={2} />
                        </button>
                    )}
                    {!isNew && (
                        <button
                            className="lumiverse-ce-btn lumiverse-ce-btn--secondary"
                            onClick={revert}
                            disabled={!isDirty || isSaving}
                            type="button"
                            title="Revert changes"
                        >
                            <RotateCcw size={13} strokeWidth={2} />
                        </button>
                    )}
                    <button
                        className="lumiverse-ce-btn lumiverse-ce-btn--primary"
                        onClick={save}
                        disabled={isNew ? isSaving : (!isDirty || isSaving)}
                        type="button"
                        title={isNew ? "Create character" : "Save changes"}
                    >
                        {isSaving ? (
                            <Loader2 size={13} strokeWidth={2} className="lumiverse-cb-spinner" />
                        ) : isNew ? (
                            <Plus size={13} strokeWidth={2} />
                        ) : (
                            <Save size={13} strokeWidth={2} />
                        )}
                        <span>{isNew ? 'Create' : 'Save'}</span>
                    </button>
                </div>
            </div>

            {/* ─── Content Area ────────────────────────────── */}
            {wideMode ? (
                <>
                    {/* Tab Bar */}
                    <div className="lumiverse-ce-tabs">
                        {WIDE_TABS.map(({ id, label, Icon }) => (
                            <button
                                key={id}
                                className={clsx('lumiverse-ce-tab', activeTab === id && 'lumiverse-ce-tab--active')}
                                onClick={() => setActiveTab(id)}
                                type="button"
                            >
                                <Icon size={14} strokeWidth={1.5} />
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Tab Content — scrollable */}
                    <div className="lumiverse-ce-tab-content">
                        {TAB_RENDERERS[activeTab]?.()}
                    </div>
                </>
            ) : (
                <EditorContent className="lumiverse-ce-content">
                    <EditorSection Icon={FileText} title="Core Prompts" defaultExpanded={true}>
                        {renderCorePrompts()}
                    </EditorSection>
                    <EditorSection Icon={Settings} title="System" defaultExpanded={false}>
                        {renderSystem()}
                    </EditorSection>
                    <EditorSection Icon={Sparkles} title="Alternate Greetings" defaultExpanded={false}>
                        {renderGreetings()}
                    </EditorSection>
                    <EditorSection Icon={User} title="Identity & Metadata" defaultExpanded={false}>
                        {renderIdentity()}
                    </EditorSection>
                    <EditorSection Icon={BookOpen} title="Advanced Settings" defaultExpanded={false}>
                        {renderAdvanced()}
                    </EditorSection>
                </EditorContent>
            )}

            {/* ─── Text Expander Modal (sidebar only) ────────── */}
            {!wideMode && (
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
            )}

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

            {/* ─── Delete Character Confirmation ─────────────── */}
            <ConfirmationModal
                isOpen={showDeleteModal}
                variant="danger"
                title="Delete Character"
                message={
                    <>
                        <strong>{item?.name || 'This character'}</strong> will be permanently deleted.
                        <br /><br />
                        Choose whether to also delete all associated chat history, or keep the chat files.
                    </>
                }
                confirmText={isDeletePending ? 'Deleting...' : 'Delete Everything'}
                secondaryText="Keep Chats"
                secondaryVariant="warning"
                cancelText="Cancel"
                onConfirm={async () => {
                    const ok = await deleteCharacter(true);
                    if (ok) { setShowDeleteModal(false); onBack(); }
                }}
                onSecondary={async () => {
                    const ok = await deleteCharacter(false);
                    if (ok) { setShowDeleteModal(false); onBack(); }
                }}
                onCancel={() => setShowDeleteModal(false)}
            />
        </div>
    );
}
