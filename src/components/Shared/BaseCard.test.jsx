import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BaseCard from './BaseCard';
import React from 'react';

describe('BaseCard Shared Component', () => {
    it('renders children with no title natively', () => {
        render(
            <BaseCard>
                <div data-testid="base-child">Content</div>
            </BaseCard>
        );
        expect(screen.getByTestId('base-child')).toBeInTheDocument();
        expect(document.querySelector('.card-header')).toBeNull();
    });

    it('renders a title when provided', () => {
        render(
            <BaseCard title="Test Title">
                <div>Content</div>
            </BaseCard>
        );
        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(document.querySelector('.card-header')).toBeInTheDocument();
    });

    it('applies the hoverable class securely when requested', () => {
        const { container } = render(
            <BaseCard hoverable={true}>
                <div>Content</div>
            </BaseCard>
        );
        expect(container.firstChild.classList.contains('hoverable')).toBe(true);
    });
});
