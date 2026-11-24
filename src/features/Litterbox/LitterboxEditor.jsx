import { Group, ListField, TextField } from '../../components/Editor/EditorFields';
import { EntityPicker } from '../../components/Editor/EntityPicker';
import { setIn } from '../../components/Editor/setIn';

/** @type {Array<{key: string, label: string, domains: string[], pattern: string}>} */
const FIELDS = [
    { key: 'status', label: 'Status code', domains: ['sensor'], pattern: 'sensor.<p>_status_code' },
    { key: 'waste', label: 'Waste drawer', domains: ['sensor'], pattern: 'sensor.<p>_waste_drawer' },
    { key: 'litter', label: 'Litter level', domains: ['sensor'], pattern: 'sensor.<p>_litter_level' },
    { key: 'last_seen', label: 'Last seen', domains: ['sensor'], pattern: 'sensor.<p>_last_seen' },
    { key: 'hopper', label: 'Hopper', domains: ['sensor'], pattern: 'sensor.<p>_hopper_status' },
    { key: 'reset', label: 'Reset button', domains: ['button'], pattern: 'button.<p>_reset' },
    { key: 'clean_delay', label: 'Clean cycle wait time', domains: ['select'], pattern: 'select.<p>_clean_cycle_wait_time_minutes' },
    { key: 'globe_light', label: 'Globe light', domains: ['select'], pattern: 'select.<p>_globe_light' },
    { key: 'panel_lock', label: 'Panel lockout', domains: ['switch'], pattern: 'switch.<p>_panel_lockout' },
    { key: 'sleep_start', label: 'Sleep start', domains: ['sensor'], pattern: 'sensor.<p>_sleep_mode_start_time' },
    { key: 'sleep_end', label: 'Sleep end', domains: ['sensor'], pattern: 'sensor.<p>_sleep_mode_end_time' },
    { key: 'firmware', label: 'Firmware', domains: ['update'], pattern: 'update.<p>_firmware' },
];

/**
 * Fills in the Litter-Robot integration's entity ids from the vacuum entity's prefix,
 * leaving fields that are already set alone.
 * @param {Object} config - The card config.
 * @param {string} entityId - The chosen vacuum entity, e.g. `vacuum.litter_robot_4_litter_box`.
 * @returns {Object} The updated config.
 */
const withDefaults = (config, entityId) => {
    const next = { ...config, entity_id: entityId };
    const prefix = /^vacuum\.(.+?)_litter_box$/.exec(entityId || '')?.[1];
    if (!prefix) return next;
    for (const { key, pattern } of FIELDS) {
        if (!next[key]) next[key] = pattern.replace('<p>', prefix);
    }
    return next;
};

/**
 * Settings form for the litter box card.
 * @param {Object} props
 * @param {Object} props.config - The card config being edited.
 * @param {(config: Object) => void} props.onChange - Receives the updated config.
 * @returns {JSX.Element} The form.
 */
const LitterboxEditor = ({ config, onChange }) => {
    const set = (key) => (value) => onChange(setIn(config, [key], value));
    return (
        <>
            <Group title="Litter box">
                <EntityPicker
                    label="Vacuum entity"
                    value={config.entity_id}
                    onChange={(id) => onChange(withDefaults(config, id))}
                    domains={['vacuum']}
                    placeholder="vacuum.litter_robot_4_litter_box"
                    clearable={false}
                    hint="For a Litter-Robot, the other entities below are filled in for you."
                />
                <TextField label="Name" value={config.name} onChange={set('name')} placeholder="From Home Assistant" />
            </Group>
            <Group title="Entities" description="Optional entities of the litter box. Those left empty are hidden.">
                {FIELDS.map(({ key, label, domains, pattern }) => (
                    <EntityPicker key={key} label={label} domains={domains} value={config[key]} onChange={set(key)} placeholder={pattern.replace('<p>', 'litter_robot_4')} />
                ))}
            </Group>
            <ListField
                label="Cats"
                items={Array.isArray(config.cats) ? config.cats : []}
                onChange={set('cats')}
                columns={[
                    { key: 'name', label: 'Name', placeholder: 'e.g. Pepper' },
                    { key: 'weight', label: 'Weight', placeholder: 'sensor.pepper_weight', entity: ['sensor'] },
                    { key: 'visits', label: 'Visits today', placeholder: 'sensor.pepper_visits_today', entity: ['sensor'] },
                    { key: 'color', label: 'Color', placeholder: 'Optional, e.g. #ff9f0a' },
                ]}
                addLabel="Add cat"
                max={6}
                hint="Each cat gets its own timeline on the full size card and in the details."
            />
        </>
    );
};

export default LitterboxEditor;
