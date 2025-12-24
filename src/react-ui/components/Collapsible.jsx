import React, { forwardRef } from 'react';
import clsx from 'clsx';

/**
 * High-performance collapsible component using CSS grid-template-rows.
 *
 * This approach avoids layout thrashing that occurs with height animations.
 * The grid-template-rows: 0fr -> 1fr transition is GPU-accelerated and
 * doesn't trigger expensive layout recalculations.
 *
 * @param {boolean} isOpen - Whether the content is visible
 * @param {React.ReactNode} children - Content to show/hide
 * @param {string} className - Additional CSS classes
 * @param {number} duration - Transition duration in ms (default: 200)
 */
export const Collapsible = forwardRef(function Collapsible({
    isOpen,
    children,
    className,
    duration = 200
}, ref) {
    return (
        <div
            ref={ref}
            className={clsx('lumiverse-collapsible', className, { 'is-open': isOpen })}
            style={{ '--collapsible-duration': `${duration}ms` }}
        >
            <div className="lumiverse-collapsible-inner">
                {children}
            </div>
        </div>
    );
});

/**
 * Wrapper for AnimatePresence content that uses CSS grid for height.
 * Use this as a drop-in replacement for motion.div with height animations.
 *
 * Instead of:
 *   <AnimatePresence>
 *     {isOpen && (
 *       <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
 *         content
 *       </motion.div>
 *     )}
 *   </AnimatePresence>
 *
 * Use:
 *   <CollapsibleContent isOpen={isOpen}>
 *     content
 *   </CollapsibleContent>
 */
export const CollapsibleContent = forwardRef(function CollapsibleContent({
    isOpen,
    children,
    className,
    duration = 200,
    // Support for additional motion-like props (ignored but accepted for easy migration)
    initial,
    animate,
    exit,
    transition,
    ...props
}, ref) {
    // Always render content but hide with grid-template-rows: 0fr when closed
    // This allows CSS transitions to work properly
    return (
        <div
            ref={ref}
            className={clsx('lumiverse-collapsible', className, { 'is-open': isOpen })}
            style={{ '--collapsible-duration': `${duration}ms` }}
            {...props}
        >
            <div className="lumiverse-collapsible-inner">
                {children}
            </div>
        </div>
    );
});

export default Collapsible;
