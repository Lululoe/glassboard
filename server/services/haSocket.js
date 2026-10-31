import logger from '../logger.js';

const COMMAND_TIMEOUT = 10000;
const PING_INTERVAL = 30000;
const RECONNECT_MIN = 1000;
const RECONNECT_MAX = 30000;

/**
 * Turns a compressed state from `subscribe_entities` into the shape of the REST API.
 * @param {string} entityId - The entity id.
 * @param {Object} c - Compressed state: `s` state, `a` attributes, `c` context, `lc`/`lu` timestamps in seconds.
 * @returns {Object} The state as `/api/states/<entity_id>` returns it.
 */
export function expandState(entityId, c) {
    const iso = (seconds) => new Date(seconds * 1000).toISOString();
    const lastChanged = Number(c.lc) || 0;
    const lastUpdated = Number(c.lu) || lastChanged;
    return {
        entity_id: entityId,
        state: c.s,
        attributes: c.a || {},
        last_changed: iso(lastChanged),
        last_updated: iso(lastUpdated),
        context: typeof c.c === 'string' ? { id: c.c, parent_id: null, user_id: null } : (c.c || null),
    };
}

/**
 * Applies a change from `subscribe_entities` (`+` adds or replaces, `-` removes attributes).
 * @param {Object} compressed - The compressed state to update.
 * @param {Object} diff - The change.
 * @returns {Object} The updated compressed state.
 */
export function applyDiff(compressed, diff) {
    const next = { ...compressed, a: { ...compressed.a } };
    const add = diff['+'] || {};
    if (add.s !== undefined) next.s = add.s;
    if (add.a) Object.assign(next.a, add.a);
    if (add.c !== undefined) next.c = add.c;
    if (add.lc !== undefined) {
        next.lc = add.lc;
        delete next.lu;
    }
    if (add.lu !== undefined) next.lu = add.lu;
    (diff['-']?.a || []).forEach(key => { delete next.a[key]; });
    return next;
}

/**
 * Keeps one websocket connection to Home Assistant with a live copy of the states of the
 * entities Glassboard is allowed to show, and runs commands that only the websocket API
 * offers (e.g. reading the entity registry). Reconnects with backoff when the connection
 * drops; until it is back, `getState` reports states as unknown so callers can fall back
 * to the REST API.
 *
 * @param {Object} options
 * @param {() => {url: string, token: string}|null} options.getConfig - Connection settings,
 *   or null when Home Assistant is not configured.
 * @param {typeof WebSocket} [options.WebSocketImpl] - WebSocket class (for tests).
 * @param {(ids: Set<string>, attributesOf: (id: string) => Object|undefined) => Set<string>} [options.expand]
 *   Adds entities to watch based on the cached attributes, e.g. the members of watched groups.
 * @returns {Object} The connection: `watch`, `getState`, `command`, `onEvent`, `status`, `close`.
 */
