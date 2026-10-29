import { NumberField, SegmentedField, TextField } from '../../components/Editor/EditorFields';
import { setIn } from '../../components/Editor/setIn';

/**
 * Settings form for the weather card.
 * @param {Object} props
 * @param {Object} props.config - The card config being edited.
 * @param {(config: Object) => void} props.onChange - Receives the updated config.
 * @returns {JSX.Element} The form.
 */
const WeatherEditor = ({ config, onChange }) => {
    const set = (key) => (value) => onChange(setIn(config, [key], value));
    return (
        <>
            <TextField
                label="Location"
                value={config.location}
                onChange={set('location')}
                placeholder="Berlin"
                hint="A place name. Coordinates below take precedence."
            />
            <div className="editor-row">
                <NumberField label="Latitude" value={config.latitude} onChange={set('latitude')} placeholder="52.52" />
                <NumberField label="Longitude" value={config.longitude} onChange={set('longitude')} placeholder="13.41" />
            </div>
            <SegmentedField
                label="Units"
                value={config.units === 'imperial' ? 'imperial' : 'metric'}
                options={[{ value: 'metric', label: '°C' }, { value: 'imperial', label: '°F' }]}
                onChange={(value) => onChange(setIn(config, ['units'], value === 'metric' ? undefined : value))}
            />
        </>
    );
};

export default WeatherEditor;
