/**
 * CollapsibleSection - Shared accordion component for sidebar panels
 * Uses CSS grid for smooth, performant animation
 */
import React, { useState } from 'react';
import { CollapsibleContent } from '../Collapsible';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

/**
 * Collapsible section with icon, title, and optional status badge
 * 
 * @param {Object} props
 * @param {React.ComponentType} props.Icon - Lucide icon component
 * @param {string} props.title - Section title
 * @param {boolean} [props.status] - Optional status (shows Active/Inactive badge)
 * @param {React.ReactNode} props.children - Section content
 * @param {boolean} [props.defaultOpen=false] - Initial open state
 */
export function CollapsibleSection({ Icon, title, status, children, defaultOpen = false }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={clsx('lumiverse-vp-collapsible', isOpen && 'lumiverse-vp-collapsible--open')}>
            <button
                className="lumiverse-vp-collapsible-header"
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span className={clsx('lumiverse-vp-collapsible-chevron', isOpen && 'lumiverse-vp-collapsible-chevron--open')}>
                    <ChevronDown size={14} strokeWidth={2} />
                </span>
                <span className="lumiverse-vp-collapsible-icon">
                    <Icon size={16} strokeWidth={1.5} />
                </span>
                <span className="lumiverse-vp-collapsible-title">{title}</span>
                {status !== undefined && (
                    <span className={clsx('lumiverse-vp-collapsible-status', status && 'lumiverse-vp-collapsible-status--active')}>
                        {status ? 'Active' : 'Inactive'}
                    </span>
                )}
            </button>
            <CollapsibleContent
                isOpen={isOpen}
                className="lumiverse-vp-collapsible-content"
                duration={200}
            >
                <div className="lumiverse-vp-collapsible-inner">
                    {children}
                </div>
            </CollapsibleContent>
        </div>
    );
}

export default CollapsibleSection;
