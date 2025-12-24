import React, { useState, useMemo, useEffect, useCallback, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { MessageCircle, BarChart2, Target, TrendingUp, ThoughtBubble, Heart, Zap, FileText, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useLumiverseStore, saveToExtension } from '../../store/LumiverseContext';

/* global SillyTavern, LumiverseBridge */

/**
 * Hook to track OOC comment statistics
 */
function useOOCStats() {
    const [stats, setStats] = useState({
        totalComments: 0,
        commentsByType: {},
        recentComments: [],
        sessionCount: 0,
        averagePerMessage: 0,
    });

    useEffect(() => {
        // Try to get stats from the bridge or extension
        const loadStats = () => {
            if (typeof LumiverseBridge !== 'undefined' && LumiverseBridge.getOOCStats) {
                const oocStats = LumiverseBridge.getOOCStats();
                if (oocStats) {
                    setStats(oocStats);
                }
            } else {
                // Generate sample stats for demo
                setStats({
                    totalComments: 42,
                    commentsByType: {
                        thought: 18,
                        feeling: 12,
                        action: 8,
                        meta: 4,
                    },
                    recentComments: [
                        { type: 'thought', text: 'Hmm, interesting response...', timestamp: Date.now() - 60000 },
                        { type: 'feeling', text: 'Getting excited about this!', timestamp: Date.now() - 120000 },
                        { type: 'action', text: '*adjusts settings*', timestamp: Date.now() - 180000 },
                    ],
                    sessionCount: 15,
                    averagePerMessage: 2.8,
                });
            }
        };

        loadStats();

        // Poll for updates (since we can't subscribe to OOC events easily)
        const interval = setInterval(loadStats, 5000);
        return () => clearInterval(interval);
    }, []);

    return stats;
}

/**
 * Stat card component
 */
function StatCard({ Icon, label, value, trend, color }) {
    return (
        <motion.div
            className="lumiverse-analytics-stat"
            style={{ '--stat-color': color }}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.1 }}
        >
            <span className="lumiverse-analytics-stat-icon">
                <Icon size={20} strokeWidth={1.5} />
            </span>
            <div className="lumiverse-analytics-stat-info">
                <span className="lumiverse-analytics-stat-value">{value}</span>
                <span className="lumiverse-analytics-stat-label">{label}</span>
            </div>
            {trend !== undefined && (
                <span className={clsx(
                    'lumiverse-analytics-stat-trend',
                    trend > 0 && 'lumiverse-analytics-stat-trend--up',
                    trend < 0 && 'lumiverse-analytics-stat-trend--down'
                )}>
                    {trend > 0 ? <ArrowUp size={14} /> : trend < 0 ? <ArrowDown size={14} /> : <Minus size={14} />}
                </span>
            )}
        </motion.div>
    );
}

/**
 * Mini bar chart for type distribution
 */
