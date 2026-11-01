import { ListField, SegmentedField, TextField, ToggleField } from '../../components/Editor/EditorFields';
import { setIn } from '../../components/Editor/setIn';
import { DEFAULT_RANGES, MAX_SENSORS } from './graphModel';

/**
 * Settings form for the graph card: its sensors, the chart, time ranges and stacking.
 * @param {Object} props
 * @param {Object} props.config - The card config being edited.
 * @param {(config: Object) => void} props.onChange - Receives the updated config.
 * @returns {JSX.Element} The form.
 */
const GraphEditor = ({ config, onChange }) => {
    // Sensors may be written as plain entity ids in YAML
    const entities = (Array.isArray(config.entities) ? config.entities : []).map(e => (typeof e === 'string' ? { entity_id: e } : e));
    const chart = ['bar', 'week'].includes(config.chart) ? config.chart : 'line';
    const selector = config.ranges !== false;
    const stack = typeof config.stack === 'boolean' ? config.stack : 'auto';
    return (
        <>
            <TextField label="Title" value={config.title} onChange={(v) => onChange(setIn(config, ['title'], v))} placeholder="Graph" />
            <ListField
                label="Sensors"
                items={entities}
                onChange={(items) => onChange(setIn(config, ['entities'], items))}
                columns={[
                    { key: 'entity_id', label: 'Entity', placeholder: 'sensor.living_room_temperature' },
                    { key: 'name', label: 'Name', placeholder: 'From Home Assistant' },
                    { key: 'color', label: 'Color', placeholder: 'e.g. orange' },
                ]}
                addLabel="Add sensor"
                hint={`Up to ${MAX_SENSORS} sensors. Sensors with the same unit share an axis; a card shows up to two units. Colors: blue, orange, green, purple, teal, pink, yellow, red, or any CSS color.`}
            />
            <SegmentedField
                label="Chart"
                value={chart}
                options={[{ value: 'line', label: 'Lines' }, { value: 'bar', label: 'Bars' }, { value: 'week', label: 'Week vs last' }]}
                onChange={(value) => onChange(setIn(config, ['chart'], value === 'line' ? undefined : value))}
                hint={chart === 'week' ? 'Each day of this week next to the same day last week.' : chart === 'bar' ? 'Per hour up to two days, per day beyond. Meters show what they used, other sensors their average.' : undefined}
            />
            {chart !== 'week' && (
                <>
                    <ToggleField
                        label="Time range selector"
                        checked={selector}
                        onChange={(on) => onChange(setIn(setIn(config, ['ranges'], on ? undefined : false), ['range'], on ? undefined : config.range))}
                    />
                    {selector ? (
                        <TextField
                            label="Time ranges"
                            value={Array.isArray(config.ranges) ? config.ranges.join(', ') : undefined}
                            placeholder={DEFAULT_RANGES.join(', ')}
                            onChange={(v) => onChange(setIn(config, ['ranges'], v ? v.split(',').map(r => r.trim()).filter(Boolean) : undefined))}
                            hint="Hours, days or weeks, e.g. 6h, 24h, 7d, 4w. The first is shown when the card loads."
                        />
                    ) : (
                        <TextField
                            label="Time range"
                            value={config.range}
                            placeholder="24h"
                            onChange={(v) => onChange(setIn(config, ['range'], v))}
                        />
                    )}
                </>
            )}
            {chart === 'week' && (
                <ToggleField
                    label="Day breakdown"
                    checked={config.breakdown !== false}
                    onChange={(on) => onChange(setIn(config, ['breakdown'], on ? undefined : false))}
                    hint="The list beside the chart with each sensor's share of the selected day. Two and three wide, with stacked sensors."
                />
            )}
            {chart !== 'line' && (
                <SegmentedField
                    label="Stack sensors"
                    value={stack}
                    options={[{ value: 'auto', label: 'Auto' }, { value: true, label: 'On' }, { value: false, label: 'Off' }]}
                    onChange={(value) => onChange(setIn(config, ['stack'], value === 'auto' ? undefined : value))}
                    hint="Auto stacks energy, gas and water meters with the same unit."
                />
            )}
        </>
    );
};

export default GraphEditor;
