/**
 * TokenBadge — Compact token count display next to message timestamp
 *
 * Shows cached token count immediately if available, otherwise displays "?t"
 * that computes on hover/click via ST's getTokenCountAsync.
 */

import React, { useState, useCallback } from 'react';
import { getTokenCountAsync } from '../../../stContext';

export default function TokenBadge({ tokenCount, content }) {
    const [count, setCount] = useState(tokenCount || null);
    const [loading, setLoading] = useState(false);

    const handleClick = useCallback(async () => {
        if (count || loading) return;
        const counter = getTokenCountAsync();
        if (!counter) return;
        setLoading(true);
        try {
            const result = await counter(content);
            setCount(result);
        } catch {
            // ignore — badge stays as "?t"
        } finally {
            setLoading(false);
        }
    }, [count, loading, content]);

    const display = count ? `${count}t` : '?t';

    return (
        <span
            className="lcs-token-badge"
            onClick={handleClick}
            title={count ? `${count} tokens` : 'Click to count tokens'}
        >
            {loading ? '...' : display}
        </span>
    );
}
