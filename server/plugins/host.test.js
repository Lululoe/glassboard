// @vitest-environment node
import request from 'supertest';
import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import { createApp } from '../app.js';
import { setConfig } from '../config.js';
import { getValidEntityIds } from '../services/homeassistant.js';
import { plugins } from '../services/index.js';
import { listenOnLoopback } from '../testServer.js';
import { createPluginContext } from './context.js';
import { setupPlugins } from './host.js';

const plugin = (id, result) => ({ id, setup: () => result });

describe('plugin host', () => {
    it('collects services, demo services and routes, and passes each plugin its context', async () => {
        const setup = vi.fn(() => ({ services: { one: () => 1 }, demo: { one: () => 'demo' }, routes: () => {} }));
        const host = setupPlugins([{ id: 'a', setup }, plugin('b', { services: { two: async () => 2 } })], createPluginContext);

        expect(setup.mock.calls[0][0]).toMatchObject({ id: 'a', config: expect.any(Object), homeassistant: expect.any(Object) });
        expect(host.ids).toEqual(['a', 'b']);
        expect(await host.services.one({})).toBe(1);
        expect(await host.demo.one({})).toBe('demo');
        expect(await host.services.two({})).toBe(2);
        expect(host.routers.map(r => r.id)).toEqual(['a']);
        expect(host.plugins).toEqual([
            { id: 'a', services: ['one'], routes: true, builtIn: false },
            { id: 'b', services: ['two'], routes: false, builtIn: false },
        ]);
    });

    it('turns a handler that throws into a rejected promise', async () => {
        const host = setupPlugins([plugin('a', { services: { boom: () => { throw new Error('boom'); } } })], createPluginContext);
        await expect(host.services.boom({})).rejects.toThrow('boom');
    });

    it.each([
        ['an invalid id', { id: '../x', setup: () => ({}) }, /Invalid plugin id/],
        ['no setup', { id: 'x' }, /no setup function/],
        ['an invalid service name', plugin('x', { services: { 'Bad Name': () => {} } }), /must be lowercase/],
        ['a service that is no function', plugin('x', { services: { svc: 'nope' } }), /not a function/],
        ['a demo without its service', plugin('x', { demo: { other: () => {} } }), /no service of that name/],
        ['routes that are no function', plugin('x', { routes: {} }), /routes must be a function/],
    ])('skips a plugin with %s, and lists why', (_, bad, message) => {
        const host = setupPlugins([bad, plugin('good', {})], createPluginContext);
        expect(host.ids).toEqual(['good']);
        expect(host.failed).toHaveLength(1);
        expect(host.failed[0].error).toMatch(message);
    });

    it("doesn't let a plugin take another's id or service, and skips it whole", () => {
        const onError = vi.fn();
        const host = setupPlugins([
            plugin('a', { services: { svc: () => 'a' } }),
            plugin('a', {}),
            plugin('b', { services: { mine: () => 'b', svc: () => 'b' } }),
        ], createPluginContext, { onError });

        expect(onError.mock.calls.map(([id, err]) => [id, err.message])).toEqual([
            ['a', 'Plugin a is already set up'],
            ['b', 'Plugin b: service "svc" is already added by a'],
        ]);
        expect(host.ids).toEqual(['a']);
        expect(host.failed).toEqual([
            { id: 'a', error: 'Plugin a is already set up', builtIn: false },
            { id: 'b', error: 'Plugin b: service "svc" is already added by a', builtIn: false },
        ]);
        expect(Object.keys(host.services)).toEqual(['svc']);
    });

    it('sets up every built-in plugin, each service with a demo version', () => {
        expect(plugins.ids).toEqual(['core', 'appgrid', 'git', 'media', 'proxmox', 'serverstats', 'transmission', 'vacuum']);
        expect(Object.keys(plugins.demo).sort()).toEqual(Object.keys(plugins.services).sort());
    });

    it("adds the entities of plugins' cards to those the API may read", () => {
        setConfig({ pages: [{ id: 'p', cards: [{ id: 'robo', type: 'vacuum', entity_id: 'vacuum.robo' }] }] });
        expect(getValidEntityIds()).toContain('vacuum.robo');
        setConfig({});
    });
});

describe('plugin routes', () => {
    let server;

    beforeAll(async () => {
        server = await listenOnLoopback(await createApp({ frontend: false }));
    });

    afterAll(() => {
        server.close();
    });

    it('serves them under /api/plugins/<id>/', async () => {
        const res = await request(server).get('/api/plugins/vacuum/camera');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/card_id and entity_id are required/);
    });

    it('lists the plugins and what each adds', async () => {
        const res = await request(server).get('/api/plugins');
        expect(res.status).toBe(200);
        expect(res.body.plugins).toContainEqual({ id: 'vacuum', services: ['vacuum'], routes: true, builtIn: true });
        expect(res.body.failed).toEqual([]);
        expect(res.body.plugins).toContainEqual({ id: 'core', services: ['homeassistant', 'weather'], routes: false, builtIn: true });
    });

    it('answers 404 for a plugin without that route', async () => {
        expect((await request(server).get('/api/plugins/nope/camera')).status).toBe(404);
        expect((await request(server).get('/api/ha/camera?card_id=a&entity_id=b')).status).toBe(404);
    });
});
