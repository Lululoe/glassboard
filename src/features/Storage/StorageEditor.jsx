import { Group, ListField, SegmentedField, TextField } from '../../components/Editor/EditorFields';
import { setIn } from '../../components/Editor/setIn';

const BARS = [{ value: 'dots', label: 'Dots' }, { value: 'solid', label: 'Solid' }];
const SOURCES = [
    { value: 'prometheus', label: 'Prometheus' },
    { value: 'homeassistant', label: 'Home Assistant' },
];

/** Shows a list of entity ids as one line, separated by commas. */
const joined = (value) => (Array.isArray(value) ? value.join(', ') : value);
const categories = (list) => (Array.isArray(list) ? list : []).map(c => ({ ...c, entities: joined(c?.entities ?? c?.entity) }));

/**
 * Settings form for the storage card.
 * @param {Object} props
 * @param {Object} props.config - The card config being edited.
 * @param {(config: Object) => void} props.onChange - Receives the updated config.
 * @returns {JSX.Element} The form.
 */
const StorageEditor = ({ config, onChange }) => {
    const set = (key) => (value) => onChange(setIn(config, [key], value));
    const total = typeof config.total === 'number' ? String(config.total) : config.total;
    return (
        <>
            <Group title="Card">
                <TextField label="Title" value={config.title} onChange={set('title')} placeholder="Storage" />
                <SegmentedField
                    label="Bar"
                    value={config.bar === 'solid' ? 'solid' : 'dots'}
                    options={BARS}
                    onChange={set('bar')}
                    hint="A matrix of dots, or flat blocks like the Graph card's bars."
                />
            </Group>
            <Group title="Data" description="Where the sizes come from. Until one is picked, the card shows sample data.">
                <SegmentedField label="Source" value={config.source} options={SOURCES} onChange={set('source')} />
                {config.source === 'prometheus' && (
                    <>
                        <TextField
                            label="ZFS pool" value={config.pool} onChange={set('pool')} placeholder="tank"
                            hint="Reads the pool from the storage scanner's metrics."
                        />
                        <TextField
                            label="Filesystem target" value={config.target} onChange={set('target')} placeholder="docker-node-01"
                            hint="Or a guest's filesystem, when no pool is set."
                        />
                        <TextField label="Mount" value={config.mount} onChange={set('mount')} placeholder="/" />
                    </>
                )}
                {config.source === 'homeassistant' && (
                    <>
                        <TextField
                            label="Total" value={total} placeholder="sensor.nas_size or 4000"
                            onChange={v => set('total')(v !== undefined && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : v)}
                            hint="An entity with the volume's size, or its size in GB."
                        />
                        <TextField
                            label="Used" value={joined(config.used)} onChange={set('used')} placeholder="sensor.nas_used"
                            hint="Optional. What the categories leave out of it shows as Other."
                        />
                    </>
                )}
            </Group>
            {config.source === 'homeassistant' && (
                <ListField
                    label="Categories"
                    items={categories(config.categories)}
                    onChange={set('categories')}
                    columns={[
                        { key: 'name', label: 'Name', placeholder: 'Media' },
                        { key: 'entities', label: 'Entities', placeholder: 'sensor.movies_size, sensor.shows_size', hint: 'Added up. Separate several with commas.' },
                        { key: 'color', label: 'Color', placeholder: 'blue' },
                    ]}
                    addLabel="Add category"
                    hint="Sizes in any data unit Home Assistant reports, converted to GB."
                />
            )}
        </>
    );
};

export default StorageEditor;
