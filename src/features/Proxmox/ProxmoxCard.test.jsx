import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProxmoxCard from './ProxmoxCard';
import React from 'react';

// Mock the hook
vi.mock('./useProxmox', () => ({
    default: () => ({
        nodes: [
            { id: 101, name: 'Zeus', type: 'vm', status: 'running', cpu: 0, ram: 0, disk: 0 },
            { id: 100, name: 'Apollo', type: 'vm', status: 'running', cpu: 0, ram: 0, disk: 0 }
        ],
        summary: {
            running: 2,
            total: 2,
            cpuAvg: 0
        }
    })
}));

describe('ProxmoxCard', () => {
    it('renders and sorts nodes', () => {
        render(<ProxmoxCard config={{ colSpan: 1 }} />);

        // Initial: default ID Asc (100, 101)
        // We can check order by checking all items
        let items = screen.getAllByText(/\(10\d\)/);
        expect(items[0]).toHaveTextContent('(100)');
        expect(items[1]).toHaveTextContent('(101)');

        // Find Sort Button (title="Change Sort Order")
        const sortBtn = screen.getByTitle('Change Sort Order');
        expect(sortBtn).toBeInTheDocument();

        // Click -> ID Desc (101, 100)
        fireEvent.click(sortBtn);
        items = screen.getAllByText(/\(10\d\)/);
        expect(items[0]).toHaveTextContent('(101)');
        expect(items[1]).toHaveTextContent('(100)');

        // Click -> Name Asc (Apollo, Zeus) -> (100, 101)
        fireEvent.click(sortBtn);
        items = screen.getAllByText(/\(10\d\)/);
        expect(items[0]).toHaveTextContent('(100)'); // Apollo
        expect(items[1]).toHaveTextContent('(101)'); // Zeus

        // Click -> Name Desc (Zeus, Apollo) -> (101, 100)
        fireEvent.click(sortBtn);
        items = screen.getAllByText(/\(10\d\)/);
        expect(items[0]).toHaveTextContent('(101)'); // Zeus
        expect(items[1]).toHaveTextContent('(100)'); // Apollo
    });
});
