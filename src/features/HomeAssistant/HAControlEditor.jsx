import { ListField } from '../../components/Editor/EditorFields';
import { setIn } from '../../components/Editor/setIn';

/** On/off services per entity domain, filled in when an entity id is entered. */
const DOMAIN_ACTIONS = {
    light: ['light.turn_on', 'light.turn_off'],
    switch: ['switch.turn_on', 'switch.turn_off'],
    fan: ['fan.turn_on', 'fan.turn_off'],
    input_boolean: ['input_boolean.turn_on', 'input_boolean.turn_off'],
    cover: ['cover.open_cover', 'cover.close_cover'],
    lock: ['lock.lock', 'lock.unlock'],
    media_player: ['media_player.turn_on', 'media_player.turn_off'],
    // Groups have no turn_on service of their own; the generic one switches every member
    group: ['homeassistant.turn_on', 'homeassistant.turn_off'],
};

/**
 * Returns the default actions for an entity id, or null for domains without defaults.
 * @param {string|undefined} entityId - The entity id, e.g. `light.kitchen`.
 * @returns {{on_action: Object, off_action: Object}|null} The actions.
 */
const actionsFor = (entityId) => {
    const pair = DOMAIN_ACTIONS[String(entityId || '').split('.')[0]];
    return pair ? { on_action: { service: pair[0] }, off_action: { service: pair[1] } } : null;
};

/**
 * Settings form for the Home Assistant control card. Entering an entity id fills in its
 * on/off actions for common domains, unless the entity already has custom actions.
 * @param {Object} props
 * @param {Object} props.config - The card config being edited.
 * @param {(config: Object) => void} props.onChange - Receives the updated config.
 * @returns {JSX.Element} The form.
 */
const HAControlEditor = ({ config, onChange }) => (
    <ListField
        label="Entities"
        items={config.data?.entities || []}
        onChange={(entities) => onChange(setIn(config, ['data', 'entities'], entities))}
        columns={[
            { key: 'entity_id', label: 'Entity id', placeholder: 'light.kitchen' },
            { key: 'name', label: 'Name' },
            { key: 'icon', label: 'Icon', placeholder: 'From Home Assistant, e.g. mdi:lamp' },
        ]}
        onItemChange={(item, key, value) => {
            const next = setIn(item, [key], value);
            if (key !== 'entity_id') return next;
            // Replace the actions only if they were the defaults for the previous entity
            const before = actionsFor(item?.entity_id);
            const untouched = !item?.on_action || (before && JSON.stringify(item.on_action) === JSON.stringify(before.on_action));
            const after = actionsFor(value);
            if (!untouched) return next;
            if (!after) {
                const { on_action: _on, off_action: _off, ...rest } = next;
                return rest;
            }
            return { ...next, ...after };
        }}
        addLabel="Add entity"
        hint="Lights, switches, fans, covers, locks and groups get on/off actions automatically. Other actions, colors and attributes can be set in YAML."
    />
);

export default HAControlEditor;
