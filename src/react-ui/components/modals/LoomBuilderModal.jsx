import React from 'react';
import LoomBuilder from '../panels/LoomBuilder';

/**
 * Modal wrapper for the Loom Builder.
 * Renders the full LoomBuilder component inside the existing ModalWrapper system.
 */
export default function LoomBuilderModal({ onClose }) {
    return <LoomBuilder onClose={onClose} />;
}
