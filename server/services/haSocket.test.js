// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyDiff, createHaSocket, expandState } from './haSocket.js';
import { setConfig } from '../config.js';
import { handleHaRequest, startLiveStates, stopLiveStates } from './homeassistant.js';

/** Stands in for a connection to Home Assistant; tests play the server's side. */
class FakeSocket extends EventTarget {
    static instances = [];

    constructor(url) {
        super();
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        FakeSocket.instances.push(this);
    }

    send(data) {
        this.sent.push(JSON.parse(data));
    }

    close() {
        this.readyState = 3;
        this.dispatchEvent(new Event('close'));
    }

    /** Opens the connection and asks for authentication, like Home Assistant. */
    open() {
        this.readyState = 1;
        this.dispatchEvent(new Event('open'));
        this.receive({ type: 'auth_required' });
    }

    receive(msg) {
        const event = new Event('message');
        event.data = JSON.stringify(msg);
        this.dispatchEvent(event);
    }

    /** Last message of a type sent to Home Assistant. */
    last(type) {
        return this.sent.filter(m => m.type === type).at(-1);
    }
}

const latest = () => FakeSocket.instances.at(-1);

/** Connects and authenticates the latest socket. */
const connect = () => {
    latest().open();
    latest().receive({ type: 'auth_ok' });
};

