import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePageHeader } from '../../../shared/pageHeader';
import { callService } from '../../lib/api';
import PageHeader from './PageHeader';

vi.mock('../../lib/api', () => ({ callService: vi.fn() }));

const headerFor = (pageHeader) => resolvePageHeader({ pageHeader }, { id: 'home' });

describe('PageHeader', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 10, 10, 9, 5, 7));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('shows the time under the date by default', () => {
        render(<PageHeader header={headerFor(true)} pageKey="home" />);
        expect(screen.getByText('09:05')).toHaveClass('ph-title', 'ph-type-clock');
        expect(screen.getByText(/10/).tagName).toBe('TIME');
    });

    it('uses the configured formats, locale, texts and colors', () => {
        render(<PageHeader
            header={headerFor({
                locale: 'en-GB',
                title: { type: 'text', text: 'Welcome home', color: 'teal' },
                subtitle: { type: 'date', format: 'D MMMM YYYY', color: '#abcdef' },
            })}
            pageKey="home"
        />);
        expect(screen.getByText('Welcome home')).toHaveStyle({ color: 'var(--system-teal)' });
        expect(screen.getByText('10 November 2026')).toHaveStyle({ color: '#abcdef' });
    });

    it('greets by the time of day and can leave out the upper line', () => {
        const { container } = render(<PageHeader header={headerFor({ title: { type: 'greeting' }, subtitle: false })} pageKey="home" />);
        expect(screen.getByText('Good morning')).toBeInTheDocument();
        expect(container.querySelector('.ph-subtitle')).toBeNull();
    });

    it('draws a monochrome header in the text color, ignoring line colors', () => {
        const { container } = render(<PageHeader header={headerFor({ style: 'monochrome', title: { type: 'text', text: 'Hi', color: 'red' } })} pageKey="home" />);
        expect(container.querySelector('.page-header')).toHaveClass('ph-style-monochrome');
        expect(screen.getByText('Hi').getAttribute('style')).toBeNull();
        expect(container.querySelector('linearGradient')).toBeNull();
    });

    it('sets classes for the alignment and the stacked layout', () => {
        const { container } = render(<PageHeader header={headerFor({ align: 'right', layout: 'stacked' })} pageKey="home" />);
        expect(container.querySelector('.page-header')).toHaveClass('ph-align-right', 'is-stacked');
    });

    it('asks the server to render a template line by page and line, never sending the template', async () => {
        callService.mockResolvedValue({ text: '21.5 °C inside' });
        render(<PageHeader
            header={headerFor({ title: { type: 'template', template: "{{ states('sensor.x') }}" } })}
            pageKey="home"
        />);
        expect(screen.getByText('…')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText('21.5 °C inside')).toBeInTheDocument());
        expect(callService).toHaveBeenCalledWith('homeassistant', { endpoint: 'template', page: 'home', line: 'title' });
    });

    it('shows template output as text, not HTML', async () => {
        callService.mockResolvedValue({ text: '<img src=x onerror=alert(1)>' });
        const { container } = render(<PageHeader header={headerFor({ title: { type: 'template', template: 'x' } })} pageKey="home" />);
        await waitFor(() => expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument());
        expect(container.querySelector('img')).toBeNull();
    });

    it("opens each part's own editor in edit mode, and keeps a place for hidden lines", () => {
        const onEdit = vi.fn();
        render(<PageHeader header={headerFor({ subtitle: false })} pageKey="home" onEdit={onEdit} />);
        fireEvent.click(screen.getByRole('button', { name: 'Edit title' }));
        fireEvent.click(screen.getByRole('button', { name: 'Subtitle' }));
        fireEvent.click(screen.getByRole('button', { name: 'Edit header' }));
        expect(onEdit.mock.calls.map(([part]) => part)).toEqual(['title', 'subtitle', 'layout']);
    });

    it('shows the last text of a template on the next page instead of loading again', async () => {
        callService.mockResolvedValueOnce({ text: '12 °C' });
        const header = headerFor({ title: { type: 'template', template: '{{ cached }}' } });
        const { unmount } = render(<PageHeader header={header} pageKey="home" />);
        await waitFor(() => expect(screen.getByText('12 °C')).toBeInTheDocument());
        unmount();
        callService.mockReturnValue(new Promise(() => {}));
        render(<PageHeader header={header} pageKey="other" entering={false} />);
        expect(screen.getByText('12 °C')).toBeInTheDocument();
        expect(document.querySelector('.page-header')).not.toHaveClass('is-entering');
    });
});

