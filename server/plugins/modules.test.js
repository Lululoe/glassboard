// @vitest-environment node
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listenOnLoopback } from '../testServer.js';
import { createPluginContext } from './context.js';
import { createPluginHost } from './host.js';
import { loadPluginFolder, unloadPlugin } from './loader.js';
import { importMapTag, pluginAssetRoutes, sharedModuleSource } from './modules.js';

describe('modules shared with plugins', () => {
    let server;
    let root;
    const host = createPluginHost(createPluginContext);

    beforeAll(async () => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-assets-'));
        const dir = path.join(root, 'hello');
        fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify({ id: 'hello', name: 'Hello', version: '1.0.0', glassboard: '*', client: 'client.js' }));
        fs.writeFileSync(path.join(dir, 'dist', 'client.js'), 'export default { id: "hello" };');
        fs.writeFileSync(path.join(dir, 'dist', '.secret'), 'hidden');
        fs.writeFileSync(path.join(dir, 'server-only.js'), 'secret');
        await loadPluginFolder(host, dir);
        const app = express();
        app.use(pluginAssetRoutes());
        server = await listenOnLoopback(app);
    });

    afterAll(() => {
        server.close();
        unloadPlugin(host, 'hello');
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('hands on the page’s modules under their own export names', () => {
        const react = sharedModuleSource('react');
        expect(react).toContain('globalThis.__glassboard?.modules?.["react"]');
        expect(react).toMatch(/export const \{[^}]*\buseState\b[^}]*\} = m;/);
        expect(react).toContain('export default m.default ?? m;');
        expect(sharedModuleSource('@glassboard/sdk')).toMatch(/export const \{[^}]*\bBaseCard\b[^}]*\bcallService\b/);
    });

    it('maps the shared imports in the import map', () => {
        const json = /<script type="importmap">(.*)<\/script>/.exec(importMapTag())[1];
        expect(JSON.parse(json)).toEqual({
            imports: {
                react: '/_glassboard/modules/react.js',
                'react/jsx-runtime': '/_glassboard/modules/react-jsx-runtime.js',
                'react-dom': '/_glassboard/modules/react-dom.js',
                '@glassboard/sdk': '/_glassboard/modules/sdk.js',
            },
        });
    });

    it('serves the shared modules', async () => {
        const res = await request(server).get('/_glassboard/modules/sdk.js');
        expect(res.status).toBe(200);
        expect(res.type).toBe('text/javascript');
        expect((await request(server).get('/_glassboard/modules/fs.js')).status).toBe(404);
    });

    it('serves a loaded plugin’s assets folder and nothing else', async () => {
        const res = await request(server).get('/_plugins/hello/client.js?v=1');
        expect(res.status).toBe(200);
        expect(res.text).toContain('id: "hello"');
        expect((await request(server).get('/_plugins/hello/.secret')).status).toBe(403);
        expect((await request(server).get('/_plugins/hello/../server-only.js')).status).toBe(404);
        expect((await request(server).get('/_plugins/hello/%2e%2e/server-only.js')).status).not.toBe(200);
        expect((await request(server).get('/_plugins/hello/missing.js')).status).toBe(404);
        expect((await request(server).get('/_plugins/other/client.js')).status).toBe(404);
    });
});
