import net from 'net';
import logger from './logger.js';

/**
 * Endings of names that only resolve inside a home network, so no outside site can point
 * them at your dashboard: mDNS (`.local`), common router names and the reserved ones.
 */
const LOCAL_SUFFIXES = ['.local', '.lan', '.home', '.home.arpa', '.internal', '.localhost', '.localdomain'];

/**
 * The host names configured in ALLOWED_HOSTS: exact names, or `*.example.com` for its
 * subdomains. `*` alone turns the check off.
 * @returns {string[]} The entries, lowercase.
 */
export function allowedHosts() {
    return String(process.env.ALLOWED_HOSTS || '')
        .split(',')
        .map(entry => entry.trim().toLowerCase().replace(/\.$/, ''))
        .filter(Boolean);
}

/**
 * Whether a request's host name may reach the dashboard. A website can point a name it owns at
 * an address in your home network (DNS rebinding) and then talk to the dashboard as if it were
 * that site; the request still carries the website's name. So the dashboard only answers to:
 * IP addresses, `localhost`, names without a dot (as a home router hands out), names that only
 * work inside a home network (`.local`, `.lan`, `.home.arpa` and the like), and the names in
 * ALLOWED_HOSTS, such as the domain a reverse proxy serves it at.
 * @param {string} hostname - The request's host name, without port.
 * @param {string[]} [allowed] - ALLOWED_HOSTS.
 * @returns {boolean} Whether to answer.
 */
export function isAllowedHost(hostname, allowed = allowedHosts()) {
    const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
    if (!host) return false;
    if (allowed.includes('*')) return true;
    if (net.isIP(host)) return true;
    if (host === 'localhost' || !host.includes('.')) return true;
    if (LOCAL_SUFFIXES.some(suffix => host.endsWith(suffix))) return true;
    return allowed.some(entry => (entry.startsWith('*.') ? host.endsWith(entry.slice(1)) : host === entry));
}

/** Host names already logged as refused, so a scan doesn't flood the log. */
const reported = new Set();

/**
 * Refuses requests for host names the dashboard doesn't answer to (see isAllowedHost), with
 * `421 Misdirected Request` and how to allow the name. `/health` always answers, for container
 * health checks.
 * @returns {import('express').RequestHandler} The middleware.
 */
export function hostCheck() {
    return (req, res, next) => {
        if (req.path === '/health' || isAllowedHost(req.hostname)) return next();
        const host = String(req.hostname || '(none)').slice(0, 100);
        if (!reported.has(host) && reported.size < 100) {
            reported.add(host);
            logger.warn(`Refused a request for the host name ${host}. If that is your dashboard's address, add it to ALLOWED_HOSTS.`);
        }
        return res.status(421).type('text').send(`Glassboard doesn't answer to ${host}. If this is its address, add it to ALLOWED_HOSTS.`);
    };
}
