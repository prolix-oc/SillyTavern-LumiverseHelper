import React, { useState } from 'react';
import clsx from 'clsx';
import { User, ScrollText, ArrowRight } from 'lucide-react';
import {
    EditorLayout,
    EditorContent,
    EditorFooter
} from '../shared/FormComponents';

/**
 * Item Type Selector
 *
 * Presents a choice between creating a Lumia (character) or Loom (modifier) item.
 * Used as an intermediate step when adding new items to a pack.
 *
 * Props:
 * - packName: The target pack name (displayed in header)
 * - onSelectLumia: Callback when Lumia is selected
 * - onSelectLoom: Callback when Loom is selected
 * - onBack: Optional callback to go back
 */
function ItemTypeSelector({ packName, onSelectLumia, onSelectLoom, onBack }) {
    const [hoveredType, setHoveredType] = useState(null);

    return (
        <EditorLayout className="lumiverse-type-selector">
            <EditorContent className="lumiverse-type-selector-content">
                {/* Header */}
                <div className="lumiverse-type-selector-header" style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h3 className="lumiverse-type-selector-title" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--lumiverse-text)', marginBottom: '8px' }}>
                        Add to {packName}
                    </h3>
                    <p className="lumiverse-type-selector-subtitle" style={{ fontSize: '13px', color: 'var(--lumiverse-text-muted)' }}>
                        Choose what you'd like to create
                    </p>
                </div>

                {/* Option Cards */}
                <div className="lumiverse-type-selector-options" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Lumia Option */}
                    <button
                        className={clsx(
                            'lumiverse-type-option',
                            'lumiverse-type-option--lumia',
                            hoveredType === 'lumia' && 'lumiverse-type-option--hovered'
                        )}
                        onClick={onSelectLumia}
                        onMouseEnter={() => setHoveredType('lumia')}
                        onMouseLeave={() => setHoveredType(null)}
                        type="button"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            textAlign: 'left',
                            padding: '16px',
                            background: hoveredType === 'lumia' ? 'rgba(147, 112, 219, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                            border: `1px solid ${hoveredType === 'lumia' ? 'var(--lumiverse-primary)' : 'var(--lumiverse-border)'}`,
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            width: '100%'
                        }}
                    >
                        <div className="lumiverse-type-option-icon" style={{ 
                            width: '48px', 
                            height: '48px', 
                            borderRadius: '50%',
                            background: 'rgba(147, 112, 219, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--lumiverse-primary)',
                            marginRight: '16px',
                            flexShrink: 0
                        }}>
                            <User size={24} strokeWidth={1.5} />
                        </div>
                        <div className="lumiverse-type-option-content" style={{ flex: 1 }}>
                            <span className="lumiverse-type-option-label" style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: 'var(--lumiverse-text)', marginBottom: '4px' }}>
                                Lumia
                            </span>
                            <span className="lumiverse-type-option-desc" style={{ display: 'block', fontSize: '12px', color: 'var(--lumiverse-text-muted)', lineHeight: 1.4 }}>
                                Character definition with physicality, personality, and behavior
                            </span>
                        </div>
                        <div className="lumiverse-type-option-arrow" style={{ 
                            color: hoveredType === 'lumia' ? 'var(--lumiverse-primary)' : 'var(--lumiverse-text-dim)',
                            marginLeft: '12px'
                        }}>
                            <ArrowRight size={20} strokeWidth={2} />
                        </div>
                    </button>

                    {/* Loom Option */}
                    <button
                        className={clsx(
                            'lumiverse-type-option',
                            'lumiverse-type-option--loom',
                            hoveredType === 'loom' && 'lumiverse-type-option--hovered'
                        )}
                        onClick={onSelectLoom}
                        onMouseEnter={() => setHoveredType('loom')}
                        onMouseLeave={() => setHoveredType(null)}
                        type="button"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            textAlign: 'left',
                            padding: '16px',
                            background: hoveredType === 'loom' ? 'rgba(147, 112, 219, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                            border: `1px solid ${hoveredType === 'loom' ? 'var(--lumiverse-primary)' : 'var(--lumiverse-border)'}`,
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            width: '100%'
                        }}
                    >
                        <div className="lumiverse-type-option-icon" style={{ 
                            width: '48px', 
                            height: '48px', 
                            borderRadius: '50%',
                            background: 'rgba(147, 112, 219, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--lumiverse-primary)',
                            marginRight: '16px',
                            flexShrink: 0
                        }}>
                            <ScrollText size={24} strokeWidth={1.5} />
                        </div>
                        <div className="lumiverse-type-option-content" style={{ flex: 1 }}>
                            <span className="lumiverse-type-option-label" style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: 'var(--lumiverse-text)', marginBottom: '4px' }}>
                                Loom
                            </span>
                            <span className="lumiverse-type-option-desc" style={{ display: 'block', fontSize: '12px', color: 'var(--lumiverse-text-muted)', lineHeight: 1.4 }}>
                                Narrative style, utility, or retrofit modifier
                            </span>
                        </div>
                        <div className="lumiverse-type-option-arrow" style={{ 
                            color: hoveredType === 'loom' ? 'var(--lumiverse-primary)' : 'var(--lumiverse-text-dim)',
                            marginLeft: '12px'
                        }}>
                            <ArrowRight size={20} strokeWidth={2} />
                        </div>
                    </button>
                </div>
            </EditorContent>

            {/* Footer */}
            {onBack && (
                <EditorFooter className="lumiverse-type-selector-footer">
                    <button
                        className="lumiverse-btn lumiverse-btn--secondary"
                        onClick={onBack}
                        type="button"
                        style={{ marginRight: 'auto' }}
                    >
                        Back
                    </button>
                </EditorFooter>
            )}
        </EditorLayout>
    );
}

export default ItemTypeSelector;
