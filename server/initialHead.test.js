// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { initialHead, withInitialHead } from './initialHead.js';

const themes = [{
    id: 'default',
    colors: {
        light: { '--bg-page-gradient': 'linear-gradient(red, blue)' },
        dark: { '--bg-page-gradient': 'linear-gradient(black, navy)' },
    },
}];

describe('initialHead', () => {
    it("draws the theme's gradient for each appearance", () => {
        const head = initialHead({ themes });
        expect(head).toContain(':root{--bg-page-gradient:linear-gradient(red, blue)}');
        expect(head).toContain(':root[data-theme="dark"]{--bg-page-gradient:linear-gradient(black, navy)}');
        expect(head).toContain("localStorage.getItem('theme-mode')");
    });

    it('puts the saved picture in place of the gradient, with its darkening', () => {
        const head = initialHead({ themes, background: { image: '/api/config/background/a.jpg', dim: 0.3 } });
        expect(head).toContain('--bg-page-custom:url("/api/config/background/a.jpg");--bg-page-base:#101012;--bg-page-dim:0.3');
    });

    it('makes a color gradient per appearance', () => {
        const head = initialHead({ background: { color: '#5e3bd1' } });
        expect(head).toMatch(/:root\{--bg-page-custom:linear-gradient\(135deg.*#fff\) 100%\)\}/);
        expect(head).toMatch(/\[data-theme="dark"\]\{--bg-page-custom:linear-gradient\(135deg.*45%, #000\) 100%\)\}/);
    });

    it('cannot end its <style> element early', () => {
        const head = initialHead({ background: { image: 'https://x.test/</style><script>alert(1)</script>' } });
        expect(head.match(/<\/style>/g)).toHaveLength(1);
        expect(head).not.toContain('<script>alert');
    });

    it("sets the dashboard's style before the first paint", () => {
        expect(initialHead({ appearance: { style: 'terminal' } })).toContain("setAttribute('data-style','terminal')");
        expect(initialHead({ appearance: { style: "x');alert(1)//" } })).toContain("setAttribute('data-style','glass')");
    });

    it('sets the transparency of Glass and Liquid Glass before the first paint', () => {
        expect(initialHead({ appearance: { style: 'liquid', transparency: 1 } })).toContain("setProperty('--surface-clear','0.25')");
        expect(initialHead({ appearance: { style: 'material', transparency: 1 } })).not.toContain('--surface-clear');
        expect(initialHead({ appearance: { transparency: "1');alert(1)//" } })).toContain("setProperty('--surface-clear','1')");
    });

    it('goes before </head>', () => {
        expect(withInitialHead('<html><head><title>x</title></head><body></body></html>', {}))
            .toMatch(/<title>x<\/title><script>.*<\/style><\/head>/);
    });

    it("uses the requested page's own background", () => {
        const config = {
            background: { color: '#5e3bd1' },
            pages: [
                { id: 'home', cards: [] },
                { id: 'garden', background: { image: '/api/config/background/g.jpg' }, cards: [] },
                { id: 'plain', background: { theme: true }, cards: [] },
            ],
        };
        expect(initialHead(config, '/garden')).toContain('url("/api/config/background/g.jpg")');
        expect(initialHead(config, '/home')).toContain('#5e3bd1');
        expect(initialHead(config, '/plain?x=1')).not.toContain('--bg-page-custom:');
        expect(initialHead(config, '/nope')).toContain('#5e3bd1');
    });
});
