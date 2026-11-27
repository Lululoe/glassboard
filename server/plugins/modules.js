import express from 'express';
import { createRequire } from 'module';
import { SDK_EXPORTS, SHARED_MODULES } from '../../shared/sdkExports.js';
import { assetsDirFor } from './loader.js';

const require = createRequire(import.meta.url);
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * The names each shared module exports. React's are read from the package, so they follow
 * its version; the SDK's from its list.
 * @type {Object<string, string[]>}
 */
const EXPORTS = {
    react: Object.keys(require('react')),
    'react/jsx-runtime': Object.keys(require('react/jsx-runtime')),
    'react-dom': Object.keys(require('react-dom')),
    '@glassboard/sdk': SDK_EXPORTS,
};

/**
 * Writes the module a plugin gets for a shared import, such as `react`. The page puts the
 * modules it runs on `globalThis.__glassboard.modules` before it loads plugins; this module
 * hands them on, so plugins use the page's React instead of a copy of their own, which hooks
 * need.
 * @param {string} specifier - The import, such as `react` or `@glassboard/sdk`.
 * @returns {string} JavaScript source.
 */
export function sharedModuleSource(specifier) {
    const names = EXPORTS[specifier].filter(name => name !== 'default' && IDENTIFIER.test(name));
    const key = JSON.stringify(specifier);
    return [
        `const m = globalThis.__glassboard?.modules?.[${key}];`,
        `if (!m) throw new Error(${JSON.stringify(`Glassboard has not shared ${specifier} with plugins yet`)});`,
        'export default m.default ?? m;',
        names.length ? `export const { ${names.join(', ')} } = m;` : '',
    ].join('\n');
}

/**
 * The import map that points plugins' shared imports at those modules. It goes into the page
 * before any script.
 * @returns {string} The `<script type="importmap">` element.
 */
export function importMapTag() {
    const imports = Object.fromEntries(Object.entries(SHARED_MODULES).map(([specifier, file]) => [specifier, `/_glassboard/modules/${file}`]));
    return `<script type="importmap">${JSON.stringify({ imports })}</script>`;
}

/**
 * Serves the shared modules at `/_glassboard/modules/<file>` and each loaded plugin's browser
 * files at `/_plugins/<id>/`, from the folder its manifest names as `assets` and nothing else.
 * @returns {import('express').Router} The routes.
 */
export function pluginAssetRoutes() {
    const router = express.Router();
    const byFile = Object.fromEntries(Object.entries(SHARED_MODULES).map(([specifier, file]) => [file, specifier]));

    router.get('/_glassboard/modules/:file', (req, res, next) => {
        const specifier = byFile[req.params.file];
        if (!specifier) return next();
        res.type('text/javascript').set('Cache-Control', 'no-cache').send(sharedModuleSource(specifier));
    });

    router.use('/_plugins/:id', (req, res, next) => {
        const dir = assetsDirFor(req.params.id);
        if (!dir) return res.status(404).type('text').send('No such plugin');
        // The URLs carry the plugin's version, so a changed file gets a new URL
        return express.static(dir, { index: false, dotfiles: 'deny', fallthrough: false, maxAge: '1h' })(req, res, next);
    });
    return router;
}
