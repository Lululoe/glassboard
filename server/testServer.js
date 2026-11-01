import { once } from 'events';

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