export function createHaSocket({ getConfig, WebSocketImpl = globalThis.WebSocket, expand = ids => ids }) {
    /** @type {WebSocket|null} */
    let socket = null;
    let configKey = '';
    let nextId = 1;
    let authed = false;
    let closed = false;
    let retryDelay = RECONNECT_MIN;
    let retryTimer;
    let pingTimer;
    let awaitingPong = false;
    const pending = new Map();
    /** Event listeners by Home Assistant event type. */
    const listeners = new Map();

    // Live states: compressed states as received, for the entities in `subscribed`
    let wanted = new Set();
    let subscribed = /** @type {Set<string>} */ (new Set());
    let subscribedKey = /** @type {string|null} */ (null);
    let subscriptionId = 0;
    let statesReady = false;
    const compressed = new Map();
    const eventSubscriptions = new Map();

    const send = (msg) => {
        if (socket?.readyState === 1) socket.send(JSON.stringify(msg));
    };

    /**
     * Sends a command and resolves with its result.
     * @param {Object} msg - Command without `id`, e.g. `{ type: 'config/entity_registry/get', entity_id }`.
     * @returns {Promise<*>} The command's result.
     */
    function command(msg) {
        connect();
        if (!authed) return Promise.reject(new Error('Home Assistant websocket not connected'));
        const id = nextId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                pending.delete(id);
                reject(new Error(`Home Assistant command timed out: ${msg.type}`));
            }, COMMAND_TIMEOUT);
            pending.set(id, { resolve, reject, timer });
            send({ ...msg, id });
        });
    }

    /** Subscribes to the states of `wanted` (plus expansions), replacing any earlier subscription. */
    function resubscribe() {
        if (!authed) return;
        const ids = expand(new Set(wanted), id => compressed.get(id)?.a);
        const key = [...ids].sort().join(',');
        if (key === subscribedKey) return;
        subscribedKey = key;
        if (subscriptionId) {
            send({ id: nextId++, type: 'unsubscribe_events', subscription: subscriptionId });
            subscriptionId = 0;
        }
        subscribed = ids;
        compressed.clear();
        statesReady = false;
        if (ids.size === 0) {
            statesReady = true;
            return;
        }
        subscriptionId = nextId++;
        send({ id: subscriptionId, type: 'subscribe_entities', entity_ids: [...ids] });
    }

    function subscribeEvents(eventType) {
        const id = nextId++;
        eventSubscriptions.set(id, eventType);
        send({ id, type: 'subscribe_events', event_type: eventType });
    }

    function onStates(event) {
        Object.entries(event.a || {}).forEach(([id, state]) => compressed.set(id, state));
        Object.entries(event.c || {}).forEach(([id, diff]) => {
            if (compressed.has(id)) compressed.set(id, applyDiff(compressed.get(id), diff));
        });
        (event.r || []).forEach(id => compressed.delete(id));
        if (event.a) statesReady = true;
        // Group membership may have changed, which changes what has to be watched
        resubscribe();
    }

    function onMessage(raw) {
        let msg;
        try {
            msg = JSON.parse(typeof raw === 'string' ? raw : String(raw));
        } catch {
            return;
        }
        if (msg.type === 'auth_required') {
            send({ type: 'auth', access_token: getConfig()?.token });
        } else if (msg.type === 'auth_ok') {
            authed = true;
            retryDelay = RECONNECT_MIN;
            logger.info('Home Assistant websocket connected');
            resubscribe();
            [...listeners.keys()].forEach(subscribeEvents);
        } else if (msg.type === 'auth_invalid') {
            logger.error(`Home Assistant websocket rejected the token: ${msg.message || ''}`);
            socket?.close();
        } else if (msg.type === 'pong') {
            awaitingPong = false;
        } else if (msg.type === 'result') {
            const call = pending.get(msg.id);
            if (!call) return;
            pending.delete(msg.id);
            clearTimeout(call.timer);
            if (msg.success) call.resolve(msg.result);
            else call.reject(new Error(msg.error?.message || 'Home Assistant command failed'));
        } else if (msg.type === 'event') {
            if (msg.id === subscriptionId) onStates(msg.event);
            const eventType = eventSubscriptions.get(msg.id);
            if (eventType) (listeners.get(eventType) || []).forEach(fn => fn(msg.event));
        }
    }

    function reset() {
        authed = false;
        statesReady = false;
        subscriptionId = 0;
        subscribed = new Set();
        subscribedKey = null;
        compressed.clear();
        eventSubscriptions.clear();
        clearInterval(pingTimer);
        pending.forEach(call => {
            clearTimeout(call.timer);
            call.reject(new Error('Home Assistant websocket closed'));
        });
        pending.clear();
    }

    function scheduleReconnect() {
        if (closed || retryTimer) return;
        retryTimer = setTimeout(() => {
            retryTimer = undefined;
            connect();
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, RECONNECT_MAX);
    }

    /** Opens the connection if Home Assistant is configured and none is open or waiting to reconnect. */
    function connect() {
        if (closed || !WebSocketImpl) return;
        const config = getConfig();
        const key = config ? `${config.url}|${config.token}` : '';
        // New settings replace the current connection
        if (socket && key !== configKey) {
            const old = socket;
            socket = null;
            reset();
            old.close();
        }
        if (socket || retryTimer || !config) return;
        configKey = key;
        const url = `${config.url.replace(/^http/, 'ws')}/api/websocket`;
        let ws;
        try {
            ws = new WebSocketImpl(url);
        } catch (err) {
            logger.warn(`Home Assistant websocket: ${err.message}`);
            scheduleReconnect();
            return;
        }
        socket = ws;
        ws.addEventListener('message', (e) => { if (socket === ws) onMessage(e.data); });
        ws.addEventListener('open', () => {
            if (socket !== ws) return;
            pingTimer = setInterval(() => {
                // No answer to the last ping: the connection is dead without having closed
                if (awaitingPong) {
                    ws.close();
                    return;
                }
                awaitingPong = true;
                send({ id: nextId++, type: 'ping' });
            }, PING_INTERVAL);
        });
        ws.addEventListener('close', () => {
            if (socket !== ws) return;
            if (authed) logger.warn('Home Assistant websocket closed, reconnecting');
            socket = null;
            awaitingPong = false;
            reset();
            scheduleReconnect();
        });
        ws.addEventListener('error', () => {
            // A close event follows and schedules the reconnect
        });
    }

    return {
        /**
         * Sets the entities whose states are kept live, and connects if needed.
         * @param {Set<string>} ids - Entity ids.
         */
        watch(ids) {
            const key = [...ids].sort().join(',');
            if (key !== [...wanted].sort().join(',')) {
                wanted = new Set(ids);
                resubscribe();
            }
            connect();
        },
        /**
         * Returns the live state of a watched entity.
         * @param {string} id - Entity id.
         * @returns {{known: boolean, state: Object|null}} `known` is false while not connected or
         *   for entities that are not watched; `state` is null for entities Home Assistant doesn't have.
         */
        getState(id) {
            if (!authed || !statesReady || !subscribed.has(id)) return { known: false, state: null };
            const c = compressed.get(id);
            return { known: true, state: c ? expandState(id, c) : null };
        },
        command,
        /**
         * Calls `fn` for each Home Assistant event of a type, e.g. `entity_registry_updated`.
         * @param {string} eventType - The event type.
         * @param {(event: Object) => void} fn - Listener.
         */
        onEvent(eventType, fn) {
            const isNew = !listeners.has(eventType);
            listeners.set(eventType, [...(listeners.get(eventType) || []), fn]);
            if (isNew && authed) subscribeEvents(eventType);
        },
        /** @returns {{connected: boolean, watching: number}} Connection state, for logs and tests. */
        status: () => ({ connected: authed, watching: subscribed.size }),
        /** Closes the connection for good. */
        close() {
            closed = true;
            clearTimeout(retryTimer);
            const old = socket;
            socket = null;
            reset();
            old?.close();
        },
    };
}
