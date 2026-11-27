import { describe, it, expect, vi } from 'vitest';

// The Weather plugin broken, as a bad plugin would be
vi.mock('./Weather/plugin', () => ({
    default: { id: 'weather', name: 'Weather', register() { throw new Error('Weather broke'); } },
}));

describe('built-in plugins', () => {
    it('load around one that fails, which is listed instead of stopping the dashboard', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { getCardComponent, getPluginFailures } = await import('./registry');
        expect(error).toHaveBeenCalledWith('Plugin weather was not loaded: Weather broke');
        error.mockRestore();

        expect(getPluginFailures()).toEqual([{ id: 'weather', name: 'Weather', error: 'Weather broke', builtIn: true }]);
        expect(getCardComponent('weather')).toBeNull();
        expect(getCardComponent('vacuum')).not.toBeNull();
    });
});
