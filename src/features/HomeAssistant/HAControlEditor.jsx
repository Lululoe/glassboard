import { Group, TextField } from '../../components/Editor/EditorFields';
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
 * Applies a change to the entity: entering an entity id fills in its on/off actions for
 * common domains, unless the entity already has custom actions.
 * @param {Object} entity - The entity config.
 * @param {string} key - The changed property.
 * @param {*} value - Its new value.
 * @returns {Object} The changed entity.
 */
const changeEntity = (entity, key, value) => {
    const next = setIn(entity, [key], value);
    if (key !== 'entity_id') return next;
    // Replace the actions only if they were the defaults for the previous entity
    const before = actionsFor(entity?.entity_id);
    const untouched = !entity?.on_action || (before && JSON.stringify(entity.on_action) === JSON.stringify(before.on_action));
    const after = actionsFor(value);
    if (!untouched) return next;
    if (!after) {
        const { on_action: _on, off_action: _off, ...rest } = next;
        return rest;
    }
    return { ...next, ...after };
};

/**
 * Settings form for the Home Assistant control card: the one entity its tile shows.
 * @param {Object} props
 * @param {Object} props.config - The card config being edited.
 * @param {(config: Object) => void} props.onChange - Receives the updated config.
 * @returns {JSX.Element} The form.
 */
const HAControlEditor = ({ config, onChange }) => {
    const entities = Array.isArray(config.data?.entities) ? config.data.entities : [];
    const entity = entities[0] || {};
    const set = (key) => (value) => onChange(setIn(config, ['data', 'entities'], [changeEntity(entity, key, value), ...entities.slice(1)]));
    return (
        <>
            <Group
                title="Entity"
                description="Lights, switches, fans, covers, locks and groups get on/off actions automatically."
            >
                <TextField label="Entity id" value={entity.entity_id} onChange={set('entity_id')} placeholder="light.kitchen" />
                <TextField label="Name" value={entity.name} onChange={set('name')} placeholder="Kitchen" />
                <TextField
                    label="Icon"
                    value={typeof entity.icon === 'string' ? entity.icon : undefined}
                    onChange={set('icon')}
                    placeholder="From Home Assistant, e.g. mdi:lamp"
                />
            </Group>
            <Group title="When on">
                <TextField
                    label="Color"
                    value={entity.color}
                    onChange={set('color')}
                    placeholder="Yellow, or e.g. #f1c40f"
                    hint="The color of the icon while the entity is on. Other actions and attributes can be set in YAML."
                />
            </Group>
        </>
    );
};

export default HAControlEditor;
