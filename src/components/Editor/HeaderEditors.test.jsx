import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import HeaderLayoutEditor from './HeaderLayoutEditor';
import HeaderLineEditor from './HeaderLineEditor';
import HeaderWidgetEditor from './HeaderWidgetEditor';
import AddWidgetDialog from './AddWidgetDialog';

vi.mock('../../lib/api', () => ({ callService: vi.fn(() => new Promise(() => {})) }));

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
});

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));

describe('HeaderLineEditor', () => {
    it('changes the title of all pages', () => {
        const onSave = vi.fn();
        render(<HeaderLineEditor line="title" pageHeader={true} pageName="Home" pageKey="home" onSave={onSave} onCancel={() => {}} />);
        fireEvent.click(screen.getByRole('radio', { name: 'Greeting' }));
        fireEvent.click(screen.getByRole('radio', { name: 'Teal' }));
        save();
        expect(onSave).toHaveBeenCalledWith({ pageHeader: { title: { type: 'greeting', color: 'teal' } }, pageOwn: undefined });
    });

    it("hides the subtitle on this page only, leaving all pages' as it is", () => {
        const onSave = vi.fn();
        render(<HeaderLineEditor line="subtitle" pageHeader={true} pageName="Home" pageKey="home" onSave={onSave} onCancel={() => {}} />);
        fireEvent.click(screen.getByRole('tab', { name: 'This page: Home' }));
        fireEvent.click(screen.getByRole('radio', { name: 'Own' }));
        fireEvent.click(screen.getByRole('switch', { name: 'Show subtitle' }));
        save();
        expect(onSave).toHaveBeenCalledWith({ pageHeader: true, pageOwn: { subtitle: false } });
    });

    it('writes a custom clock format', () => {
        const onSave = vi.fn();
        render(<HeaderLineEditor line="title" pageHeader={true} pageKey="home" onSave={onSave} onCancel={() => {}} />);
        expect(screen.queryByRole('tab')).toBeNull();
        fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
        fireEvent.change(screen.getByLabelText('Custom format'), { target: { value: 'H [Uhr] mm' } });
        save();
        expect(onSave.mock.calls[0][0].pageHeader.title).toMatchObject({ type: 'clock', format: 'H [Uhr] mm' });
    });

    it('shows a template from config.yaml without letting it be changed', () => {
        render(<HeaderLineEditor
            line="title"
            pageHeader={{ title: { type: 'template', template: "{{ states('sensor.x') }}" } }}
            pageKey="home"
            onSave={() => {}}
            onCancel={() => {}}
        />);
        expect(screen.getByRole('radio', { name: 'Template' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByText("{{ states('sensor.x') }}").tagName).toBe('CODE');
        expect(screen.queryByRole('textbox', { name: /template/i })).toBeNull();
    });

    it("doesn't offer templates for lines config.yaml has none for", () => {
        render(<HeaderLineEditor line="subtitle" pageHeader={true} pageKey="home" onSave={() => {}} onCancel={() => {}} />);
        expect(screen.queryByRole('radio', { name: 'Template' })).toBeNull();
    });
});

describe('HeaderLayoutEditor', () => {
    it('turns the header on and arranges it for all pages', () => {
        const onSave = vi.fn();
        render(<HeaderLayoutEditor pageHeader={undefined} pageKey="home" onSave={onSave} onCancel={() => {}} />);
        expect(screen.getByText('No header')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('switch', { name: 'Show header' }));
        fireEvent.click(screen.getByRole('radio', { name: 'Center' }));
        fireEvent.click(screen.getByRole('radio', { name: 'Stacked' }));
        save();
        expect(onSave).toHaveBeenCalledWith({ pageHeader: { align: 'center', layout: 'stacked' }, pageOwn: undefined });
    });

    it('turns the header off on this page only', () => {
        const onSave = vi.fn();
        render(<HeaderLayoutEditor pageHeader={true} pageName="Home" pageKey="home" onSave={onSave} onCancel={() => {}} />);
        fireEvent.click(screen.getByRole('tab', { name: 'This page: Home' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('switch', { name: 'Show header' }));
        save();
        expect(onSave).toHaveBeenCalledWith({ pageHeader: true, pageOwn: false });
    });

    it('gives this page its own arrangement', () => {
        const onSave = vi.fn();
        render(<HeaderLayoutEditor pageHeader={{ align: 'center' }} pageName="Home" pageKey="home" onSave={onSave} onCancel={() => {}} />);
        fireEvent.click(screen.getByRole('tab', { name: 'This page: Home' }));
        fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Use' })).getByRole('radio', { name: 'Own' }));
        fireEvent.click(screen.getByRole('radio', { name: 'Right' }));
        save();
        expect(onSave).toHaveBeenCalledWith({ pageHeader: { align: 'center' }, pageOwn: { align: 'right', layout: 'auto', style: 'colored' } });
    });

    it('switches the header to monochrome, which leaves line colors out of the line editors', () => {
        const onSave = vi.fn();
        render(<HeaderLayoutEditor pageHeader={true} pageKey="home" onSave={onSave} onCancel={() => {}} />);
        fireEvent.click(screen.getByRole('radio', { name: 'Monochrome' }));
        save();
        expect(onSave).toHaveBeenCalledWith({ pageHeader: { style: 'monochrome' }, pageOwn: undefined });

        render(<HeaderLineEditor line="title" pageHeader={{ style: 'monochrome' }} pageKey="home" onSave={() => {}} onCancel={() => {}} />);
        expect(screen.queryByRole('radiogroup', { name: 'Color' })).toBeNull();
        expect(screen.getByText(/The header is monochrome/)).toBeInTheDocument();
    });
});

describe('HeaderWidgetEditor', () => {
    const editor = (props) => render(<HeaderWidgetEditor pageHeader={true} pageKey="home" onSave={() => {}} onCancel={() => {}} index={null} {...props} />);

    it('adds a widget once it has an entity', () => {
        const onSave = vi.fn();
        editor({ onSave });
        expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
        fireEvent.click(screen.getByRole('radio', { name: 'Open Circle' }));
        fireEvent.change(screen.getByLabelText('Entity'), { target: { value: 'sensor.Outside' } });
        fireEvent.change(screen.getByLabelText('Lowest'), { target: { value: '-10' } });
        fireEvent.change(screen.getByLabelText('Highest'), { target: { value: '35' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        const { pageHeader } = onSave.mock.calls[0][0];
        expect(pageHeader.widgets).toEqual([
            expect.objectContaining({ type: 'gauge', entity_id: 'sensor.outside', min: -10, max: 35, color: 'text' }),
        ]);
    });

    it('saves a condition and changes an existing widget in its list', () => {
        const onSave = vi.fn();
        const widgets = [{ id: 'a', type: 'ring', entity_id: 'sensor.a' }, { id: 'b', type: 'number', entity_id: 'sensor.b' }];
        editor({ onSave, index: 1, pageHeader: { widgets } });
        fireEvent.click(screen.getByRole('switch', { name: 'Only show when…' }));
        fireEvent.click(screen.getByRole('radio', { name: 'Below' }));
        fireEvent.change(screen.getByLabelText('Number'), { target: { value: '5' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onSave.mock.calls[0][0].pageHeader.widgets[1]).toEqual({
            id: 'b', type: 'number', entity_id: 'sensor.b', color: 'text', condition: { operator: 'below', value: 5 },
        });
    });

    it("edits a page's own widgets and removes them there", () => {
        const onSave = vi.fn();
        editor({ onSave, index: 0, hasPage: true, pageHeader: { widgets: [{ id: 'g', entity_id: 'sensor.g' }] }, pageOwn: { widgets: [{ id: 'p', entity_id: 'sensor.p' }] } });
        expect(screen.getByText('Shown on this page only.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Remove widget' }));
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
        expect(onSave).toHaveBeenCalledWith({ pageHeader: { widgets: [{ id: 'g', entity_id: 'sensor.g' }] }, pageOwn: { widgets: [] } });
    });
});

describe('AddWidgetDialog', () => {
    it('lists the widget kinds like the card list, and picks one', () => {
        const onPick = vi.fn();
        render(<AddWidgetDialog onPick={onPick} onCancel={() => {}} />);
        expect(screen.getByRole('heading', { name: 'Add Widget' })).toBeInTheDocument();
        expect(screen.getAllByRole('button').map(b => b.querySelector('.add-card-name')?.textContent).filter(Boolean))
            .toEqual(['Circle', 'Open Circle', 'Number', 'Rectangle']);
        fireEvent.click(screen.getByRole('button', { name: /Open Circle/ }));
        expect(onPick).toHaveBeenCalledWith('gauge');
    });

    it('opens the new widget in the picked kind', () => {
        render(<HeaderWidgetEditor index={null} initialType="rectangle" pageHeader={true} pageKey="home" onSave={() => {}} onCancel={() => {}} />);
        expect(screen.getByRole('radio', { name: 'Rectangle' })).toHaveAttribute('aria-checked', 'true');
    });
});
