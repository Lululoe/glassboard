import { useEffect, useRef } from 'react';
import { TextField, ToggleField } from '../EditorFields';
import BackgroundField from './BackgroundField';
import IconColorField from './IconColorField';
import IconPicker from './IconPicker';
import { readIcon, storedColor, writeIcon } from './iconModel';

/**
 * Settings of the selected app or header menu link. Lives in the form next to the preview, so
 * it never covers what is being edited. On narrow screens the form is under a preview that
 * scrolls away, so selecting something brings its settings into view.
 * @param {Object} props
 * @param {'App'|'Link'} props.kind - What is selected.
 * @param {Object} props.item - The app or link.
 * @param {(item: Object) => void} props.onChange - Receives the changed item.
 * @param {() => void} props.onRemove - Removes the item.
 * @param {() => void} props.onDone - Clears the selection.
 * @returns {JSX.Element} The settings.
 */
const ItemInspector = ({ kind, item, onChange, onRemove, onDone }) => {
    const sectionRef = useRef(null);
    const { ref, color } = readIcon(item.icon);

    useEffect(() => {
        if (!window.matchMedia?.('(max-width: 768px)').matches) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        sectionRef.current?.scrollIntoView?.({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    }, []);

    const setIcon = (nextRef, nextColor) => onChange({ ...item, icon: writeIcon(nextRef, storedColor(nextRef, nextColor)) });
    const setText = (key) => (value = '') => onChange({ ...item, [key]: value });

    return (
        <section className="icon-inspector" ref={sectionRef} aria-label={`Selected ${kind.toLowerCase()}`}>
            <div className="icon-inspector-head">
                <h3 className="editor-section-title">{kind}</h3>
                <div>
                    <button type="button" className="button-reset editor-dialog-action destructive" onClick={onRemove}>Remove</button>
                    <button type="button" className="button-reset editor-dialog-action" onClick={onDone}>Done</button>
                </div>
            </div>
            <TextField label="Name" value={item.name} placeholder={kind === 'App' ? 'Plex' : 'Hypervisor'} onChange={setText('name')} />
            <TextField
                label="URL"
                value={item.url}
                placeholder="https://"
                hint={item.url ? undefined : `Add a URL so this ${kind.toLowerCase()} opens something.`}
                onChange={setText('url')}
            />
            <IconPicker value={ref} onChange={(next) => setIcon(next, color)} />
            <code className="icon-code">{ref}</code>
            <IconColorField iconRef={ref} value={color} onChange={(next) => setIcon(ref, next)} />
            {kind === 'App' && (
                <>
                    <ToggleField
                        label="Check if online"
                        checked={item.statusCheck !== false}
                        onChange={(on) => {
                            const { statusCheck: _statusCheck, ...rest } = item;
                            onChange(on ? rest : { ...rest, statusCheck: false });
                        }}
                        hint={item.statusCheck === false
                            ? 'This app never gets the offline badge.'
                            : 'Shows a badge on the app when it doesn\'t answer. The card\'s own setting can turn this off for every app.'}
                    />
                    {item.statusCheck !== false && (
                        <TextField
                            label="Check address (optional)"
                            value={item.statusUrl}
                            placeholder={item.url || 'https://'}
                            hint="Checked instead of the URL, e.g. a health endpoint."
                            onChange={(value) => {
                                const { statusUrl: _statusUrl, ...rest } = item;
                                onChange(value ? { ...rest, statusUrl: value } : rest);
                            }}
                        />
                    )}
                </>
            )}
            {kind === 'App' && (
                <BackgroundField
                    value={item.bgColor}
                    onChange={(background) => {
                        const { bgColor: _bgColor, ...rest } = item;
                        onChange(background ? { ...rest, bgColor: background } : rest);
                    }}
                />
            )}
        </section>
    );
};

export default ItemInspector;
