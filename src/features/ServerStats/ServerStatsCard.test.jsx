import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ServerStatsCard from './ServerStatsCard';
import React from 'react';

// Mock the hook
vi.mock('./useServerStats', () => ({
    default: () => ({
        info: { hostname: 'Test Host', ip: '1.2.3.4' },
        cpu: 50,
        ram: { used: 8, total: 16 },
        storage: { used: 100, free: 400, total: 500 },
        network: { in: 1024 * 1024, out: 2 * 1024 * 1024 },
        temp: [40, 42]
    })
}));

describe('ServerStatsCard', () => {
    it('renders all tiles by default', () => {
        const config = { colSpan: 2 };
        render(<ServerStatsCard config={config} />);

        expect(screen.getByText('Test Host')).toBeInTheDocument();
        expect(screen.getByText('1.2.3.4')).toBeInTheDocument();
        expect(screen.getByText('CPU Load')).toBeInTheDocument();
        expect(screen.getByText('RAM Usage')).toBeInTheDocument();
        expect(screen.getByText('Storage')).toBeInTheDocument();
        expect(screen.getByText('Network')).toBeInTheDocument();
        expect(screen.getByText('Temperature')).toBeInTheDocument();
    });

    it('renders only configured sensors', () => {
        const config = {
            colSpan: 2,
            data: {
                sensors: ['cpu', 'network']
            }
        };
        render(<ServerStatsCard config={config} />);

        expect(screen.getByText('CPU Load')).toBeInTheDocument();
        expect(screen.getByText('Network')).toBeInTheDocument();

        // Should NOT be present
        expect(screen.queryByText('RAM Usage')).not.toBeInTheDocument();
        expect(screen.queryByText('Storage')).not.toBeInTheDocument();
        expect(screen.queryByText('Temperature')).not.toBeInTheDocument();
    });

    it('renders data correctly', () => {
        const config = { colSpan: 2, data: { sensors: ['ram', 'storage'] } };
        render(<ServerStatsCard config={config} />);

        expect(screen.getByText('8 / 16 GB')).toBeInTheDocument();
        // Check for new storage format
        expect(screen.getByText('100GB Used / 400GB Free')).toBeInTheDocument();
    });
});
