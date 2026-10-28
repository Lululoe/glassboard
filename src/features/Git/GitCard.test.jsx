import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GitCard from './GitCard';
import React from 'react';

// Mock the hook
vi.mock('./useGit', () => ({
    useGit: () => ({
        prs: [
            {
                id: 1,
                title: 'Test PR 1',
                repo: 'owner/repo',
                number: 123,
                state: 'open',
                author: 'tester',
                updatedAt: '1h ago',
                url: 'http://github.com/owner/repo/pull/123',
                checks: { status: 'success', passing: 1, total: 1 }
            },
            {
                id: 2,
                title: 'Test PR 2',
                repo: 'owner/other',
                number: 456,
                state: 'merged',
                author: 'dev',
                updatedAt: '2h ago',
                url: 'http://github.com/owner/other/pull/456'
            }
        ],
        stats: {
            count: 2,
            open: 1
        },
        loading: false,
        error: null
    })
}));

describe('GitCard', () => {
    it('renders PR items correctly', () => {
        render(<GitCard config={{ colSpan: 1 }} />);

        expect(screen.getByText('Test PR 1')).toBeInTheDocument();
        expect(screen.getByText('owner/repo #123')).toBeInTheDocument();
        expect(screen.getByText('open')).toBeInTheDocument();

        expect(screen.getByText('Test PR 2')).toBeInTheDocument();
        expect(screen.getByText('merged')).toBeInTheDocument();
    });

    it('links each PR to its url in a new tab', () => {
        render(<GitCard config={{ colSpan: 1 }} />);

        const prItem = screen.getByText('Test PR 1').closest('a');
        expect(prItem).toHaveClass('pr-item');
        expect(prItem).toHaveAttribute('href', 'http://github.com/owner/repo/pull/123');
        expect(prItem).toHaveAttribute('target', '_blank');
    });
});
