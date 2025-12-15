import React, { useEffect, useCallback } from 'react';
import { useUI, useLumiverseActions } from '../store/LumiverseContext';
import clsx from 'clsx';

// Import modal components
import SelectionModal from './modals/SelectionModal';
import PackEditorModal from './modals/PackEditorModal';
import LoomSelectionModal from './modals/LoomSelectionModal';
import PackSelectorModal from './modals/PackSelectorModal';
import LumiaEditorModal from './modals/LumiaEditorModal';

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

    // Close on backdrop click
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Stop propagation to prevent ST from closing the drawer
    const handleModalClick = (e) => {
        e.stopPropagation();
    };

    // Determine modal class based on type
    const modalClass = clsx(
        'lumia-modal',
        modalType === 'selection' && 'lumia-modal-selection',
        modalType === 'settings' && 'lumia-modal-settings',
        modalType === 'editor' && 'lumia-modal-editor',
        modalType === 'pack-editor' && 'lumia-modal-pack-editor',
        modalType === 'pack-selector' && 'lumia-modal-pack-selector',
        modalType === 'lumia-editor' && 'lumia-modal-lumia-editor'
    );

    return (
        <div
            className="lumia-modal-backdrop"
            onClick={handleBackdropClick}
            onMouseDown={handleModalClick}
            onMouseUp={handleModalClick}
        >
            <div
                className={modalClass}
                role="dialog"
                aria-modal="true"
                onClick={handleModalClick}
            >
                {children}
            </div>
        </div>
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

    return (
        <ModalWrapper
            modalType={modalType}
            size={size}
            hasCustomHeader={hasCustomHeader}
            onClose={actions.closeModal}
        >
            <ModalComponent {...defaultProps} {...modalProps} onClose={actions.closeModal} />
        </ModalWrapper>
    );
}

export default ModalContainer;
