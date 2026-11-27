import { once } from 'events';
import request from 'supertest';
import { EDIT_HEADER, editKey } from './editAccess.js';

/**
 * Starts an app on a free loopback port for supertest. Given a bare app, supertest listens on
 * all interfaces but sends its requests to 127.0.0.1, and a process already bound to
 * 127.0.0.1 on that port would answer them instead.
 * @param {import('express').Express} app - The Express app.
 * @returns {Promise<import('http').Server>} The listening server; close it when done.
 */
export async function listenOnLoopback(app) {
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return server;
}

/**
 * Sends requests as someone who unlocked editing: like supertest's `request(server)`, with the
 * edit key on every request.
 * @param {import('http').Server} server - The listening server.
 * @returns {{get: Function, put: Function, post: Function, delete: Function}} The request makers.
 */
export function asEditor(server) {
    const agent = request(server);
    const key = editKey();
    return {
        get: url => agent.get(url).set(EDIT_HEADER, key),
        put: url => agent.put(url).set(EDIT_HEADER, key),
        post: url => agent.post(url).set(EDIT_HEADER, key),
        delete: url => agent.delete(url).set(EDIT_HEADER, key),
    };
}
