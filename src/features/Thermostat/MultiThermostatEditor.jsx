import { ListField, SegmentedField, TextField } from '../../components/Editor/EditorFields';
import { setIn } from '../../components/Editor/setIn';
import { MAX_ROOMS } from './useThermostat';

/**
 * Settings form for the multiroom thermostat card: its rooms and the presets they share.
 * Per-room presets and limits can be set in the YAML view.
 * @param {Object} props
 * @param {Object} props.config - The card config being edited.
 * @param {(config: Object) => void} props.onChange - Receives the updated config.
 * @returns {JSX.Element} The form.
 */
const MultiThermostatEditor = ({ config, onChange }) => {
    const rooms = Array.isArray(config.rooms) ? config.rooms : [];
    const presets = Array.isArray(config.presets) ? config.presets : [];
    return (
        <>
            <TextField label="Title" value={config.title} onChange={(v) => onChange(setIn(config, ['title'], v))} placeholder="Climate" />
            <ListField
                label="Rooms"
                items={rooms}
                onChange={(items) => onChange(setIn(config, ['rooms'], items))}
                columns={[
                    { key: 'entity_id', label: 'Climate entity', placeholder: 'climate.living_room' },
                    { key: 'name', label: 'Name', placeholder: 'From Home Assistant' },
                ]}
                addLabel="Add room"
                hint={`Up to ${MAX_ROOMS} rooms are shown${rooms.length > MAX_ROOMS ? `; the last ${rooms.length - MAX_ROOMS} are hidden` : ''}. One wide shows them as rows, two and three wide as columns.`}
            />
            <SegmentedField
                label="Turn on as"
                value={config.hvac_mode || 'heat'}
                options={[{ value: 'heat', label: 'Heat' }, { value: 'cool', label: 'Cool' }, { value: 'heat_cool', label: 'Heat/Cool' }, { value: 'auto', label: 'Auto' }]}
                onChange={(value) => onChange(setIn(config, ['hvac_mode'], value === 'heat' ? undefined : value))}
            />
            <ListField
                label="Presets for all rooms"
                items={presets}
                onChange={(items) => onChange(setIn(config, ['presets'], items.length > 0 ? items : undefined))}
                columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'temperature', label: 'Temperature', placeholder: 'e.g. 21' },
                    { key: 'preset', label: 'HA preset', placeholder: 'or e.g. eco' },
                    { key: 'icon', label: 'Icon', placeholder: 'e.g. Sun' },
                ]}
                onItemChange={(item, key, value) => {
                    const number = key === 'temperature' && value !== undefined ? Number(value.replace(',', '.')) : NaN;
                    return setIn(item, [key], key === 'temperature' && Number.isFinite(number) ? number : value);
                }}
                addLabel="Add preset"
                hint="Leave empty to use each room's presets from Home Assistant. A room can override these with its own presets in YAML."
            />
        </>
    );
};

export default MultiThermostatEditor;
