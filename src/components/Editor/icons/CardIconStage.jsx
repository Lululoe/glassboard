import { PageActiveContext } from '../../../context/pageActive';
import { getCardComponent } from '../../../features/registry';
import CardErrorBoundary from '../../Grid/CardErrorBoundary';
import { sizeOf } from '../../Grid/gridLayout';
import BackgroundField from './BackgroundField';
import IconColorField from './IconColorField';
import IconPicker from './IconPicker';
import { boxOf } from './cardBox';
import { readIcon, storedColor } from './iconModel';
import { setIn } from '../setIn';
import Stage from './Stage';

const CROP_HEIGHT = 176;

/**
 * The real card with its header, cut off under the header. Only the icon top left is edited
 * here, so the card itself is inert. It keeps the saved options while the draft changes, so
 * typing in the form doesn't make it reload its data; only its icon and size follow the draft.
 * @param {Object} props
 * @param {Object} props.config - The card being edited.
 * @param {Object} props.savedConfig - The card as it was when the editor opened.
 * @param {Object} [props.globalConfig] - The dashboard config.
 * @returns {JSX.Element} The stage.
 */
export const CardIconStage = ({ config, savedConfig, globalConfig }) => {
    const Card = getCardComponent(config.type);
    const box = boxOf(config);
    const crop = box.height === 315;
    const {
        tileSize: _tileSize, colSpan: _colSpan, icon: _icon, iconColor: _iconColor, iconBackground: _iconBackground,
        ...content
    } = savedConfig;
    const shown = {
        ...content,
        ...(config.tileSize ? { tileSize: config.tileSize } : { colSpan: config.colSpan }),
        ...(config.icon ? { icon: config.icon } : {}),
        ...(config.iconColor ? { iconColor: config.iconColor } : {}),
        ...(config.iconBackground ? { iconBackground: config.iconBackground } : {}),
    };

    return (
        <Stage width={box.width} height={crop ? CROP_HEIGHT : box.height} crop={crop}>
            {() => (
                <div className={`icon-stage-card tile-${sizeOf(config)}`} style={{ height: box.height }} inert>
                    <PageActiveContext value>
                        <CardErrorBoundary label={config.id ?? config.type} resetKey={shown}>
                            {Card && <Card config={shown} globalConfig={globalConfig} />}
                        </CardErrorBoundary>
                    </PageActiveContext>
                </div>
            )}
        </Stage>
    );
};

/**
 * Settings of the card's icon: which icon, its color and its background.
 * @param {Object} props
 * @param {Object} props.config - The card being edited.
 * @param {(config: Object) => void} props.onChange - Receives the changed card.
 * @returns {JSX.Element} The settings.
 */
export const CardIconInspector = ({ config, onChange }) => {
    const { ref, color: objectColor } = readIcon(config.icon);
    const color = objectColor || config.iconColor;
    const setIcon = (nextRef, nextColor) => {
        const withIcon = setIn(config, ['icon'], nextRef);
        onChange(setIn(withIcon, ['iconColor'], storedColor(nextRef, nextColor)));
    };

    return (
        <section className="icon-inspector" aria-label="Card icon">
            <h3 className="editor-section-title">Card icon</h3>
            <IconPicker value={ref} onChange={(next) => setIcon(next, color)} />
            {ref && <code className="icon-code">{ref}</code>}
            <IconColorField iconRef={ref} value={color} onChange={(next) => setIcon(ref, next)} />
            <BackgroundField
                value={config.iconBackground}
                onChange={(background) => onChange(setIn(config, ['iconBackground'], background))}
            />
        </section>
    );
};
