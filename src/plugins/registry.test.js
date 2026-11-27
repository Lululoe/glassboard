import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { builtinPlugins } from '../features/registry';
import {
    getCardComponent, getCardInfo, getCardTypes, getPluginFailures, getPluginIds, getPlugins, loadPlugins, registerPlugin, subscribe, useCardTypes,
} from './registry';

const Card = () => null;
const card = (extra = {}) => ({ Component: Card, name: 'Test', icon: 'lu-Star', ...extra });

describe('plugin registry', () => {
    it('registers every built-in plugin and card type', () => {
        expect(getPluginIds()).toEqual(expect.arrayContaining(builtinPlugins.map(p => p.id)));
        expect(Object.keys(getCardTypes())).toEqual(expect.arrayContaining([
            'appgrid', 'container', 'git', 'graph', 'hacontrol', 'media', 'mediaplayer', 'proxmox',
            'serverstats', 'spacer', 'thermostat', 'thermostats', 'transmission', 'vacuum', 'vacuums', 'weather',
        ]));
        expect(getCardInfo('vacuums')).toMatchObject({ plugin: 'vacuum', name: 'Multiple Vacuums' });
        expect(getCardInfo('vacuums')).not.toHaveProperty('Component');
        expect(getPlugins().find(p => p.id === 'vacuum')).toEqual({ id: 'vacuum', name: 'Vacuum', cards: ['vacuum', 'vacuums'], builtIn: true });
    });

    it('looks card types up case-insensitively', () => {
        expect(getCardComponent('Weather')).toBe(getCardComponent('weather'));
        expect(getCardComponent('nope')).toBeNull();
        expect(getCardInfo('constructor')).toBeUndefined();
    });

    it('adds the cards of a new plugin and tells listeners', () => {
        const listener = vi.fn();
        const unsubscribe = subscribe(listener);
        const { result } = renderHook(() => useCardTypes());
        act(() => registerPlugin({ id: 'test-new', name: 'New', register: api => api.registerCard('test_new', card()) }));
        unsubscribe();

        expect(listener).toHaveBeenCalledTimes(1);
        expect(getCardComponent('test_new')).toBe(Card);
        expect(result.current.test_new).toMatchObject({ plugin: 'test-new', name: 'Test' });
        expect(getPlugins().at(-1)).toEqual({ id: 'test-new', name: 'New', cards: ['test_new'], builtIn: false });
    });

    it('rejects invalid plugins and card types', () => {
        expect(() => registerPlugin({ id: 'Bad Id', register() {} })).toThrow(/Invalid plugin id/);
        expect(() => registerPlugin({ id: 'no-register' })).toThrow(/no register function/);
        expect(() => registerPlugin({ id: 'bad-type', register: api => api.registerCard('Has Space', card()) })).toThrow(/lowercase/);
        expect(() => registerPlugin({ id: 'no-component', register: api => api.registerCard('nocomp', card({ Component: null })) })).toThrow(/no Component/);
        expect(() => registerPlugin({ id: 'no-name', register: api => api.registerCard('noname', card({ name: '' })) })).toThrow(/name and an icon/);
    });

    it("doesn't let a plugin take another plugin's id or card type, and adds none of its cards then", () => {
        expect(() => registerPlugin({ id: 'weather', register() {} })).toThrow(/already registered/);
        expect(() => registerPlugin({
            id: 'test-clash',
            register: (api) => {
                api.registerCard('test_clash', card());
                api.registerCard('weather', card());
            },
        })).toThrow(/already registered by weather/);
        expect(getCardComponent('test_clash')).toBeNull();
        expect(getPluginIds()).not.toContain('test-clash');
    });

    it('replaces a plugin when asked to, as hot reloading does', () => {
        registerPlugin({ id: 'test-hot', name: 'Hot', register: api => api.registerCard('test_old', card()) });
        registerPlugin({ id: 'test-hot', name: 'Hot', register: api => api.registerCard('test_hot', card()) }, { replace: true });
        expect(getCardComponent('test_old')).toBeNull();
        expect(getCardComponent('test_hot')).toBe(Card);
    });

    it('skips bad plugins and lists why, loading the good ones around them', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const good = { id: 'test-good', name: 'Good', register: api => api.registerCard('test_good', card()) };
        loadPlugins([
            { id: 'test-throws', name: 'Throws', register(api) { api.registerCard('test_first', card()); throw new Error('Broke'); } },
            { id: 'test-takes', register: api => api.registerCard('weather', card()) },
            { name: 'Nameless', register() {} },
            good,
            { ...good, name: 'Good Twin' },
        ]);
        error.mockRestore();

        expect(Object.fromEntries(getPluginFailures().map(f => [f.id, f.error]))).toEqual({
            'test-throws': 'Broke',
            'test-takes': 'Plugin test-takes: card type "weather" is already registered by weather',
            '(no id)': 'Invalid plugin id: undefined',
            'test-good (duplicate)': 'Plugin test-good is already registered',
        });
        expect(getPluginFailures()[0]).toEqual({ id: 'test-throws', name: 'Throws', error: 'Broke', builtIn: false });
        expect(getCardComponent('test_good')).toBe(Card);
        expect(getCardComponent('test_first')).toBeNull();
        expect(getCardInfo('weather').name).toBe('Weather');
    });
});
