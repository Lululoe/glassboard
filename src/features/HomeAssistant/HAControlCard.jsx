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

    // Use the Home Assistant hook
    const service = config.service || 'homeassistant';
    const { entityStates, loading, toggleEntity } = useHomeAssistant(displayEntities, service);

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
        <BaseCard colSpan={config.colSpan} className={`ha-control-card col-span-${config.colSpan || 1}`} hoverable={false}>
            <div className="ha-control-grid">
                {displayEntities.map((entity, idx) => {
                    // Get live state from HA, fallback to config
                    const liveState = entityStates[entity.entity_id];
                    const currentState = liveState?.state || entity.state || 'unknown';
                    const iconString = getIcon(entity.icon, entity.entity_id || '');

                    // Determine if "on"
                    let isOn = false;
                    if (entity.on_state) isOn = currentState === entity.on_state;
                    else if (entity.off_state) isOn = currentState !== entity.off_state;
                    else isOn = currentState !== 'off' && currentState !== 'unavailable' && currentState !== 'unknown';

                    // Check if entity has actions (for hover effect)
                    const hasActions = entity.on_action && entity.off_action;

                    const tileClass = `ha-tile ${isOn ? 'on' : 'off'}`;
                    const circleClass = isOn ? 'ha-icon-circle on' : 'ha-icon-circle off';

                    // Dynamic color override if on
                    const circleStyle = {};
                    if (isOn && entity.color) {
                        circleStyle.backgroundColor = entity.color;
                    }

                    // Get display state from configured attributes
                    const displayState = getDisplayState(entity, liveState);

                    return (
                        <div
                            key={idx}
                            className={tileClass}
                            onClick={hasActions ? () => toggleEntity(entity, isOn) : undefined}
                            style={{ cursor: hasActions ? 'pointer' : 'default' }}
                        >
                            <div className={circleClass} style={circleStyle}>
                                <Icon icon={iconString} size={24} />
                            </div>
                            <div className="ha-tile-content">
                                <div className="ha-tile-name" title={entity.name}>{entity.name}</div>
                                <div className="ha-tile-state">{loading ? '...' : displayState}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </BaseCard>
    );
};

export default HAControlCard;
