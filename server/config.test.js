// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { deepMerge, getConfig, getSanitizedConfig, getServiceConfig, loadConfig, setConfig, findCard } from './config.js';

describe('deepMerge', () => {
    it('merges nested objects without mutating its arguments', () => {
        const base = { a: { b: 1, c: 2 }, list: [1] };
        const override = { a: { c: 3 }, list: [2] };
        const result = deepMerge(base, override);

        expect(result).toEqual({ a: { b: 1, c: 3 }, list: [2] });
        expect(base).toEqual({ a: { b: 1, c: 2 }, list: [1] });
        expect(override).toEqual({ a: { c: 3 }, list: [2] });
    });
});

describe('loadConfig', () => {
    afterEach(() => {
        delete process.env.SERVICES__TESTSERVICE__URL;
        delete process.env.SERVICES__NESTED__DEEP__VALUE;
    });

    it('maps SERVICES__* environment variables into services', () => {
        process.env.SERVICES__TESTSERVICE__URL = 'http://test.local';
        process.env.SERVICES__NESTED__DEEP__VALUE = 'success';
        loadConfig();

        expect(getConfig().services.testservice.url).toBe('http://test.local');
        expect(getConfig().services.nested.deep.value).toBe('success');
    });
});

describe('getSanitizedConfig', () => {
    it('removes services and credential-like keys at any depth', () => {
        setConfig({
            services: { sonarr: { apiKey: 'top' } },
            pages: [{
                id: 'home',
                cards: [
                    { id: 'm', type: 'media', apikey: 'x', services: [{ type: 'sonarr', url: 'http://s', apiKey: 'nested' }] },
                    { id: 't', type: 'transmission', url: 'http://t', password: 'pw', username: 'u' },
                    { id: 'p', type: 'proxmox', data: { token: 'tok', secret: 's', tokenId: 'id' } },
                ],
            }],
        });

        const sanitized = getSanitizedConfig();
        const json = JSON.stringify(sanitized);

        expect(sanitized.services).toBeUndefined();
        ['top', 'nested', '"x"', 'pw', 'tok'].forEach(secret => expect(json).not.toContain(secret));
        expect(sanitized.pages[0].cards[0].services[0].url).toBe('http://s');
        expect(sanitized.pages[0].cards[1].url).toBe('http://t');
    });
});

describe('getServiceConfig', () => {
    beforeEach(() => {
        setConfig({
            services: {
                proxmox: { URL: 'https://from-file:8006', tokenSecret: 'aliased' },
                git: { github: { token: 'nested-token' } },
            },
            pages: [{ cards: [{ id: 'px', type: 'proxmox', url: 'https://from-card', tokenId: 'card-id' }] }],
        });
    });

    afterEach(() => {
        delete process.env.PROXMOX_URL;
    });

    const fields = {
        url: { env: ['PROXMOX_URL'] },
        tokenId: {},
        secret: { aliases: ['tokenSecret'] },
        verifyTls: { default: false },
    };

    it('reads the services section case-insensitively, with aliases and card fallback', () => {
        expect(getServiceConfig('proxmox', fields, { cardType: 'proxmox' })).toEqual({
            url: 'https://from-file:8006',
            tokenId: 'card-id',
            secret: 'aliased',
            verifyTls: false,
        });
    });

    it('prefers environment variables', () => {
        process.env.PROXMOX_URL = 'https://from-env:8006';
        expect(getServiceConfig('proxmox', fields).url).toBe('https://from-env:8006');
    });

    it('uses the first section path that exists', () => {
        expect(getServiceConfig(['git.github', 'github'], { token: {} }).token).toBe('nested-token');
        expect(getServiceConfig(['missing', 'git.github'], { token: {} }).token).toBe('nested-token');
    });

    it('finds cards by id', () => {
        expect(findCard('px').type).toBe('proxmox');
        expect(findCard('nope')).toBeUndefined();
    });
});
