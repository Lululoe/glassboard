import { useState } from 'react';
import Icon from '../../Shared/Icon';
import { Field } from '../EditorFields';
import { FOLLOW_TEXT, canTakeColor } from './iconModel';

const COLORS = [
    { value: '', name: 'Default' },
    { value: '#ffffff', name: 'White' },
    { value: '#000000', name: 'Black' },
    { value: 'var(--color-primary)', name: 'Theme accent' },
    { value: 'var(--system-green)', name: 'Green' },
    { value: 'var(--system-teal)', name: 'Teal' },
    { value: 'var(--system-orange)', name: 'Orange' },
    { value: 'var(--system-red)', name: 'Red' },
    { value: 'var(--system-purple)', name: 'Purple' },
    { value: 'var(--system-pink)', name: 'Pink' },
];

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * The color of the icon itself. Each swatch shows the icon in that color, plus a custom color.
 * Full-color icons don't take a color, so they get a pointer to the monochrome style instead.
 * @param {Object} props
 * @param {string} props.iconRef - The icon's reference string.
 * @param {string} [props.value] - The stored color.
 * @param {(color: (string|undefined)) => void} props.onChange - Receives the new color.
 * @returns {JSX.Element|null} The field, or null for icons where a color means nothing.
 */
const IconColorField = ({ iconRef, value, onChange }) => {
    const selected = value === FOLLOW_TEXT ? '' : value || '';
    const custom = HEX.test(selected) && !COLORS.some(color => color.value === selected.toLowerCase());
    const [text, setText] = useState(custom ? selected : '');

    if (!canTakeColor(iconRef)) {
        if (!iconRef.startsWith('sh-')) return null;
        return <Field label="Icon color" hint="Full-color icons keep their own colors. Switch to Monochrome to choose one.">{null}</Field>;
    }

    const pick = (color) => {
        setText('');
        onChange(color || undefined);
    };

    const setCustom = (color) => {
        setText(color);
        if (HEX.test(color)) onChange(color.toLowerCase());
    };

    return (
        <Field label="Icon color">
            <div className="icon-swatches">
                {COLORS.map(color => (
                    <button
                        key={color.name}
                        type="button"
                        className="button-reset icon-swatch icon-swatch-glyph"
                        style={{ color: color.value || 'var(--text-primary)' }}
                        aria-pressed={selected === color.value}
                        aria-label={`${color.name} icon color`}
                        title={color.name}
                        onClick={() => pick(color.value)}
                    >
                        <Icon icon={iconRef} size={20} color="currentColor" />
                    </button>
                ))}
            </div>
            <div className="icon-color-row">
                <input
                    type="color"
                    className="icon-color-well"
                    value={HEX.test(text) ? text.toLowerCase() : '#0a84ff'}
                    aria-label="Custom icon color"
                    onChange={(e) => setCustom(e.target.value)}
                />
                <input
                    className="editor-input"
                    value={text}
                    placeholder="Custom, e.g. #ff9f0a"
                    aria-label="Custom icon color as hex"
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(e) => setCustom(e.target.value)}
                />
            </div>
        </Field>
    );
};

export default IconColorField;
