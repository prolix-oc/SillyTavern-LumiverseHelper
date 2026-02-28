import React from 'react';

/**
 * React Error Boundary — catches render errors in child component trees
 * and displays a minimal fallback UI instead of killing the entire app.
 *
 * Usage:
 *   <ErrorBoundary label="Sidebar">
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error(
            `[Lumiverse ErrorBoundary${this.props.label ? ` — ${this.props.label}` : ''}]`,
            error,
            errorInfo?.componentStack
        );
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    padding: '24px 16px',
                    textAlign: 'center',
                    color: 'var(--lumiverse-text, #ccc)',
                    minHeight: '80px',
                }}>
                    <span style={{ fontSize: '14px', opacity: 0.8 }}>
                        Something went wrong
                        {this.props.label ? ` in ${this.props.label}` : ''}
                    </span>
                    <button
                        onClick={this.handleRetry}
                        type="button"
                        style={{
                            padding: '6px 16px',
                            fontSize: '13px',
                            borderRadius: '6px',
                            border: '1px solid var(--lumiverse-border, rgba(255,255,255,0.15))',
                            background: 'var(--lumiverse-fill-subtle, rgba(255,255,255,0.06))',
                            color: 'var(--lumiverse-text, #ccc)',
                            cursor: 'pointer',
                        }}
                    >
                        Retry
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