describe('Home Assistant websocket', () => {
    beforeEach(() => {
        FakeSocket.instances = [];
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const create = (options = {}) => createHaSocket({
        getConfig: () => ({ url: 'https://ha.local:8123', token: 'tkn' }),
        WebSocketImpl: /** @type {*} */ (FakeSocket),
        ...options,
    });

    it('authenticates and keeps a live copy of the watched states', () => {
        const ha = create();
        ha.watch(new Set(['light.a', 'light.b']));
        expect(latest().url).toBe('wss://ha.local:8123/api/websocket');
        latest().open();
        expect(latest().last('auth')).toEqual({ type: 'auth', access_token: 'tkn' });
        expect(ha.getState('light.a').known).toBe(false);

        latest().receive({ type: 'auth_ok' });
        const sub = latest().last('subscribe_entities');
        expect(sub.entity_ids.sort()).toEqual(['light.a', 'light.b']);

        latest().receive({ id: sub.id, type: 'event', event: { a: { 'light.a': { s: 'on', a: { brightness: 100, effect: 'x' }, c: 'ctx', lc: 1000 } } } });
        expect(ha.getState('light.a')).toEqual({
            known: true,
            state: {
                entity_id: 'light.a', state: 'on', attributes: { brightness: 100, effect: 'x' },
                last_changed: '1970-01-01T00:16:40.000Z', last_updated: '1970-01-01T00:16:40.000Z',
                context: { id: 'ctx', parent_id: null, user_id: null },
            },
        });
        // Known to be missing in Home Assistant
        expect(ha.getState('light.b')).toEqual({ known: true, state: null });
        // Not watched
        expect(ha.getState('light.c').known).toBe(false);

        latest().receive({ id: sub.id, type: 'event', event: { c: { 'light.a': { '+': { s: 'off', lc: 1010, a: { brightness: 0 } }, '-': { a: ['effect'] } } } } });
        expect(ha.getState('light.a').state).toMatchObject({ state: 'off', attributes: { brightness: 0 }, last_changed: '1970-01-01T00:16:50.000Z' });

        latest().receive({ id: sub.id, type: 'event', event: { r: ['light.a'] } });
        expect(ha.getState('light.a')).toEqual({ known: true, state: null });
        ha.close();
    });

    it('watches the members of groups once it knows them', () => {
        const ha = create({
            expand: (ids, attributesOf) => new Set([...ids, ...(attributesOf('group.room')?.entity_id || [])]),
        });
        ha.watch(new Set(['group.room']));
        connect();
        const first = latest().last('subscribe_entities');
        expect(first.entity_ids).toEqual(['group.room']);

        latest().receive({ id: first.id, type: 'event', event: { a: { 'group.room': { s: 'on', a: { entity_id: ['light.x'] }, lc: 1 } } } });
        const second = latest().last('subscribe_entities');
        expect(second.entity_ids.sort()).toEqual(['group.room', 'light.x']);
        expect(latest().last('unsubscribe_events')).toMatchObject({ subscription: first.id });

        // Events of the replaced subscription are ignored
        latest().receive({ id: first.id, type: 'event', event: { a: { 'light.x': { s: 'on', lc: 1 } } } });
        expect(ha.getState('light.x').known).toBe(false);
        latest().receive({ id: second.id, type: 'event', event: { a: { 'group.room': { s: 'on', a: { entity_id: ['light.x'] }, lc: 1 }, 'light.x': { s: 'off', lc: 1 } } } });
        expect(ha.getState('light.x').state.state).toBe('off');
        expect(latest().sent.filter(m => m.type === 'subscribe_entities')).toHaveLength(2);
        ha.close();
    });

    it('runs commands and delivers subscribed events', async () => {
        const ha = create();
        const updates = [];
        ha.onEvent('entity_registry_updated', e => updates.push(e));
        ha.watch(new Set());
        connect();

        const sub = latest().last('subscribe_events');
        expect(sub.event_type).toBe('entity_registry_updated');
        latest().receive({ id: sub.id, type: 'event', event: { data: { entity_id: 'light.a' } } });
        expect(updates).toEqual([{ data: { entity_id: 'light.a' } }]);

        const result = ha.command({ type: 'config/entity_registry/get', entity_id: 'light.a' });
        const cmd = latest().last('config/entity_registry/get');
        latest().receive({ id: cmd.id, type: 'result', success: true, result: { options: {} } });
        await expect(result).resolves.toEqual({ options: {} });

        const failing = ha.command({ type: 'nope' });
        latest().receive({ id: latest().last('nope').id, type: 'result', success: false, error: { message: 'Unknown command.' } });
        await expect(failing).rejects.toThrow('Unknown command.');
        ha.close();
    });

    it('reconnects with backoff and forgets states while disconnected', () => {
        const ha = create();
        ha.watch(new Set(['light.a']));
        connect();
        const sub = latest().last('subscribe_entities');
        latest().receive({ id: sub.id, type: 'event', event: { a: { 'light.a': { s: 'on', lc: 1 } } } });
        expect(ha.getState('light.a').known).toBe(true);

        vi.spyOn(console, 'warn').mockImplementation(() => {});
        latest().close();
        expect(ha.getState('light.a').known).toBe(false);
        expect(FakeSocket.instances).toHaveLength(1);
        vi.advanceTimersByTime(1000);
        expect(FakeSocket.instances).toHaveLength(2);

        // A failed attempt waits twice as long
        latest().close();
        vi.advanceTimersByTime(1999);
        expect(FakeSocket.instances).toHaveLength(2);
        vi.advanceTimersByTime(1);
        expect(FakeSocket.instances).toHaveLength(3);

        connect();
        expect(latest().last('subscribe_entities').entity_ids).toEqual(['light.a']);
        console.warn.mockRestore();
        ha.close();
    });

    it('closes connections that stop answering pings', () => {
        const ha = create();
        ha.watch(new Set());
        connect();
        vi.advanceTimersByTime(30000);
        const ping = latest().last('ping');
        latest().receive({ id: ping.id, type: 'pong' });
        vi.advanceTimersByTime(30000);
        expect(latest().readyState).toBe(1);
        vi.advanceTimersByTime(30000);
        expect(latest().readyState).toBe(3);
        ha.close();
    });

    it('does not connect without settings', () => {
        const ha = create({ getConfig: () => null });
        ha.watch(new Set(['light.a']));
        expect(FakeSocket.instances).toHaveLength(0);
        ha.close();
    });

    it('expands and updates compressed states', () => {
        expect(expandState('x.y', { s: '1', lc: 2, lu: 3 })).toMatchObject({ attributes: {}, last_updated: '1970-01-01T00:00:03.000Z', context: null });
        expect(applyDiff({ s: 'a', a: { k: 1 }, lc: 1, lu: 5 }, { '+': { lc: 9 } })).toEqual({ s: 'a', a: { k: 1 }, lc: 9 });
    });
});

describe('Home Assistant service with a live connection', () => {
    beforeEach(() => {
        FakeSocket.instances = [];
        setConfig({
            services: { homeassistant: { url: 'http://ha.local', token: 'tkn' } },
            pages: [{ cards: [{ id: 'l', type: 'hacontrol', data: { entities: [{ entity_id: 'group.room' }, { entity_id: 'light.desk' }] } }] }],
        });
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ state: 'from-rest' }) })));
        startLiveStates({ WebSocketImpl: /** @type {*} */ (FakeSocket) });
    });

    afterEach(() => {
        stopLiveStates();
    });

    it('answers from the live states and falls back to REST until they arrive', async () => {
        expect(await handleHaRequest({ endpoint: 'states', entity_ids: ['light.desk'] })).toEqual({ 'light.desk': { state: 'from-rest' } });
        connect();
        const sub = latest().last('subscribe_entities');
        latest().receive({ id: sub.id, type: 'event', event: { a: { 'light.desk': { s: 'on', lc: 1 }, 'group.room': { s: 'on', a: { entity_id: ['light.lamp'] }, lc: 1 } } } });
        const next = latest().last('subscribe_entities');
        expect(next.entity_ids.sort()).toEqual(['group.room', 'light.desk', 'light.lamp']);
        latest().receive({ id: next.id, type: 'event', event: { a: { 'light.desk': { s: 'on', lc: 1 }, 'group.room': { s: 'on', a: { entity_id: ['light.lamp'] }, lc: 1 }, 'light.lamp': { s: 'off', lc: 1 } } } });

        fetch.mockClear();
        const states = await handleHaRequest({ endpoint: 'states', entity_ids: ['light.desk'] });
        expect(states['light.desk']).toMatchObject({ entity_id: 'light.desk', state: 'on' });
        expect(fetch).not.toHaveBeenCalled();

        // The dialog gets member states and favorite colors, which only the websocket offers
        const details = handleHaRequest({ endpoint: 'details', entity_id: 'group.room' });
        await vi.waitFor(() => expect(latest().last('config/entity_registry/get')).toBeDefined());
        const ask = latest().sent.filter(m => m.type === 'config/entity_registry/get');
        expect(ask.map(m => m.entity_id)).toEqual(['light.lamp']);
        latest().receive({
            id: ask[0].id, type: 'result', success: true,
            result: { options: { light: { favorite_colors: [{ hs_color: [24, 85] }, { color_temp_kelvin: 2700 }, { bogus: 1 }, { rgb_color: ['x'] }] } } },
        });
        const result = await details;
        expect(result.members['light.lamp']).toMatchObject({ state: 'off' });
        expect(result.favorites).toEqual({ 'light.lamp': [{ hs_color: [24, 85] }, { color_temp_kelvin: 2700 }] });
        expect(fetch).not.toHaveBeenCalled();

        // Cached until Home Assistant reports a change to the light's settings
        await handleHaRequest({ endpoint: 'details', entity_id: 'group.room' });
        expect(latest().sent.filter(m => m.type === 'config/entity_registry/get')).toHaveLength(1);
        const registry = latest().sent.find(m => m.type === 'subscribe_events' && m.event_type === 'entity_registry_updated');
        latest().receive({ id: registry.id, type: 'event', event: { data: { entity_id: 'light.lamp' } } });
        const again = handleHaRequest({ endpoint: 'details', entity_id: 'group.room' });
        await vi.waitFor(() => expect(latest().sent.filter(m => m.type === 'config/entity_registry/get')).toHaveLength(2));
        latest().receive({ id: latest().last('config/entity_registry/get').id, type: 'result', success: false, error: { message: 'Unauthorized' } });
        expect((await again).favorites).toEqual({});
    });
});
