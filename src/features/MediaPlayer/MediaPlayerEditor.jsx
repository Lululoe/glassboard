import { ListField } from '../../components/Editor/EditorFields';
import { setIn } from '../../components/Editor/setIn';

/**
 * Settings form for the media player card: the players to swipe between, and the speakers
 * offered in the speaker menu.
 * @param {Object} props
 * @param {Object} props.config - The card config being edited.
 * @param {(config: Object) => void} props.onChange - Receives the updated config.
 * @returns {JSX.Element} The form.
 */
const MediaPlayerEditor = ({ config, onChange }) => {
    const asItems = (list) => (Array.isArray(list) ? list : []).map(e => (typeof e === 'string' ? { entity_id: e } : e));
    const players = asItems(config.entities ?? (config.entity_id ? [config.entity_id] : []));
    const speakers = asItems(config.speakers);
    // Entries without a name are stored as plain entity ids
    const toList = (items) => items.map(e => (e.name ? e : e.entity_id ?? ''));
    const columns = [
        { key: 'entity_id', label: 'Media player', placeholder: 'media_player.living_room' },
        { key: 'name', label: 'Name', placeholder: 'From Home Assistant' },
    ];

    return (
        <>
            <ListField
                label="Players"
                items={players}
                onChange={(items) => {
                    const { entity_id: _single, ...rest } = config;
                    onChange(setIn(rest, ['entities'], toList(items)));
                }}
                columns={columns}
                addLabel="Add player"
                hint="Swipe between several players on the one-wide and half card; the quarter tile shows the first."
            />
            <ListField
                label="Speakers"
                items={speakers}
                onChange={(items) => onChange(setIn(config, ['speakers'], items.length > 0 ? toList(items) : undefined))}
                columns={columns}
                addLabel="Add speaker"
                hint="Shown in the speaker menu with a volume slider each, and can be grouped with the playing speaker. Leave empty to list the players."
            />
        </>
    );
};

export default MediaPlayerEditor;
