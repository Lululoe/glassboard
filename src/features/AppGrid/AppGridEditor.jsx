import { ListField, NumberField, SegmentedField, ToggleField } from '../../components/Editor/EditorFields';
import { setIn } from '../../components/Editor/setIn';

/**
 * Settings form for the app grid card.
 * @param {Object} props
 * @param {Object} props.config - The card config being edited.
 * @param {(config: Object) => void} props.onChange - Receives the updated config.
 * @returns {JSX.Element} The form.
 */
const AppGridEditor = ({ config, onChange }) => {
    const set = (key) => (value) => onChange(setIn(config, [key], value));
    return (
        <>
            <SegmentedField
                label="Icon size"
                value={config.size || 'medium'}
                options={[{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]}
                onChange={(value) => onChange(setIn(config, ['size'], value === 'medium' ? undefined : value))}
            />
            <ToggleField
                label="Show names"
                checked={config.showLabels !== false}
                onChange={(on) => onChange(setIn(config, ['showLabels'], on ? undefined : false))}
            />
            <ToggleField
                label="Check if apps are online"
                checked={config.statusCheck !== false}
                onChange={(on) => onChange(setIn(config, ['statusCheck'], on ? undefined : false))}
            />
            <div className="editor-row">
                <NumberField label="Columns" value={config.columns} onChange={set('columns')} placeholder="Auto" min={1} step={1} />
                <NumberField label="Max apps" value={config.maxApps} onChange={set('maxApps')} placeholder="All" min={1} step={1} />
            </div>
            <ListField
                label="Apps"
                items={config.data?.apps || []}
                onChange={(apps) => onChange(setIn(config, ['data', 'apps'], apps))}
                columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'url', label: 'URL', placeholder: 'https://' },
                    { key: 'icon', label: 'Icon', placeholder: 'Icon name or image URL' },
                ]}
                addLabel="Add app"
                hint="Leave empty to show the apps from the header launcher."
            />
        </>
    );
};

export default AppGridEditor;