function TypeDistribution({ data }) {
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);

    const typeConfig = {
        thought: { Icon: MessageCircle, color: 'rgba(100, 200, 255, 0.8)', label: 'Thoughts' },
        feeling: { Icon: Heart, color: 'rgba(200, 100, 255, 0.8)', label: 'Feelings' },
        action: { Icon: Zap, color: 'rgba(255, 180, 100, 0.8)', label: 'Actions' },
        meta: { Icon: FileText, color: 'rgba(100, 255, 150, 0.8)', label: 'Meta' },
    };

    if (total === 0) {
        return (
            <div className="lumiverse-analytics-empty">
                <span>No OOC comments recorded yet</span>
            </div>
        );
    }

    return (
        <div className="lumiverse-analytics-distribution">
            <div className="lumiverse-analytics-bars">
                {Object.entries(data).map(([type, count]) => {
                    const config = typeConfig[type] || { Icon: FileText, color: 'rgba(150, 150, 150, 0.8)', label: type };
                    const { Icon } = config;
                    const percentage = total > 0 ? (count / total) * 100 : 0;

                    return (
                        <div
                            key={type}
                            className="lumiverse-analytics-bar-item"
                        >
                            <div className="lumiverse-analytics-bar-label">
                                <span className="lumiverse-analytics-bar-icon">
                                    <Icon size={14} strokeWidth={1.5} />
                                </span>
                                <span className="lumiverse-analytics-bar-name">{config.label}</span>
                                <span className="lumiverse-analytics-bar-count">{count}</span>
                            </div>
                            <div className="lumiverse-analytics-bar-track">
                                <motion.div
                                    className="lumiverse-analytics-bar-fill"
                                    style={{ background: config.color }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Recent comments timeline
 */
function RecentComments({ comments }) {
    const typeIcons = {
        thought: MessageCircle,
        feeling: Heart,
        action: Zap,
        meta: FileText,
    };

    const formatTime = (timestamp) => {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    if (comments.length === 0) {
        return (
            <div className="lumiverse-analytics-empty">
                <span>No recent comments</span>
            </div>
        );
    }

    return (
        <div className="lumiverse-analytics-timeline">
            <AnimatePresence initial={false}>
                {comments.slice(0, 5).map((comment, index) => {
                    const Icon = typeIcons[comment.type] || FileText;
                    return (
                        <motion.div
                            key={comment.timestamp}
                            className="lumiverse-analytics-comment"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                        >
                            <span className="lumiverse-analytics-comment-icon">
                                <Icon size={14} strokeWidth={1.5} />
                            </span>
                            <div className="lumiverse-analytics-comment-content">
                                <p className="lumiverse-analytics-comment-text">{comment.text}</p>
                                <span className="lumiverse-analytics-comment-time">
                                    {formatTime(comment.timestamp)}
                                </span>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}

/**
 * Session insight card
 */
function InsightCard({ title, value, description, Icon }) {
    return (
        <div className="lumiverse-analytics-insight">
            <span className="lumiverse-analytics-insight-icon">
                <Icon size={18} strokeWidth={1.5} />
            </span>
            <div className="lumiverse-analytics-insight-content">
                <span className="lumiverse-analytics-insight-title">{title}</span>
                <span className="lumiverse-analytics-insight-value">{value}</span>
                {description && (
                    <span className="lumiverse-analytics-insight-desc">{description}</span>
                )}
            </div>
        </div>
    );
}

/**
 * Toggle switch component (iOS-style)
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
 * Main OOC Analytics Dashboard component
 */
function OOCAnalytics() {
    const stats = useOOCStats();
    const store = useLumiverseStore;

    // Subscribe to oocEnabled from store
    const oocEnabled = useSyncExternalStore(
        store.subscribe,
        () => store.getState().oocEnabled ?? true,
        () => store.getState().oocEnabled ?? true
    );

    // Calculate insights
    const insights = useMemo(() => {
        const mostCommon = Object.entries(stats.commentsByType)
            .sort((a, b) => b[1] - a[1])[0];

        return {
            mostCommonType: mostCommon ? mostCommon[0] : 'none',
            mostCommonCount: mostCommon ? mostCommon[1] : 0,
            engagementRate: stats.sessionCount > 0
                ? ((stats.totalComments / stats.sessionCount) * 10).toFixed(0)
                : 0,
        };
    }, [stats]);

    const handleToggleOOC = useCallback((enabled) => {
        store.setState({ oocEnabled: enabled });
        saveToExtension();
    }, []);

    return (
        <div className="lumiverse-ooc-analytics">
            {/* Quick Stats */}
            <div className="lumiverse-analytics-section">
                <h4 className="lumiverse-analytics-section-title">Session Overview</h4>
                <div className="lumiverse-analytics-stats-grid">
                    <StatCard
                        Icon={MessageCircle}
                        label="Total Comments"
                        value={stats.totalComments}
                        color="rgba(147, 112, 219, 0.8)"
                    />
                    <StatCard
                        Icon={BarChart2}
                        label="Avg per Message"
                        value={stats.averagePerMessage.toFixed(1)}
                        color="rgba(100, 200, 255, 0.8)"
                    />
                </div>
            </div>

            {/* Type Distribution */}
            <div className="lumiverse-analytics-section">
                <h4 className="lumiverse-analytics-section-title">Comment Types</h4>
                <TypeDistribution data={stats.commentsByType} />
            </div>

            {/* Insights */}
            <div className="lumiverse-analytics-section">
                <h4 className="lumiverse-analytics-section-title">Insights</h4>
                <div className="lumiverse-analytics-insights">
                    <InsightCard
                        Icon={Target}
                        title="Most Used Type"
                        value={insights.mostCommonType.charAt(0).toUpperCase() + insights.mostCommonType.slice(1)}
                        description={`${insights.mostCommonCount} comments`}
                    />
                    <InsightCard
                        Icon={TrendingUp}
                        title="Engagement Score"
                        value={`${insights.engagementRate}%`}
                        description="Based on comment frequency"
                    />
                </div>
            </div>

            {/* Recent Activity */}
            <div className="lumiverse-analytics-section">
                <h4 className="lumiverse-analytics-section-title">Recent Activity</h4>
                <RecentComments comments={stats.recentComments} />
            </div>

            {/* Quick Controls */}
            <div className="lumiverse-analytics-section">
                <h4 className="lumiverse-analytics-section-title">Quick Controls</h4>
                <div className="lumiverse-analytics-controls">
                    <Toggle
                        id="ooc-enabled-toggle"
                        checked={oocEnabled}
                        onChange={handleToggleOOC}
                        label="OOC Comments"
                    />
                </div>
            </div>
        </div>
    );
}

export default OOCAnalytics;
