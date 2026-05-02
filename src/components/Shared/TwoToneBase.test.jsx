import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
});
