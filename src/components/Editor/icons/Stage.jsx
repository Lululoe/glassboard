import { useElementSize } from '../../../hooks/useElementSize';
import './IconEditor.css';

/**
 * The window onto the dashboard in an editor: what is edited, at its real size on the page
 * background, scaled down only when it doesn't fit.
 * @param {Object} props
 * @param {number} props.width - Real width of the content in pixels.
 * @param {number} [props.height] - Real height of the content; omitted, it follows the content.
 * @param {boolean} [props.crop] - Fades out the card's content under its header.
 * @param {import('react').ReactNode} [props.tools] - Controls above or below the content.
 * @param {import('react').ReactNode} [props.footer] - Shown under the content.
 * @param {(zoom: number) => import('react').ReactNode} props.children - Renders the content; receives the zoom.
 * @returns {JSX.Element} The stage.
 */
const Stage = ({ width, height, crop = false, tools, footer, children }) => {
    const [size, measure] = useElementSize();
    const zoom = size.width > 0 ? Math.min(1, size.width / width) : 1;
    const percent = Math.round(zoom * 100);

    return (
        <div className={`icon-stage${crop ? ' icon-stage-crop' : ''}`}>
            {tools}
            <div className="icon-stage-measure" ref={measure}>
                <div className="icon-stage-canvas" style={{ zoom, width, height }}>
                    {children(zoom)}
                </div>
            </div>
            {percent < 100 && <p className="icon-stage-note">Shown at {percent}%.</p>}
            {footer}
        </div>
    );
};

export default Stage;
