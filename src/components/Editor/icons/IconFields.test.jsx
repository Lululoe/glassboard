import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { IconBackgroundsContext } from '../../../context/iconBackgrounds';
import BackgroundField from './BackgroundField';
import IconColorField from './IconColorField';
import IconPicker from './IconPicker';

afterEach(() => vi.unstubAllGlobals());

const selfhstIndex = [
    { Name: 'Plex', Reference: 'plex', SVG: 'Yes', Light: 'Yes', Tags: 'Streaming' },
    { Name: 'Ampache', Reference: 'ampache', SVG: 'Yes', Light: 'No', Tags: '' },
];

/** Answers the catalog requests the picker makes. */
const stubCatalogs = () => vi.stubGlobal('fetch', vi.fn(async (url) => {
    const body = String(url).endsWith('index.json') ? selfhstIndex : { names: ['robot-vacuum', 'fan'] };
    return { ok: true, json: async () => body };
}));

describe('IconPicker', () => {
    it('searches Lucide and reports the pick', async () => {
        const onChange = vi.fn();
        render(<IconPicker value="lu-Clock" onChange={onChange} />);
        expect(await screen.findByRole('button', { name: 'Clock' })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.change(screen.getByLabelText('Search Lucide icons'), { target: { value: 'zap-off' } });
        fireEvent.click(screen.getByRole('button', { name: 'ZapOff' }));
        expect(onChange).toHaveBeenCalledWith('lu-ZapOff');
        expect(screen.getByText('1 icon')).toBeInTheDocument();
    });

    it('offers selfh.st icons in full color and monochrome', async () => {
        stubCatalogs();
        const Harness = () => {
            const [value, setValue] = useState('sh-plex');
            return <><IconPicker value={value} onChange={setValue} /><output>{value}</output></>;
        };
        render(<Harness />);

        expect(await screen.findByRole('button', { name: 'Ampache' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('radio', { name: 'Monochrome' }));
        expect(screen.getByText('sh-plex-light')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Ampache' })).not.toBeInTheDocument();
        expect(screen.getByText('1 icon')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('radio', { name: 'Full color' }));
        expect(screen.getByText('sh-plex')).toBeInTheDocument();
    });

    it('searches Material names from the server', async () => {
        stubCatalogs();
        const onChange = vi.fn();
        render(<IconPicker value="mdi:fan" onChange={onChange} />);
        fireEvent.click(await screen.findByRole('button', { name: 'robot-vacuum' }));
        expect(onChange).toHaveBeenCalledWith('mdi:robot-vacuum');
    });

    it('takes an image address', () => {
        const onChange = vi.fn();
        render(<IconPicker value="https://x/y.svg" onChange={onChange} />);
        fireEvent.change(screen.getByLabelText('Image URL'), { target: { value: 'https://x/z.svg' } });
        expect(onChange).toHaveBeenCalledWith('https://x/z.svg');
    });
});

describe('IconColorField', () => {
    it('picks presets and custom colors', () => {
        const onChange = vi.fn();
        render(<IconColorField iconRef="lu-Clock" value="#ffffff" onChange={onChange} />);
        expect(screen.getByRole('button', { name: 'White icon color' })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByRole('button', { name: 'Default icon color' }));
        expect(onChange).toHaveBeenLastCalledWith(undefined);

        fireEvent.change(screen.getByLabelText('Custom icon color as hex'), { target: { value: '#ff9' } });
        expect(onChange).toHaveBeenCalledTimes(1);
        fireEvent.change(screen.getByLabelText('Custom icon color as hex'), { target: { value: '#FF9F0A' } });
        expect(onChange).toHaveBeenLastCalledWith('#ff9f0a');
    });

    it('points full-color icons to monochrome and hides for PNGs', () => {
        const { rerender, container } = render(<IconColorField iconRef="sh-plex" onChange={() => {}} />);
        expect(screen.getByText(/Switch to Monochrome/)).toBeInTheDocument();
        rerender(<IconColorField iconRef="https://x/y.png" onChange={() => {}} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows a monochrome icon that follows the text as Default', () => {
        render(<IconColorField iconRef="sh-plex-light" value="currentColor" onChange={() => {}} />);
        expect(screen.getByRole('button', { name: 'Default icon color' })).toHaveAttribute('aria-pressed', 'true');
    });
});

describe('BackgroundField', () => {
    /** Renders the field with working presets. */
    const Harness = ({ initial, onValue, onPresets }) => {
        const [value, setValue] = useState(initial);
        const [presets, setPresets] = useState([]);
        return (
            <IconBackgroundsContext value={{ presets, onChange: (next) => { setPresets(next); onPresets(next); } }}>
                <BackgroundField value={value} onChange={(next) => { setValue(next); onValue(next); }} />
            </IconBackgroundsContext>
        );
    };

    it('applies the built-in presets and Default', () => {
        const onValue = vi.fn();
        render(<Harness initial={undefined} onValue={onValue} onPresets={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: 'Blue background' }));
        expect(onValue).toHaveBeenLastCalledWith('#0a84ff');
        fireEvent.click(screen.getByRole('button', { name: 'Default background' }));
        expect(onValue).toHaveBeenLastCalledWith(undefined);
    });

    it('adds a preset from the current background and edits it', () => {
        const onValue = vi.fn();
        const onPresets = vi.fn();
        render(<Harness initial="linear-gradient(90deg, #111111, #222222)" onValue={onValue} onPresets={onPresets} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add a background' }));
        expect(onPresets).toHaveBeenLastCalledWith(['linear-gradient(90deg, #111111, #222222)']);

        fireEvent.change(screen.getByLabelText('Direction'), { target: { value: '45' } });
        expect(onValue).toHaveBeenLastCalledWith('linear-gradient(45deg, #111111, #222222)');

        fireEvent.click(screen.getByRole('button', { name: 'Add color' }));
        fireEvent.change(screen.getByLabelText('Color 3 as hex'), { target: { value: '#ff0000' } });
        expect(onValue).toHaveBeenLastCalledWith('linear-gradient(45deg, #111111, #222222, #ff0000)');
        expect(onPresets).toHaveBeenLastCalledWith(['linear-gradient(45deg, #111111, #222222, #ff0000)']);

        fireEvent.click(screen.getByRole('radio', { name: 'None' }));
        expect(onValue).toHaveBeenLastCalledWith('transparent');
    });

    it('deletes a preset and resets an icon using it', async () => {
        const onValue = vi.fn();
        const onPresets = vi.fn();
        render(<Harness initial="#112233" onValue={onValue} onPresets={onPresets} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add a background' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete preset' }));
        await waitFor(() => expect(onPresets).toHaveBeenLastCalledWith([]));
        expect(onValue).toHaveBeenLastCalledWith(undefined);
        expect(screen.queryByRole('button', { name: 'My background 1' })).not.toBeInTheDocument();
    });
});
