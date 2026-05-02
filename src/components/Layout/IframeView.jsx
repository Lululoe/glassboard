
import React from 'react';
import './IframeView.css';

/**
 * Renders an iframe view for embedding external web pages.
 * @param {Object} props
 * @param {Object} props.config - Configuration object containing the url and name.
 * @returns {JSX.Element} The iframe container or an error state if no URL is provided.
 */
const IframeView = ({ config }) => {
    if (!config || !config.url) {
        return (
            <div className="iframe-view-error">
                <p>Error: No URL configured for this page.</p>
            </div>
        );
    }

    return (
        <div className="iframe-view-container">
            <iframe
                src={config.url}
                className="iframe-view-frame"
                title={config.name || 'External Content'}
                allowFullScreen
            />
        </div>
    );
};

export default IframeView;
