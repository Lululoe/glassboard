import { Group, TextField, setIn } from '@glassboard/sdk';

/**
 * The Settings tab of the card editor for a Hello card.
 * @param {Object} props
 * @param {Object} props.config - The card's settings.
 * @param {(config: Object) => void} props.onChange - Receives the changed settings.
 * @returns {JSX.Element} The form.
 */
const HelloEditor = ({ config, onChange }) => (
    <Group title="Greeting">
        <TextField label="Title" value={config.title} placeholder="Hello" onChange={v => onChange(setIn(config, ['title'], v))} />
        <TextField label="Name" value={config.name} placeholder="there" hint="Who the card greets." onChange={v => onChange(setIn(config, ['name'], v))} />
    </Group>
);

export default HelloEditor;
