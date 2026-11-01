import { useState } from 'react';
import { isControllable, useHomeAssistant } from './useHomeAssistant';
import ControlDialog from './controls/ControlDialog';
import BaseCard from '../../components/Shared/BaseCard';
import './HAControlCard.css';
import Icon from '../../components/Shared/Icon';

/**
 * Component displaying a grid of toggleable Home Assistant entities. Tapping a light, group,
 * switch or fan opens its control dialog and tapping its icon switches it; other entities
 * switch with their configured actions.
 * @param {Object} props
 * @param {Object} props.config - Card configuration containing the entity list.
 * @returns {JSX.Element} The rendered HA control card.
 */
const HAControlCard = ({ config }) => {
    const { data } = config;
    const entities = data?.entities || [];

    // Limit based on size: a quarter tile holds 1 item, a half tile 2, and each column 4
    const tileSize = config.tileSize === 'quarter' || config.tileSize === 'half' ? config.tileSize : null;
    const maxItems = tileSize === 'quarter' ? 1 : tileSize === 'half' ? 2 : (config.colSpan || 1) * 4;
    const displayEntities = entities.slice(0, maxItems);

    const { entityStates, loading, toggleEntity, refresh } = useHomeAssistant(displayEntities);
    const [openId, setOpenId] = useState(/** @type {string|null} */ (null));
    const openEntity = displayEntities.find(e => e.entity_id === openId);

    const getIcon = (iconName, entityId = '') => {
        // Objects and prefixed names (mdi:, lu-, sh-, local-, URLs) go to the Icon component as they are
        if (iconName && typeof iconName === 'object') return iconName;
        if (typeof iconName === 'string' && /^(mdi[:-]|lu-|sh-|local-|https?:\/\/)/.test(iconName)) return iconName;
        if (!iconName) {
            // Defaults for entities that open a control dialog
            const domain = String(entityId).split('.')[0];
            if (domain === 'light' || domain === 'group') return 'lu-Lightbulb';
            if (domain === 'fan') return 'lu-Fan';
            if (domain === 'switch' || domain === 'input_boolean') return 'lu-Power';
            return 'lu-HelpCircle';
        }

        // Check for specific mappings first
        if (iconName === 'lamp') return 'lu-Lightbulb';
        if (iconName === 'switch') return 'lu-Power';
        if (iconName === 'temp') return 'lu-Thermometer';
        if (iconName === 'speaker') return 'lu-Volume2';

        // Pass through PascalCase (e.g. "AlignJustify" -> "lu-AlignJustify")
        return `lu-${iconName}`;
    };

    // Format attribute value for display
    const formatAttributeValue = (liveState, attributeName) => {
        if (attributeName === 'state') {
            return liveState?.state || 'unknown';
        }

        if (attributeName === 'brightness' && liveState?.attributes?.brightness !== undefined) {
            return `${Math.round((liveState.attributes.brightness / 255) * 100)}%`;
        }

        // Generic attribute access
        if (liveState?.attributes?.[attributeName] !== undefined) {
            return String(liveState.attributes[attributeName]);
        }

        return null;
    };

    // Get display state based on configured attributes
    const getDisplayState = (entity, liveState) => {
        const attributes = entity.attributes || ['state'];

        const values = attributes
            .map(attr => formatAttributeValue(liveState, attr))
            .filter(val => val !== null);

        return values.length > 0 ? values.join(' • ') : 'unknown';
    };

    return (
        <BaseCard className={`ha-control-card ${tileSize ? `tile-${tileSize}` : `col-span-${config.colSpan || 1}`}`} hoverable={false}>
            <div className="ha-control-grid">
                {displayEntities.map((entity, idx) => {
                    // Get live state from HA, fallback to config
                    const liveState = entityStates[entity.entity_id];
                    const currentState = liveState?.state || entity.state || 'unknown';
                    // The card's icon, else the one Home Assistant shows for the entity
                    const iconString = getIcon(entity.icon || liveState?.icon, entity.entity_id);

                    // Determine if "on"
                    let isOn = false;
                    if (entity.on_state) isOn = currentState === entity.on_state;
                    else if (entity.off_state) isOn = currentState !== entity.off_state;
                    else isOn = currentState !== 'off' && currentState !== 'unavailable' && currentState !== 'unknown';

                    // Check if entity has actions (for hover effect)
                    const hasActions = entity.on_action && entity.off_action;
                    const hasDialog = isControllable(entity) && entity.dialog !== false;

                    const tileClass = `ha-tile ${isOn ? 'on' : 'off'}${hasDialog ? ' has-dialog' : ''}`;
                    const circleClass = isOn ? 'ha-icon-circle on' : 'ha-icon-circle off';

                    // Dynamic color override if on
                    const circleStyle = {};
                    if (isOn && entity.color) {
                        circleStyle.backgroundColor = entity.color;
                    }

                    // Get display state from configured attributes
                    const displayState = getDisplayState(entity, liveState);
                    const content = (
                        <div className="ha-tile-content">
                            <div className="ha-tile-name" title={entity.name}>{entity.name}</div>
                            <div className="ha-tile-state">{loading ? 'Loading…' : displayState}</div>
                        </div>
                    );

                    if (hasDialog) {
                        // Two sibling buttons: the tile opens the controls, the icon switches
                        return (
                            <div key={entity.entity_id ?? idx} className={tileClass}>
                                <button
                                    type="button"
                                    className="button-reset ha-tile-open"
                                    aria-haspopup="dialog"
                                    aria-label={`${entity.name}, ${loading ? 'loading' : displayState}. Show controls`}
                                    onClick={() => setOpenId(entity.entity_id)}
                                />
                                <button
                                    type="button"
                                    className={`button-reset ${circleClass}`}
                                    style={circleStyle}
                                    aria-pressed={isOn}
                                    aria-label={`${entity.name}: ${isOn ? 'On' : 'Off'}`}
                                    onClick={() => toggleEntity(entity, isOn)}
                                >
                                    <Icon icon={iconString} size={20} />
                                </button>
                                {content}
                            </div>
                        );
                    }

                    // Tiles that can be toggled are buttons, so they work with keyboard and screen readers
                    const Tile = hasActions ? 'button' : 'div';
                    return (
                        <Tile
                            key={entity.entity_id ?? idx}
                            className={hasActions ? `button-reset ${tileClass}` : tileClass}
                            {...(hasActions && {
                                type: 'button',
                                'aria-pressed': isOn,
                                onClick: () => toggleEntity(entity, isOn),
                            })}
                        >
                            <div className={circleClass} style={circleStyle} aria-hidden="true">
                                <Icon icon={iconString} size={20} />
                            </div>
                            {content}
                        </Tile>
                    );
                })}
            </div>
            {openEntity && (
                <ControlDialog
                    entity={openEntity}
                    icon={getIcon(openEntity.icon || entityStates[openEntity.entity_id]?.icon, openEntity.entity_id)}
                    onChange={refresh}
                    onClose={() => { setOpenId(null); refresh(); }}
                />
            )}
        </BaseCard>
    );
};

export default HAControlCard;
