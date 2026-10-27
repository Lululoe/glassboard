import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import AppGridCard from './AppGridCard';

vi.mock('./useAppStatus', () => ({
    useAppStatus: () => [true, false],
}));

const apps = [
    { name: 'Plex', url: 'http://plex.local', icon: 'Play' },
    { name: 'Sonarr', url: 'http://sonarr.local', icon: 'Tv' },
];

describe('AppGridCard', () => {
    it('renders labels and an offline badge', () => {
        const { container } = render(<AppGridCard config={{ id: 'a', data: { apps } }} />);
        expect(screen.getByText('Plex')).toBeInTheDocument();
        expect(screen.getByLabelText('Sonarr (offline)')).toHaveClass('offline');
        expect(container.querySelectorAll('.app-status-badge')).toHaveLength(1);
        expect(container.querySelector('.app-grid-card')).toHaveClass('app-grid-medium');
    });

    it('hides labels and applies the size preset', () => {
        const { container } = render(<AppGridCard config={{ id: 'a', size: 'large', showLabels: false, data: { apps } }} />);
        expect(screen.queryByText('Plex')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Plex')).toBeInTheDocument();
        expect(container.querySelector('.app-grid-card')).toHaveClass('app-grid-large', 'app-grid-no-labels');
    });

    it('falls back to launcher apps and honours maxApps and columns', () => {
        const { container } = render(
            <AppGridCard config={{ id: 'a', maxApps: 1, columns: 3 }} globalConfig={{ launcher: { apps } }} />
        );
        expect(container.querySelectorAll('.app-item')).toHaveLength(1);
        expect(container.querySelector('.app-grid-container').style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
    });
});
