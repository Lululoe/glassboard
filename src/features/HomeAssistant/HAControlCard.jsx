import { useHomeAssistant } from './useHomeAssistant';
import BaseCard from '../../components/Shared/BaseCard';
import './HAControlCard.css';
import Icon from '../../components/Shared/Icon';

/**
 * Component displaying a grid of toggleable Home Assistant entities.
 * @param {Object} props
 * @param {Object} props.config - Card configuration containing the entity list.
 * @returns {JSX.Element} The rendered HA control card.
 */
const HAControlCard = ({ config }) => {
    const { data } = config;
    const entities = data?.entities || [];

    // Limit based on size (colSpan 1 = 4 items, colSpan 2 = 8 items)
    const maxItems = (config.colSpan || 1) * 4;
    const displayEntities = entities.slice(0, maxItems);

    const { entityStates, loading, toggleEntity } = useHomeAssistant(displayEntities);

    const getIcon = (iconName) => {
        if (!iconName) return 'lu-HelpCircle';

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
        <BaseCard className={`ha-control-card col-span-${config.colSpan || 1}`} hoverable={false}>
            <div className="ha-control-grid">
                {displayEntities.map((entity, idx) => {
                    // Get live state from HA, fallback to config
                    const liveState = entityStates[entity.entity_id];
                    const currentState = liveState?.state || entity.state || 'unknown';
                    const iconString = getIcon(entity.icon);

                    // Determine if "on"
                    let isOn = false;
                    if (entity.on_state) isOn = currentState === entity.on_state;
                    else if (entity.off_state) isOn = currentState !== entity.off_state;
                    else isOn = currentState !== 'off' && currentState !== 'unavailable' && currentState !== 'unknown';

                    // Check if entity has actions (for hover effect)
                    const hasActions = entity.on_action && entity.off_action;

                    const tileClass = `ha-tile ${isOn ? 'on' : 'off'}`;
                    // Tiles that can be toggled are buttons, so they work with keyboard and screen readers
                    const Tile = hasActions ? 'button' : 'div';
                    const circleClass = isOn ? 'ha-icon-circle on' : 'ha-icon-circle off';

                    // Dynamic color override if on
                    const circleStyle = {};
                    if (isOn && entity.color) {
                        circleStyle.backgroundColor = entity.color;
                    }

                    // Get display state from configured attributes
                    const displayState = getDisplayState(entity, liveState);

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
                            <div className="ha-tile-content">
                                <div className="ha-tile-name" title={entity.name}>{entity.name}</div>
                                <div className="ha-tile-state">{loading ? 'Loading…' : displayState}</div>
                            </div>
                        </Tile>
                    );
                })}
            </div>
        </BaseCard>
    );
};

export default HAControlCard;
