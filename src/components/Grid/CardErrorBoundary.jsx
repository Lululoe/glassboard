import { Component } from 'react';

/**
 * Catches render errors in a single card so one broken card does not take down the
 * whole dashboard. The error state resets when `resetKey` changes (e.g. after a config reload).
 * @extends {Component<{label: string|number, resetKey: *, children: import('react').ReactNode}, {error: Error|null}>}
 */
class CardErrorBoundary extends Component {
    /** @type {{error: Error|null}} */
    state = { error: null };

    /**
     * Stores the error so the fallback UI renders.
     * @param {Error} error - The error thrown while rendering.
     * @returns {{error: Error}} New state.
     */
    static getDerivedStateFromError(error) {
        return { error };
    }

    /**
     * Logs the error with the card it came from.
     * @param {Error} error - The error thrown while rendering.
     */
    componentDidCatch(error) {
        console.error(`Card "${this.props.label}" crashed:`, error);
    }

    /**
     * Clears the error when the card's config changes.
     * @param {Object} prevProps - Previous props.
     */
    componentDidUpdate(prevProps) {
        if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ error: null });
        }
    }

    /**
     * Renders the card, or an error card if it crashed.
     * @returns {import('react').ReactNode} The card or the fallback.
     */
    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div className="glass-card">
                <div className="card-content">
                    Card "{this.props.label}" failed to render: {this.state.error.message}
                </div>
            </div>
        );
    }
}

export default CardErrorBoundary;
