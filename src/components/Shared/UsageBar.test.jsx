import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import UsageBar from './UsageBar';
import { usageLevel } from './usageLevel';

describe('UsageBar', () => {
    it('only warns when usage is high', () => {
        expect(usageLevel(14)).toBe('normal');
        expect(usageLevel(74)).toBe('normal');
        expect(usageLevel(75)).toBe('warn');
        expect(usageLevel(90)).toBe('high');
    });

    it('keeps values in range and names itself', () => {
        render(<UsageBar percent={140} label="Disk" />);
        const bar = screen.getByRole('progressbar', { name: 'Disk' });
        expect(bar).toHaveAttribute('aria-valuenow', '100');
        expect(bar).toHaveClass('high');
    });
});
