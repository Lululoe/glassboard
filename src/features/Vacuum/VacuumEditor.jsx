import { ListField, TextField, ToggleField } from '../../components/Editor/EditorFields';
import { setIn } from '../../components/Editor/setIn';
import { MAX_ROBOTS } from './vacuumModel';

const entries = (list) => (Array.isArray(list) ? list : []).map(e => (typeof e === 'string' ? { entity_id: e } : e));

/**
 * The settings of one robot, for the single robot card.
 * @param {Object} props
 * @param {Object} props.config - The card config being edited.
 * @param {(config: Object) => void} props.onChange - Receives the updated config.
 * @returns {JSX.Element} The form.
 */
export const VacuumEditor = ({ config, onChange }) => {
    const set = (key) => (value) => onChange(setIn(config, [key], value));
    return (
        <>
            <TextField label="Vacuum entity" value={config.entity_id} onChange={set('entity_id')} placeholder="vacuum.robo" />
            <TextField label="Name" value={config.name} onChange={set('name')} placeholder="From Home Assistant" />
            <ToggleField
                label="Show the map"
                checked={Boolean(config.show_map)}
                onChange={(on) => set('show_map')(on ? true : undefined)}
                hint="This and the next two show beside the controls on two and three wide cards, if the robot has them. With more than fit, a switch or stacking makes room. They're always in the robot's details."
            />
            <ToggleField label="Show all stats" checked={Boolean(config.show_stats)} onChange={(on) => set('show_stats')(on ? true : undefined)} />
            <ToggleField label="Show consumables" checked={Boolean(config.show_consumables)} onChange={(on) => set('show_consumables')(on ? true : undefined)} />
            <TextField label="Battery" value={config.battery} onChange={set('battery')} placeholder="sensor.robo_battery" hint="Shown while the robot has no progress to show." />
            <TextField label="Progress" value={config.progress} onChange={set('progress')} placeholder="sensor.robo_progress" hint="A percentage. Without one, the bar shows the battery." />
            <TextField label="Mop wetness" value={config.wetness} onChange={set('wetness')} placeholder="select.robo_water" hint="A select entity. Without one, the wetness control is hidden." />
            <TextField label="Map" value={config.map} onChange={set('map')} placeholder="camera.robo_map_data" hint="A camera entity. Valetudo's map data camera is drawn as a minimal map." />
            <TextField label="Camera" value={config.camera} onChange={set('camera')} placeholder="camera.robo" />
            <ListField
                label="Stats"
                items={entries(config.stats)}
                onChange={set('stats')}
                columns={[
                    { key: 'entity_id', label: 'Entity', placeholder: 'sensor.robo_area' },
                    { key: 'attribute', label: 'Attribute', placeholder: 'Optional attribute' },
                    { key: 'name', label: 'Name', placeholder: 'From Home Assistant' },
                ]}
                addLabel="Add stat"
                hint="The first three show on the card, and all of them in the robot's details."
            />
            <ListField
                label="Rooms"
                items={Array.isArray(config.rooms) ? config.rooms : []}
                onChange={set('rooms')}
                columns={[
                    { key: 'area', label: 'Area', placeholder: 'Home Assistant area id, e.g. kitchen' },
                    { key: 'name', label: 'Name', placeholder: 'e.g. Kitchen' },
                    { key: 'segment', label: 'Map segment', placeholder: 'Optional, else matched by name' },
                ]}
                addLabel="Add room"
                hint="Rooms are cleaned with vacuum.clean_area. With fewer than two rooms the section is hidden."
            />
            <ListField
                label="Consumables"
                items={entries(config.consumables)}
                onChange={set('consumables')}
                columns={[
                    { key: 'entity_id', label: 'Remaining', placeholder: 'sensor.robo_main_brush' },
                    { key: 'name', label: 'Name', placeholder: 'e.g. Main brush' },
                    { key: 'percent', label: 'Percentage', placeholder: 'Optional sensor with % left' },
                    { key: 'reset', label: 'Reset button', placeholder: 'Optional button.robo_reset_brush' },
                ]}
                addLabel="Add consumable"
                hint="Without a percentage, the bar is green as long as the sensor isn't zero."
            />
        </>
    );
};

/**
 * Settings form for the multi-robot card. A robot's other settings go in the YAML view.
 * @param {Object} props
 * @param {Object} props.config - The card config being edited.
 * @param {(config: Object) => void} props.onChange - Receives the updated config.
 * @returns {JSX.Element} The form.
 */
export const VacuumsEditor = ({ config, onChange }) => (
    <>
        <TextField label="Title" value={config.title} onChange={(v) => onChange(setIn(config, ['title'], v))} placeholder="Robots" />
        <ListField
            label="Robots"
            items={entries(config.robots)}
            onChange={(items) => onChange(setIn(config, ['robots'], items))}
            columns={[
                { key: 'entity_id', label: 'Vacuum entity', placeholder: 'vacuum.robo' },
                { key: 'name', label: 'Name', placeholder: 'From Home Assistant' },
            ]}
            addLabel="Add robot"
            hint={`Up to ${MAX_ROBOTS} robots. Stats, rooms, consumables, map and camera work as on the single robot card; set them per robot in the YAML view.`}
        />
    </>
);
