import React, { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUI, useLumiverseActions } from '../../store/LumiverseContext';
import SettingsNav from '../settings/SettingsNav';
import GeneralSettingsView from '../settings/GeneralSettingsView';
import PacksView from '../settings/PacksView';
import LumiaConfigView from '../settings/LumiaConfigView';
import LoomConfigView from '../settings/LoomConfigView';
import MacroReferenceView from '../settings/MacroReferenceView';
import DangerZoneView from '../settings/DangerZoneView';
import ThemePanel from '../panels/ThemePanel';
import { ChatPresetsPanel } from '../panels/ChatPresets';
import { PresetBindingsPanel } from '../panels/PresetBindings';
import OOCSettings from '../panels/OOCSettings';
import PromptSettings from '../panels/PromptSettings';
import SummarizationView from '../settings/SummarizationView';

/**
 * View router — renders the active settings view based on the nav selection.
 */
function SettingsViewRouter({ activeView }) {
    switch (activeView) {
        case 'general':        return <GeneralSettingsView />;
        case 'theme':          return <div className="lumiverse-settings-view"><ThemePanel /></div>;
        case 'packs':          return <PacksView />;
        case 'chatPresets':    return <div className="lumiverse-settings-view"><ChatPresetsPanel /></div>;
        case 'presetBindings': return <div className="lumiverse-settings-view"><PresetBindingsPanel /></div>;
        case 'lumiaConfig':    return <LumiaConfigView />;
        case 'loomConfig':     return <LoomConfigView />;
        case 'ooc':            return <div className="lumiverse-settings-view"><OOCSettings /></div>;
        case 'summarization':  return <SummarizationView />;
        case 'promptSettings': return <div className="lumiverse-settings-view"><PromptSettings /></div>;
        case 'macros':         return <MacroReferenceView />;
        case 'danger':         return <DangerZoneView />;
        default:               return <GeneralSettingsView />;
    }
}

/**
 * Full settings modal — renders the Lumiverse settings in a dedicated
 * modal with sidebar navigation. Portals to document.body at z-index 9999,
 * sitting below overlay modals (z-index 10000).
 */
export default function SettingsModal() {
    const ui = useUI();
    const actions = useLumiverseActions();

    const isOpen = ui.settingsModal?.isOpen;
    const activeView = ui.settingsModal?.activeView || 'general';

    // ESC handler — only close if no overlay modal is open on top
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape' && !ui.activeModal) {
            actions.closeSettingsModal();
        }
    }, [ui.activeModal, actions]);

    useEffect(() => {
        if (!isOpen) return;

        document.addEventListener('keydown', handleKeyDown);
        // Body scroll lock
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            // Only restore if no overlay modal is still holding the lock
            if (!ui.activeModal) {
                document.body.style.overflow = prev;
            }
        };
    }, [isOpen, handleKeyDown, ui.activeModal]);

    if (!isOpen) return null;

    // Backdrop click — close only if clicking the backdrop itself
    const handleBackdropClick = (e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) {
            actions.closeSettingsModal();
        }
    };

    // Stop propagation to prevent SillyTavern's drawer from intercepting
    const stopPropagation = (e) => e.stopPropagation();

    return createPortal(
        <div
            className="lumiverse-settings-modal-backdrop"
            onClick={handleBackdropClick}
            onMouseDown={stopPropagation}
            onMouseUp={stopPropagation}
            onPointerDown={stopPropagation}
            onPointerUp={stopPropagation}
            onTouchStart={stopPropagation}
            onTouchEnd={stopPropagation}
        >
            <div
                className="lumiverse-settings-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Lumiverse Settings"
                onClick={(e) => e.stopPropagation()}
            >
                <SettingsNav
                    activeView={activeView}
                    onNavigate={actions.setSettingsModalView}
                    onClose={actions.closeSettingsModal}
                />
                <div className="lumiverse-settings-content">
                    <SettingsViewRouter activeView={activeView} />
                </div>
            </div>
        </div>,
        document.body
    );
}
