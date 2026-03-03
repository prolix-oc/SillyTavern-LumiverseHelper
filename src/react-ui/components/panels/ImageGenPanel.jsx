/**
 * ImageGenPanel - Settings panel for scene-aware image generation
 * Controls provider selection, API keys, scene detection, and background display
 */

import React, { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { Image as ImageIcon, Settings, Eye, Layers, Trash2, Plus, Loader, Sparkles, X, RefreshCw } from 'lucide-react';
import { useLumiverseStore } from '../../store/LumiverseContext';
import { useImageGenSettings } from '../../hooks/useImageGenSettings';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { IMAGEGEN_PROVIDERS, fetchNanoGptModels } from '../../../lib/imageProviders';
import ImageLightbox from '../shared/ImageLightbox';

const store = useLumiverseStore;

// Stable selectors
const selectImageGen = () => store.getState().imageGeneration || {};
const selectConnectionRegistry = () => store.getState().connectionManager?.registry || {};

/**
 * Toggle switch (matches OOCSettings pattern)
 */
function Toggle({ id, checked, onChange, label, hint }) {
    return (
        <div className="lumiverse-vp-toggle-row">
            <label className="lumiverse-vp-toggle-label" htmlFor={id}>
                <span className="lumiverse-vp-toggle-text">{label}</span>
                {hint && <span className="lumiverse-vp-toggle-hint">{hint}</span>}
            </label>
            <div className="lumiverse-vp-toggle-switch-wrapper">
                <input
                    type="checkbox"
                    id={id}
                    className="lumiverse-vp-toggle-input"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <label htmlFor={id} className="lumiverse-vp-toggle-switch-label">
                    <div className={clsx('lumiverse-vp-toggle-track', checked && 'lumiverse-vp-toggle-track--on')}>
                        <div className="lumiverse-vp-toggle-thumb" />
                    </div>
                </label>
            </div>
        </div>
    );
}

/**
 * Dropdown select field
 */
function SelectField({ id, label, hint, value, onChange, options }) {
    return (
        <div className="lumiverse-vp-field">
            <label className="lumiverse-vp-field-label" htmlFor={id}>{label}</label>
            <select
                id={id}
                className="lumiverse-vp-field-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            {hint && <span className="lumiverse-vp-field-hint">{hint}</span>}
        </div>
    );
}

/**
 * Slider field with value display
 */
function SliderField({ id, label, hint, value, onChange, min, max, step = 1, format }) {
    const displayValue = format ? format(value) : value;
    return (
        <div className="lumiverse-vp-field">
            <label className="lumiverse-vp-field-label" htmlFor={id}>
                {label}: <strong>{displayValue}</strong>
            </label>
            <input
                type="range"
                id={id}
                className="lumiverse-vp-field-slider"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                min={min}
                max={max}
                step={step}
            />
            {hint && <span className="lumiverse-vp-field-hint">{hint}</span>}
        </div>
    );
}

/**
 * Reference image thumbnail grid
 */
function ReferenceImageGrid({ images, onRemove }) {
    if (!images || images.length === 0) return null;

    return (
        <div className="lumiverse-ig-ref-grid">
            {images.map((img, i) => (
                <div key={img.id || `ref-${i}`} className="lumiverse-ig-ref-item">
                    <img
                        src={`data:${img.mimeType || 'image/png'};base64,${img.data}`}
                        alt={img.name || `Reference ${i + 1}`}
                        className="lumiverse-ig-ref-thumb"
                    />
                    <button
                        className="lumiverse-ig-ref-remove"
                        onClick={() => onRemove(img.id, i)}
                        title="Remove reference image"
                        type="button"
                    >
                        <X size={12} />
                    </button>
                </div>
            ))}
        </div>
    );
}

/**
 * Main Image Generation settings panel
 */
function ImageGenPanel() {
    const {
        settings,
        sceneBackground,
        sceneGenerating,
        lastSceneParams,
        updateSettings,
        updateGoogleSettings,
        updateNanoGptSettings,
        updateNovelAiSettings,
        triggerGeneration,
        cancelGeneration,
        clearBackground,
        addReferenceImage,
        removeReferenceImage,
    } = useImageGenSettings();

    const fileInputRef = useRef(null);
    // Seed dynamic models from persisted fetchedModels (survives panel remount)
    const [dynamicModels, setDynamicModels] = useState(() => settings.nanogpt?.fetchedModels || null);
    const [modelsFetching, setModelsFetching] = useState(false);
    const [genError, setGenError] = useState(null);
    const [lightboxOpen, setLightboxOpen] = useState(false);

    // Connection profile registry
    const registry = useSyncExternalStore(store.subscribe, selectConnectionRegistry, selectConnectionRegistry);
    const allProfiles = Object.values(registry);

    const googleSettings = settings.google || {};
    const nanoGptSettings = settings.nanogpt || {};
    const novelAiSettings = settings.novelai || {};
    const provider = settings.provider || 'google_gemini';
    const providerConfig = IMAGEGEN_PROVIDERS[provider];

    // Provider model options — for Nano-GPT, merge dynamic models if available
    const modelOptions = (() => {
        if (provider === 'nanogpt' && dynamicModels) {
            return dynamicModels.map(m => ({ value: m.id, label: m.label }));
        }
        return (providerConfig?.models || []).map(m => ({
            value: m.id,
            label: m.label,
        }));
    })();

    // Aspect ratio options (Google Gemini only)
    const arOptions = (providerConfig?.aspectRatios || []).map(ar => ({
        value: ar,
        label: ar,
    }));

    // Resolution options (Google Gemini only)
    const resOptions = (providerConfig?.resolutions || []).map(r => ({
        value: r,
        label: r,
    }));

    // Size options (Nano-GPT only)
    const sizeOptions = (providerConfig?.sizes || []).map(s => ({
        value: s,
        label: s,
    }));

    // Sampler options (NovelAI only)
    const samplerOptions = (providerConfig?.samplers || []).map(s => ({
        value: s.id,
        label: s.label,
    }));

    // Resolution options (NovelAI only)
    const naiResOptions = (providerConfig?.resolutions || []).map(r => ({
        value: r.id,
        label: r.label,
    }));

    // Provider options
    const providerOptions = Object.entries(IMAGEGEN_PROVIDERS).map(([key, cfg]) => ({
        value: key,
        label: cfg.name,
    }));

    // Active provider's reference images
    const activeRefImages = provider === 'nanogpt'
        ? (nanoGptSettings.referenceImages || [])
        : provider === 'novelai'
            ? (novelAiSettings.referenceImages || [])
            : (googleSettings.referenceImages || []);

    const handleReferenceUpload = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            addReferenceImage({
                id: Date.now().toString(),
                data: base64,
                mimeType: file.type || 'image/png',
                name: file.name,
            });
        };
        reader.readAsDataURL(file);

        // Reset input so same file can be re-selected
        e.target.value = '';
    }, [addReferenceImage]);

    const handleGenerate = useCallback(async () => {
        setGenError(null);
        const result = await triggerGeneration();
        if (!result.success) {
            setGenError(result.error || 'Image generation failed');
            console.warn('Image generation failed:', result.error);
        }
    }, [triggerGeneration]);

    const handleRefreshModels = useCallback(async () => {
        const apiKey = nanoGptSettings.apiKey;
        if (!apiKey) return;
        setModelsFetching(true);
        try {
            const result = await fetchNanoGptModels(apiKey);
            if (result.success && result.models?.length > 0) {
                setDynamicModels(result.models);
                // Persist fetched models so the list survives panel remount/page reload
                updateNanoGptSettings({ fetchedModels: result.models });
            }
        } finally {
            setModelsFetching(false);
        }
    }, [nanoGptSettings.apiKey, updateNanoGptSettings]);

    return (
        <div className="lumiverse-vp-settings-panel lumiverse-ig-panel">
            {/* Master toggle */}
            <Toggle
                id="ig-enabled"
                checked={settings.enabled || false}
                onChange={(checked) => updateSettings({ enabled: checked })}
                label="Enable Image Generation"
                hint="Generate scene backgrounds using AI image models"
            />

            {settings.enabled && (
                <>
                    {/* Provider selector */}
                    <SelectField
                        id="ig-provider"
                        label="Provider"
                        value={provider}
                        onChange={(val) => updateSettings({ provider: val })}
                        options={providerOptions}
                    />

                    {/* Google Gemini Settings */}
                    {provider === 'google_gemini' && (
                        <CollapsibleSection
                            Icon={Settings}
                            title="Google Gemini Settings"
                            defaultOpen={true}
                        >
                            <SelectField
                                id="ig-model"
                                label="Model"
                                value={googleSettings.model || 'gemini-3.1-flash-image'}
                                onChange={(val) => updateGoogleSettings({ model: val })}
                                options={modelOptions}
                            />

                            <SelectField
                                id="ig-key-mode"
                                label="API Key Source"
                                value={googleSettings.apiKeyMode || 'st'}
                                onChange={(val) => updateGoogleSettings({ apiKeyMode: val })}
                                options={[
                                    { value: 'st', label: 'Use SillyTavern Key' },
                                    ...(allProfiles.length > 0
                                        ? [{ value: 'profile', label: 'Use Connection Profile' }]
                                        : []),
                                ]}
                                hint={googleSettings.apiKeyMode === 'st'
                                    ? 'Uses your Google AI key from SillyTavern settings'
                                    : 'Uses the API key and endpoint from a saved connection profile'}
                            />

                            {googleSettings.apiKeyMode === 'profile' && allProfiles.length > 0 && (
                                <SelectField
                                    id="ig-connection-profile"
                                    label="Connection Profile"
                                    value={googleSettings.connectionProfileId || ''}
                                    onChange={(val) => updateGoogleSettings({ connectionProfileId: val })}
                                    options={allProfiles.map(p => ({
                                        value: p.id,
                                        label: `${p.name} (${p.model})`,
                                    }))}
                                />
                            )}

                            <SelectField
                                id="ig-aspect-ratio"
                                label="Aspect Ratio"
                                value={googleSettings.aspectRatio || '16:9'}
                                onChange={(val) => updateGoogleSettings({ aspectRatio: val })}
                                options={arOptions}
                            />

                            <SelectField
                                id="ig-resolution"
                                label="Resolution"
                                value={googleSettings.imageSize || '1K'}
                                onChange={(val) => updateGoogleSettings({ imageSize: val })}
                                options={resOptions}
                            />

                            {/* Reference Images */}
                            <div className="lumiverse-vp-field">
                                <label className="lumiverse-vp-field-label">
                                    Reference Images ({(googleSettings.referenceImages || []).length}/14)
                                </label>
                                <span className="lumiverse-vp-field-hint">
                                    Upload style reference images to guide generation
                                </span>
                                <ReferenceImageGrid
                                    images={googleSettings.referenceImages || []}
                                    onRemove={removeReferenceImage}
                                />
                                {(googleSettings.referenceImages || []).length < 14 && (
                                    <button
                                        className="lumiverse-ig-upload-btn"
                                        onClick={handleReferenceUpload}
                                        type="button"
                                    >
                                        <Plus size={14} />
                                        <span>Add Reference</span>
                                    </button>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleFileChange}
                                />
                            </div>
                        </CollapsibleSection>
                    )}

                    {/* Nano-GPT Settings */}
                    {provider === 'nanogpt' && (
                        <CollapsibleSection
                            Icon={Settings}
                            title="Nano-GPT Settings"
                            defaultOpen={true}
                        >
                            {/* API Key */}
                            <div className="lumiverse-vp-field">
                                <label className="lumiverse-vp-field-label" htmlFor="ig-nanogpt-key">API Key</label>
                                <input
                                    type="password"
                                    id="ig-nanogpt-key"
                                    className="lumiverse-vp-field-input"
                                    value={nanoGptSettings.apiKey || ''}
                                    onChange={(e) => updateNanoGptSettings({ apiKey: e.target.value })}
                                    placeholder="Enter your Nano-GPT API key"
                                />
                                <span className="lumiverse-vp-field-hint">
                                    Get your API key from nano-gpt.com
                                </span>
                            </div>

                            {/* Model */}
                            <div className="lumiverse-vp-field">
                                <label className="lumiverse-vp-field-label" htmlFor="ig-nanogpt-model">Model</label>
                                <div className="lumiverse-ig-model-row">
                                    <select
                                        id="ig-nanogpt-model"
                                        className="lumiverse-vp-field-input"
                                        value={nanoGptSettings.model || 'hidream'}
                                        onChange={(e) => updateNanoGptSettings({ model: e.target.value })}
                                    >
                                        {modelOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <button
                                        className="lumiverse-ig-refresh-btn"
                                        onClick={handleRefreshModels}
                                        disabled={modelsFetching || !nanoGptSettings.apiKey}
                                        title="Refresh models from Nano-GPT API"
                                        type="button"
                                    >
                                        <RefreshCw size={14} className={modelsFetching ? 'lumiverse-ig-spinner' : ''} />
                                    </button>
                                </div>
                            </div>

                            {/* Image Size */}
                            <SelectField
                                id="ig-nanogpt-size"
                                label="Image Size"
                                value={nanoGptSettings.size || '1024x1024'}
                                onChange={(val) => updateNanoGptSettings({ size: val })}
                                options={sizeOptions}
                            />

                            {/* Advanced Settings */}
                            <CollapsibleSection
                                Icon={Settings}
                                title="Advanced"
                                defaultOpen={false}
                            >
                                <SliderField
                                    id="ig-nanogpt-guidance"
                                    label="Guidance Scale"
                                    value={nanoGptSettings.guidanceScale ?? 7.5}
                                    onChange={(val) => updateNanoGptSettings({ guidanceScale: val })}
                                    min={1}
                                    max={20}
                                    step={0.5}
                                    hint="Higher values follow the prompt more closely"
                                />

                                <SliderField
                                    id="ig-nanogpt-steps"
                                    label="Inference Steps"
                                    value={nanoGptSettings.numInferenceSteps ?? 30}
                                    onChange={(val) => updateNanoGptSettings({ numInferenceSteps: val })}
                                    min={10}
                                    max={100}
                                    step={1}
                                    hint="More steps = higher quality but slower"
                                />

                                <SliderField
                                    id="ig-nanogpt-strength"
                                    label="Reference Strength"
                                    value={nanoGptSettings.strength ?? 0.8}
                                    onChange={(val) => updateNanoGptSettings({ strength: val })}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    format={(v) => v.toFixed(2)}
                                    hint="How much reference images influence the output (only applies when refs are uploaded)"
                                />
                            </CollapsibleSection>

                            {/* Reference Images */}
                            <div className="lumiverse-vp-field">
                                <label className="lumiverse-vp-field-label">
                                    Reference Images ({(nanoGptSettings.referenceImages || []).length}/14)
                                </label>
                                <span className="lumiverse-vp-field-hint">
                                    Upload style reference images to guide generation
                                </span>
                                <ReferenceImageGrid
                                    images={nanoGptSettings.referenceImages || []}
                                    onRemove={removeReferenceImage}
                                />
                                {(nanoGptSettings.referenceImages || []).length < 14 && (
                                    <button
                                        className="lumiverse-ig-upload-btn"
                                        onClick={handleReferenceUpload}
                                        type="button"
                                    >
                                        <Plus size={14} />
                                        <span>Add Reference</span>
                                    </button>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleFileChange}
                                />
                            </div>
                        </CollapsibleSection>
                    )}

                    {/* NovelAI Settings */}
                    {provider === 'novelai' && (
                        <CollapsibleSection
                            Icon={Settings}
                            title="NovelAI Settings"
                            defaultOpen={true}
                        >
                            {/* API Key */}
                            <div className="lumiverse-vp-field">
                                <label className="lumiverse-vp-field-label" htmlFor="ig-novelai-key">API Key</label>
                                <input
                                    type="password"
                                    id="ig-novelai-key"
                                    className="lumiverse-vp-field-input"
                                    value={novelAiSettings.apiKey || ''}
                                    onChange={(e) => updateNovelAiSettings({ apiKey: e.target.value })}
                                    placeholder="Enter your NovelAI Persistent API Token"
                                />
                                <span className="lumiverse-vp-field-hint">
                                    Get your Persistent API Token from NovelAI Account Settings
                                </span>
                            </div>

                            {/* Model */}
                            <SelectField
                                id="ig-novelai-model"
                                label="Model"
                                value={novelAiSettings.model || 'nai-diffusion-4-5-full'}
                                onChange={(val) => updateNovelAiSettings({ model: val })}
                                options={modelOptions}
                            />

                            {/* Sampler */}
                            <SelectField
                                id="ig-novelai-sampler"
                                label="Sampler"
                                value={novelAiSettings.sampler || 'k_euler_ancestral'}
                                onChange={(val) => updateNovelAiSettings({ sampler: val })}
                                options={samplerOptions}
                            />

                            {/* Resolution */}
                            <SelectField
                                id="ig-novelai-resolution"
                                label="Resolution"
                                value={novelAiSettings.resolution || '1216x832'}
                                onChange={(val) => updateNovelAiSettings({ resolution: val })}
                                options={naiResOptions}
                            />

                            {/* Advanced Settings */}
                            <CollapsibleSection
                                Icon={Settings}
                                title="Advanced"
                                defaultOpen={false}
                            >
                                <SliderField
                                    id="ig-novelai-steps"
                                    label="Steps"
                                    value={novelAiSettings.steps ?? 28}
                                    onChange={(val) => updateNovelAiSettings({ steps: val })}
                                    min={1}
                                    max={50}
                                    step={1}
                                    hint="More steps = higher quality but slower"
                                />

                                <SliderField
                                    id="ig-novelai-guidance"
                                    label="Guidance Scale"
                                    value={novelAiSettings.guidance ?? 5}
                                    onChange={(val) => updateNovelAiSettings({ guidance: val })}
                                    min={1}
                                    max={20}
                                    step={0.5}
                                    hint="How closely the image follows the prompt"
                                />

                                {/* Negative Prompt */}
                                <div className="lumiverse-vp-field">
                                    <label className="lumiverse-vp-field-label" htmlFor="ig-novelai-negprompt">
                                        Negative Prompt
                                    </label>
                                    <textarea
                                        id="ig-novelai-negprompt"
                                        className="lumiverse-vp-field-input"
                                        rows={3}
                                        value={novelAiSettings.negativePrompt || ''}
                                        onChange={(e) => updateNovelAiSettings({ negativePrompt: e.target.value })}
                                        placeholder="Tags to exclude from generation"
                                    />
                                    <span className="lumiverse-vp-field-hint">
                                        Comma-separated tags to avoid in the generated image
                                    </span>
                                </div>

                                {/* SMEA */}
                                <Toggle
                                    id="ig-novelai-smea"
                                    checked={novelAiSettings.smea || false}
                                    onChange={(checked) => updateNovelAiSettings({ smea: checked, smeaDyn: checked ? novelAiSettings.smeaDyn : false })}
                                    label="SMEA"
                                    hint="Sampling method enhancement for higher resolutions"
                                />

                                {/* SMEA Dynamic (only when SMEA is on) */}
                                {novelAiSettings.smea && (
                                    <Toggle
                                        id="ig-novelai-smea-dyn"
                                        checked={novelAiSettings.smeaDyn || false}
                                        onChange={(checked) => updateNovelAiSettings({ smeaDyn: checked })}
                                        label="SMEA Dynamic"
                                        hint="Dynamic variant of SMEA for more varied results"
                                    />
                                )}

                            </CollapsibleSection>

                            {/* Director References (Vibe Transfer) */}
                            <CollapsibleSection
                                Icon={Layers}
                                title="Director References"
                                defaultOpen={false}
                            >
                                <Toggle
                                    id="ig-novelai-include-char"
                                    checked={novelAiSettings.includeCharacterAvatar || false}
                                    onChange={(checked) => updateNovelAiSettings({ includeCharacterAvatar: checked })}
                                    label="Include Character Avatar"
                                    hint="Send the current character's avatar as a director reference"
                                />

                                <Toggle
                                    id="ig-novelai-include-persona"
                                    checked={novelAiSettings.includePersonaAvatar || false}
                                    onChange={(checked) => updateNovelAiSettings({ includePersonaAvatar: checked })}
                                    label="Include Persona Avatar"
                                    hint="Send your persona's avatar as a director reference"
                                />

                                <SliderField
                                    id="ig-novelai-ref-strength"
                                    label="Reference Strength"
                                    value={novelAiSettings.referenceStrength ?? 0.5}
                                    onChange={(val) => updateNovelAiSettings({ referenceStrength: val })}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    format={(v) => v.toFixed(2)}
                                    hint="How strongly references influence the output"
                                />

                                <SliderField
                                    id="ig-novelai-ref-info"
                                    label="Information Extracted"
                                    value={novelAiSettings.referenceInfoExtracted ?? 1}
                                    onChange={(val) => updateNovelAiSettings({ referenceInfoExtracted: val })}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    format={(v) => v.toFixed(2)}
                                    hint="How much visual information to extract from all references"
                                />

                                <SliderField
                                    id="ig-novelai-ref-fidelity"
                                    label="Reference Fidelity"
                                    value={novelAiSettings.referenceFidelity ?? 1.0}
                                    onChange={(val) => updateNovelAiSettings({ referenceFidelity: val })}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    format={(v) => v.toFixed(2)}
                                    hint="How strictly to follow references (higher = more faithful reproduction)"
                                />

                                {(novelAiSettings.includeCharacterAvatar || novelAiSettings.includePersonaAvatar) && (
                                    <SelectField
                                        id="ig-novelai-avatar-ref-type"
                                        label="Avatar Reference Type"
                                        value={novelAiSettings.avatarReferenceType || 'character'}
                                        onChange={(val) => updateNovelAiSettings({ avatarReferenceType: val })}
                                        options={[
                                            { value: 'character', label: 'Character Only' },
                                            { value: 'style', label: 'Style Only' },
                                            { value: 'character&style', label: 'Character + Style' },
                                        ]}
                                        hint="What to extract from avatar images"
                                    />
                                )}

                                <SelectField
                                    id="ig-novelai-ref-type"
                                    label="Manual Reference Type"
                                    value={novelAiSettings.referenceType || 'character&style'}
                                    onChange={(val) => updateNovelAiSettings({ referenceType: val })}
                                    options={[
                                        { value: 'character&style', label: 'Character + Style' },
                                        { value: 'character', label: 'Character Only' },
                                        { value: 'style', label: 'Style Only' },
                                    ]}
                                    hint="What to extract from manually uploaded reference images"
                                />

                                {/* Manual reference image uploads */}
                                <div className="lumiverse-vp-field">
                                    <label className="lumiverse-vp-field-label">
                                        Reference Images ({(novelAiSettings.referenceImages || []).length}/14)
                                    </label>
                                    <span className="lumiverse-vp-field-hint">
                                        Upload images for vibe/style transfer via NovelAI Director
                                    </span>
                                <ReferenceImageGrid
                                    images={novelAiSettings.referenceImages || []}
                                    onRemove={removeReferenceImage}
                                />
                                {(novelAiSettings.referenceImages || []).length < 14 && (
                                    <button
                                        className="lumiverse-ig-upload-btn"
                                        onClick={handleReferenceUpload}
                                        type="button"
                                    >
                                        <Plus size={14} />
                                        <span>Add Reference</span>
                                    </button>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleFileChange}
                                />
                                </div>
                            </CollapsibleSection>
                        </CollapsibleSection>
                    )}

                    {/* Scene Settings */}
                    <CollapsibleSection
                        Icon={Layers}
                        title="Scene Settings"
                        defaultOpen={true}
                    >
                        <Toggle
                            id="ig-include-chars"
                            checked={settings.includeCharacters || false}
                            onChange={(checked) => updateSettings({ includeCharacters: checked })}
                            label="Include Characters"
                            hint="Add character descriptions to image prompts"
                        />

                        <Toggle
                            id="ig-auto-gen"
                            checked={settings.autoGenerate !== false}
                            onChange={(checked) => updateSettings({ autoGenerate: checked })}
                            label="Auto-Generate"
                            hint="Automatically generate backgrounds when scene changes"
                        />

                        <Toggle
                            id="ig-force-gen"
                            checked={settings.forceGeneration || false}
                            onChange={(checked) => updateSettings({ forceGeneration: checked })}
                            label="Ignore Scene Change Detection"
                            hint="Always generate a new background, even if the scene hasn't changed"
                        />

                        <SliderField
                            id="ig-threshold"
                            label="Scene Change Sensitivity"
                            value={settings.sceneChangeThreshold || 2}
                            onChange={(val) => updateSettings({ sceneChangeThreshold: val })}
                            min={1}
                            max={5}
                            step={1}
                            hint="Fields that must differ to trigger regeneration (lower = more sensitive)"
                        />
                    </CollapsibleSection>

                    {/* Background Display */}
                    <CollapsibleSection
                        Icon={Eye}
                        title="Background Display"
                        defaultOpen={false}
                    >
                        <SliderField
                            id="ig-opacity"
                            label="Background Opacity"
                            value={Math.round((settings.backgroundOpacity ?? 0.35) * 100)}
                            onChange={(val) => updateSettings({ backgroundOpacity: val / 100 })}
                            min={0}
                            max={100}
                            step={5}
                            format={(v) => `${v}%`}
                        />

                        <SliderField
                            id="ig-fade"
                            label="Fade Duration"
                            value={settings.fadeTransitionMs ?? 800}
                            onChange={(val) => updateSettings({ fadeTransitionMs: val })}
                            min={200}
                            max={2000}
                            step={100}
                            format={(v) => `${v}ms`}
                        />
                    </CollapsibleSection>

                    {/* Preview & Controls */}
                    <CollapsibleSection
                        Icon={Sparkles}
                        title="Preview"
                        defaultOpen={true}
                    >
                        {/* Current background thumbnail — click to expand */}
                        {sceneBackground && (
                            <div
                                className="lumiverse-ig-preview lumiverse-ig-preview--clickable"
                                onClick={() => setLightboxOpen(true)}
                                title="Click to expand"
                            >
                                <img
                                    src={sceneBackground}
                                    alt="Current scene background"
                                    className="lumiverse-ig-preview-img"
                                />
                            </div>
                        )}

                        {/* Full-screen lightbox */}
                        {lightboxOpen && sceneBackground && (
                            <ImageLightbox
                                src={sceneBackground}
                                alt="Scene background"
                                onClose={() => setLightboxOpen(false)}
                            />
                        )}

                        {/* Last scene parameters */}
                        {lastSceneParams && (
                            <div className="lumiverse-ig-scene-info">
                                <div className="lumiverse-ig-scene-field">
                                    <strong>Scene:</strong> {lastSceneParams.environment}
                                </div>
                                {lastSceneParams.time_of_day && (
                                    <div className="lumiverse-ig-scene-field">
                                        <strong>Time:</strong> {lastSceneParams.time_of_day}
                                    </div>
                                )}
                                {lastSceneParams.mood && (
                                    <div className="lumiverse-ig-scene-field">
                                        <strong>Mood:</strong> {lastSceneParams.mood}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="lumiverse-ig-actions">
                            {sceneGenerating ? (
                                <button
                                    className="lumiverse-ig-action-btn lumiverse-ig-action-btn--danger"
                                    onClick={cancelGeneration}
                                    type="button"
                                >
                                    <X size={14} />
                                    <span>Cancel</span>
                                </button>
                            ) : (
                                <button
                                    className="lumiverse-ig-action-btn lumiverse-ig-action-btn--primary"
                                    onClick={handleGenerate}
                                    type="button"
                                >
                                    <ImageIcon size={14} />
                                    <span>Generate Now</span>
                                </button>
                            )}

                            {sceneBackground && (
                                <button
                                    className="lumiverse-ig-action-btn lumiverse-ig-action-btn--danger"
                                    onClick={clearBackground}
                                    type="button"
                                >
                                    <Trash2 size={14} />
                                    <span>Clear Background</span>
                                </button>
                            )}
                        </div>

                        {/* Error display */}
                        {genError && !sceneGenerating && (
                            <div className="lumiverse-ig-error">
                                {genError}
                            </div>
                        )}
                    </CollapsibleSection>
                </>
            )}
        </div>
    );
}

export default ImageGenPanel;
