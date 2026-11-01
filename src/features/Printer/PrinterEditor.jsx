import { ListField, TextField } from '../../components/Editor/EditorFields';
import { setIn } from '../../components/Editor/setIn';

const entries = (list) => (Array.isArray(list) ? list : []).map(e => (typeof e === 'string' ? { entity_id: e } : e));

/**
 * Settings form for the 3D printer card.
 * @param {Object} props
 * @param {Object} props.config - The card config being edited.
 * @param {(config: Object) => void} props.onChange - Receives the updated config.
 * @returns {JSX.Element} The form.
 */
const PrinterEditor = ({ config, onChange }) => {
    const set = (key) => (value) => onChange(setIn(config, [key], value));
    return (
        <>
            <TextField
                label="Printer"
                value={config.printer}
                onChange={set('printer')}
                placeholder="p2s"
                hint="The start of its entity ids: p2s for sensor.p2s_print_status."
            />
            <TextField label="Name" value={config.name} onChange={set('name')} placeholder="From Home Assistant" />
            <TextField
                label="AMS"
                value={config.ams}
                onChange={set('ams')}
                placeholder="ams"
                hint="The start of its entity ids: ams for sensor.ams_tray_1."
            />
            <ListField
                label="Spools"
                items={entries(config.trays)}
                onChange={set('trays')}
                columns={[{ key: 'entity_id', label: 'Tray', placeholder: 'sensor.ams_2_tray_1' }]}
                addLabel="Add spool"
                hint="Optional, for example with several AMS units. Without any, the AMS's four trays and a loaded external spool show."
            />
        </>
    );
};

export default PrinterEditor;
