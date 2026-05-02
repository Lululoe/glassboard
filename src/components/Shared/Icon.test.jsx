import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Icon from './Icon';
import * as LucideIcons from 'lucide-react';

// Mock specific icons to avoid importing all of them in test if needed, 
// but for integration test with "lucide-react" we can just check if it renders SVG.
// However, since we import * as LucideIcons in the component, we rely on the real lib.

describe('Icon Component', () => {
    it('renders Lucide icon correctly', () => {
        const { container } = render(<Icon icon="lu-Home" size={24} color="red" />);
        // Lucide icons render as svg
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
        expect(svg).toHaveAttribute('width', '24');
        expect(svg).toHaveAttribute('height', '24');
        expect(svg).toHaveAttribute('stroke', 'red');
    });

    it('renders Selfh.st SVG icon correctly', () => {
        render(<Icon icon="sh-github" size={40} />);
        const img = screen.getByRole('img');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'https://cdn.jsdelivr.net/gh/selfhst/icons@main/svg/github.svg');
        expect(img).toHaveStyle({ width: '40px', height: '40px' });
    });

    it('renders Selfh.st SVG icon with color (masked)', () => {
        render(<Icon icon="sh-github" size={40} color="blue" />);
        // When colored, it renders a div with mask
        const div = screen.getByRole('img');

        // JSDOM might not support mask-image in computed styles well, so we check inline style or background color
        // expect(div).toHaveStyle({ backgroundColor: 'blue' });

        // Check if style attribute contains what we expect
        const style = div.getAttribute('style');
        expect(style).toContain('background-color: blue');
        expect(style).toContain('mask-image: url(https://cdn.jsdelivr.net/gh/selfhst/icons@main/svg/github.svg)');

        // Check if mask-image is in the style attribute string (since it's inline)
        expect(div.style.maskImage).toContain('url(https://cdn.jsdelivr.net/gh/selfhst/icons@main/svg/github.svg)');
    });

    it('renders Selfh.st PNG icon correctly', () => {
        render(<Icon icon="sh-plex-png" size={50} />);
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'https://cdn.jsdelivr.net/gh/selfhst/icons@main/png/plex.png');
        expect(img).toHaveStyle({ width: '50px', height: '50px' });
    });

    it('renders local SVG icon correctly', () => {
        render(<Icon icon="local-custom-app" size={40} />);
        const img = screen.getByRole('img');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', '/icons/custom-app.svg');
        expect(img).toHaveStyle({ width: '40px', height: '40px' });
    });

    it('renders local PNG icon correctly', () => {
        render(<Icon icon="local-custom-app-png" size={40} />);
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', '/icons/custom-app.png');
    });

    it('does not apply color/mask to PNG icon', () => {
        render(<Icon icon="sh-plex-png" size={50} color="red" />);
        const img = screen.getByRole('img');
        // Should still be img tag, not div with mask
        expect(img.tagName).toBe('IMG');
        expect(img).not.toHaveStyle({ backgroundColor: 'red' });
    });

    it('handles missing Lucide icon gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const { container } = render(<Icon icon="lu-NonExistentIcon" />);
        expect(container.firstChild).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
        consoleSpy.mockRestore();
    });

    it('handles explicitly requesting svg suffix', () => {
        render(<Icon icon="sh-github-svg" size={40} />);
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'https://cdn.jsdelivr.net/gh/selfhst/icons@main/svg/github.svg');
    });
});
