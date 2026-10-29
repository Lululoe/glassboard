import { ListField, NumberField, SegmentedField, TextField } from '../../components/Editor/EditorFields';
import { setIn } from '../../components/Editor/setIn';

/**
 * Settings form for the thermostat card. Presets are optional: without them the card shows
 * the preset modes of the Home Assistant entity.
 * @param {Object} props
 * @param {Object} props.config - The card config being edited.
 * @param {(config: Object) => void} props.onChange - Receives the updated config.
 * @returns {JSX.Element} The form.
 */
const ThermostatEditor = ({ config, onChange }) => {
    const set = (key) => (value) => onChange(setIn(config, [key], value));
    const presets = Array.isArray(config.presets) ? config.presets : [];
    return (
        <>
            <TextField label="Climate entity" value={config.entity_id} onChange={set('entity_id')} placeholder="climate.living_room" />
            <TextField label="Name" value={config.name} onChange={set('name')} placeholder="From Home Assistant" />
            <SegmentedField
                label="Turn on as"
                value={config.hvac_mode || 'heat'}
                options={[{ value: 'heat', label: 'Heat' }, { value: 'cool', label: 'Cool' }, { value: 'heat_cool', label: 'Heat/Cool' }, { value: 'auto', label: 'Auto' }]}
                onChange={(value) => onChange(setIn(config, ['hvac_mode'], value === 'heat' ? undefined : value))}
                hint="The mode used when the thermostat is switched on from the card."
            />
            <div className="editor-row">
                <NumberField label="Slider minimum" value={config.min} onChange={set('min')} placeholder="From entity" />
                <NumberField label="Slider maximum" value={config.max} onChange={set('max')} placeholder="From entity" />
            </div>
            <ListField
                label="Presets"
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
                hint="Leave empty to use the presets from Home Assistant. Each preset either sets a temperature or switches to a Home Assistant preset mode. Icons are Lucide names."
            />
        </>
    );
};

export default ThermostatEditor;
