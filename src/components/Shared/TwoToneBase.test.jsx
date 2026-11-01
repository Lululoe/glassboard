import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TwoToneBase from './TwoToneBase';
import React from 'react';

describe('TwoToneBase Shared Component', () => {
    it('renders the header and content distinctively', () => {
        render(
            <TwoToneBase title="Test Title" subtitle="Status: OK">
                <div data-testid="twotone-child">Child Block</div>
            </TwoToneBase>
        );
        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Status: OK')).toBeInTheDocument();
        expect(screen.getByTestId('twotone-child')).toBeInTheDocument();
    });

    it('accepts custom action elements', () => {
        const actionButton = <button data-testid="action-btn">Action</button>;
        render(
            <TwoToneBase title="Action Test" actions={actionButton}>
                <div>Content</div>
            </TwoToneBase>
        );
        expect(screen.getByTestId('action-btn')).toBeInTheDocument();
    });

    it('shows the scroll shade outside the content, only when it can scroll further', () => {
        const observe = vi.fn();
        vi.stubGlobal('ResizeObserver', class { observe = observe; disconnect() {} });
        const height = (value) => ({ configurable: true, get: () => value });
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', height(500));
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', height(200));

        const { container, rerender } = render(<TwoToneBase title="List">Rows</TwoToneBase>);
        const shade = container.querySelector('.two-tone-more');
        expect(shade).toBeInTheDocument();
        expect(shade.parentElement).toHaveClass('two-tone-card');

        rerender(<TwoToneBase key="fixed" title="Fixed" className="fixed">Rows</TwoToneBase>);
        const content = container.querySelector('.two-tone-content');
        content.style.overflowY = 'hidden';
        act(() => content.dispatchEvent(new Event('scroll')));
        expect(container.querySelector('.two-tone-more')).toBeNull();

        delete HTMLElement.prototype.scrollHeight;
        delete HTMLElement.prototype.clientHeight;
        vi.unstubAllGlobals();
    });
});
