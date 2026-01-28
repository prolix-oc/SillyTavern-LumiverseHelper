import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useUI, useLumiverseActions } from '../store/LumiverseContext';
import clsx from 'clsx';

// Import modal components
import SelectionModal from './modals/SelectionModal';
import PackEditorModal from './modals/PackEditorModal';
import LoomSelectionModal from './modals/LoomSelectionModal';
import PackSelectorModal from './modals/PackSelectorModal';
import LumiaEditorModal from './modals/LumiaEditorModal';
import LoomEditorModal from './modals/LoomEditorModal';
import ItemTypeSelector from './modals/ItemTypeSelector';
import CouncilSelectModal from './modals/CouncilSelectModal';
import PresetEditor from './panels/PresetEditor';

/**
 * Modal wrapper that provides backdrop and close functionality
 * Uses lumia-modal class naming to match old design
 */
function ModalWrapper({ children, onClose, modalType, size = 'medium', hasCustomHeader = false }) {
    // Close on escape key
    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        },
        [onClose]
    );

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [handleKeyDown]);

    // Stop propagation - but NOT for pointer events when in editor mode
    // This allows dnd-kit to receive pointer up events properly
    const stopAllPropagation = (e) => {
        e.stopPropagation();
    };

    // For editor modals, we only stop propagation on mousedown (for ST drawer)
    // but allow pointerup to propagate so dnd-kit can end drags properly
    const isEditorModal = modalType === 'editor';

    // Close on backdrop click (only if clicking backdrop itself, not modal content)
    const handleBackdropClick = (e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Determine modal class based on type
    const modalClass = clsx(
        'lumiverse-modal',
        modalType === 'selection' && 'lumiverse-modal-selection',
        modalType === 'settings' && 'lumiverse-modal-settings',
        modalType === 'editor' && 'lumiverse-modal-editor',
        modalType === 'pack-editor' && 'lumiverse-modal-pack-editor',
        modalType === 'pack-selector' && 'lumiverse-modal-pack-selector',
        modalType === 'lumia-editor' && 'lumiverse-modal-lumia-editor',
        modalType === 'loom-editor' && 'lumiverse-modal-loom-editor',
        modalType === 'type-selector' && 'lumiverse-modal-type-selector'
    );

    return (
        <div
            className="lumiverse-modal-backdrop"
            onClick={handleBackdropClick}
            onMouseDown={stopAllPropagation}
            onMouseUp={stopAllPropagation}
            onPointerDown={isEditorModal ? undefined : stopAllPropagation}
            onPointerUp={isEditorModal ? undefined : stopAllPropagation}
            onTouchStart={stopAllPropagation}
            onTouchEnd={stopAllPropagation}
        >
            <div
                className={modalClass}
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
}

/**
 * Item Type Selector Wrapper
 * Wraps ItemTypeSelector to handle the modal flow
 */
function ItemTypeSelectorWrapper({ packName, onClose }) {
    const actions = useLumiverseActions();

    const handleSelectLumia = () => {
        actions.openModal('lumiaEditor', { packName });
    };

    const handleSelectLoom = () => {
        actions.openModal('loomEditor', { packName });
    };

    return (
        <ItemTypeSelector
            packName={packName}
            onSelectLumia={handleSelectLumia}
            onSelectLoom={handleSelectLoom}
            onBack={onClose}
        />
    );
}

/**
 * Modal configuration - maps modal names to their components and settings
 */
const MODAL_CONFIG = {
    behaviors: {
        component: SelectionModal,
        modalType: 'selection',
        size: 'large',
        hasCustomHeader: true,
        props: { type: 'behaviors', multiSelect: true, allowDominant: true },
    },
    personalities: {
        component: SelectionModal,
        modalType: 'selection',
        size: 'large',
        hasCustomHeader: true,
        props: { type: 'personalities', multiSelect: true, allowDominant: true },
    },
    definitions: {
        component: SelectionModal,
        modalType: 'selection',
        size: 'large',
        hasCustomHeader: true,
        props: { type: 'definitions', multiSelect: false, allowDominant: false },
    },
    packEditor: {
        component: PackEditorModal,
        modalType: 'pack-editor',
        size: 'large',
        hasCustomHeader: true,
        props: {},
    },
    importPack: {
        component: () => <div className="lumia-modal-empty">Import Pack Modal (TODO)</div>,
        modalType: 'settings',
        size: 'medium',
        hasCustomHeader: false,
        props: {},
    },
    loomStyles: {
        component: LoomSelectionModal,
        modalType: 'selection',
        size: 'large',
        hasCustomHeader: true,
        props: { type: 'loomStyles' },
    },
    loomUtilities: {
        component: LoomSelectionModal,
        modalType: 'selection',
        size: 'large',
        hasCustomHeader: true,
        props: { type: 'loomUtilities' },
    },
    loomRetrofits: {
        component: LoomSelectionModal,
        modalType: 'selection',
        size: 'large',
        hasCustomHeader: true,
        props: { type: 'loomRetrofits' },
    },
    // Pack selector - first step in "Create Lumia" flow
    packSelector: {
        component: PackSelectorModal,
        modalType: 'pack-selector',
        size: 'medium',
        hasCustomHeader: true,
        props: {},
    },
    // Single Lumia editor - second step in "Create Lumia" flow
    lumiaEditor: {
        component: LumiaEditorModal,
        modalType: 'lumia-editor',
        size: 'large',
        hasCustomHeader: true,
        props: {},
    },
    // Loom editor - for creating/editing Loom items
    loomEditor: {
        component: LoomEditorModal,
        modalType: 'loom-editor',
        size: 'large',
        hasCustomHeader: true,
        props: {},
    },
    // Item type selector - choose between Lumia or Loom
    itemTypeSelector: {
        component: ItemTypeSelectorWrapper,
        modalType: 'type-selector',
        size: 'medium',
        hasCustomHeader: true,
        props: {},
    },
    // Council member selection modal
    councilSelect: {
        component: CouncilSelectModal,
        modalType: 'selection',
        size: 'large',
        hasCustomHeader: true,
        props: {},
    },
    // Full Preset Editor
    presetEditor: {
        component: PresetEditor,
        modalType: 'editor',
        size: 'large',
        hasCustomHeader: false, // PresetEditor renders its own header
        props: {},
    },
};

/**
 * Container that renders the active modal based on UI state
 */
function ModalContainer() {
    const ui = useUI();
    const actions = useLumiverseActions();

    if (!ui.activeModal) {
        return null;
    }

    const { name, props: modalProps } = ui.activeModal;
    const config = MODAL_CONFIG[name];

    if (!config) {
        console.warn(`[LumiverseUI] Unknown modal: ${name}`);
        return null;
    }

    const { component: ModalComponent, modalType, size, hasCustomHeader, props: defaultProps } = config;

    // Use createPortal to render modal at document.body level
    // This ensures proper positioning on mobile devices
    return createPortal(
        <ModalWrapper
            modalType={modalType}
            size={size}
            hasCustomHeader={hasCustomHeader}
            onClose={actions.closeModal}
        >
            <ModalComponent {...defaultProps} {...modalProps} onClose={actions.closeModal} />
        </ModalWrapper>,
        document.body
    );
}

export default ModalContainer;
