import { describe, expect, it } from 'vitest';
import {
    headerFor, isOn, lineForm, lineFromForm, templateOf, withArrangement, withLine, withPageArrangement, withPageLine,
} from './headerSettings';

const arrangement = (patch = {}) => ({ align: 'left', layout: 'auto', locale: '', ...patch });

describe('header settings', () => {
    it('leaves defaults out of the setting of all pages', () => {
        expect(withArrangement(true, arrangement(), true)).toBe(true);
        expect(withArrangement(true, arrangement({ style: 'monochrome' }), true)).toEqual({ style: 'monochrome' });
        expect(withArrangement(undefined, arrangement({ align: 'center', locale: ' de-DE ' }), true)).toEqual({ align: 'center', locale: 'de-DE' });
        expect(withArrangement({ title: 'Hi', align: 'right' }, arrangement(), true)).toEqual({ title: 'Hi' });
    });

    it('turns the header off for all pages without losing its options', () => {
        expect(withArrangement(undefined, arrangement(), false)).toBeUndefined();
        expect(withArrangement({ title: 'Hi' }, arrangement(), false)).toEqual({ title: 'Hi', enabled: false });
        expect(isOn({ enabled: false })).toBe(false);
        expect(isOn(true)).toBe(true);
    });

    it("sets a page's own arrangement, or lets it follow all pages", () => {
        const form = arrangement({ align: 'right' });
        expect(withPageArrangement(undefined, form, { visible: true, ownArrangement: true, globalOn: true }))
            .toEqual({ align: 'right', layout: 'auto', style: 'colored' });
        expect(withPageArrangement({ align: 'right', title: 'Hi' }, form, { visible: true, ownArrangement: false, globalOn: true }))
            .toEqual({ title: 'Hi' });
        expect(withPageArrangement({ align: 'right' }, form, { visible: true, ownArrangement: false, globalOn: true })).toBeUndefined();
        expect(withPageArrangement(undefined, form, { visible: false, ownArrangement: false, globalOn: true })).toBe(false);
    });

    it('shows a header on a page where all pages have none', () => {
        const own = withPageArrangement(undefined, arrangement(), { visible: true, ownArrangement: false, globalOn: false });
        expect(own).toEqual({});
        expect(headerFor({ enabled: false, align: 'center' }, own)?.align).toBe('center');
    });

    it('reads and writes lines', () => {
        const form = lineForm({ type: 'clock', format: 'h:mm A', color: 'blue' }, 'title');
        expect(form).toMatchObject({ show: true, type: 'clock', clockFormat: 'h:mm A', dateFormat: 'dddd, D MMMM', color: 'blue' });
        expect(lineFromForm({ ...form, type: 'date' })).toEqual({ type: 'date', format: 'dddd, D MMMM', color: 'blue' });
        expect(lineFromForm({ ...form, show: false })).toBe(false);
        expect(lineForm(false, 'subtitle').show).toBe(false);
    });

    it('offers a template line only where config.yaml has a template', () => {
        expect(lineForm({ type: 'template', template: '{{ 1 }}' }, 'title').type).toBe('clock');
        expect(lineForm({ type: 'template' }, 'title', '{{ 1 }}').type).toBe('template');
        expect(templateOf('title', { title: { type: 'clock' } }, { title: { template: '{{ 2 }}' } })).toBe('{{ 2 }}');
    });

    it('changes a line for all pages without turning a header that is off on', () => {
        expect(withLine(false, 'title', { type: 'greeting' })).toEqual({ enabled: false, title: { type: 'greeting' } });
        expect(withLine(true, 'subtitle', false)).toEqual({ subtitle: false });
    });

    it("sets a page's own line, or lets it follow all pages again", () => {
        expect(withPageLine(undefined, 'subtitle', false, true)).toEqual({ subtitle: false });
        expect(withPageLine({ subtitle: false }, 'subtitle', undefined, true)).toBeUndefined();
        expect(withPageLine({ subtitle: false }, 'subtitle', undefined, false)).toEqual({});
    });
});
