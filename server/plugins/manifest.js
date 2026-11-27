import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { GLASSBOARD_VERSION, parseVersion, satisfies } from './version.js';

/** Plugin ids the API uses for its own paths, which no plugin may have. */
export const RESERVED_IDS = new Set(['install', 'preview', 'remove', 'update']);

/** Ids are lowercase so they work as folder names and in URLs on every system. */
export const PLUGIN_ID = /^[a-z][a-z0-9-]{0,63}$/;

/** The file in a plugin's folder that describes it. */
export const MANIFEST_FILE = 'plugin.json';

/** A path inside the plugin's folder: relative, with no `..`. */
const innerPath = z.string().min(1).max(200)
    .refine(p => !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..'), 'must be a path inside the plugin folder');

const manifestSchema = z.object({
    id: z.string().regex(PLUGIN_ID, 'must be lowercase letters, digits and dashes, starting with a letter')
        .refine(id => !RESERVED_IDS.has(id), 'is reserved'),
    name: z.string().min(1).max(80),
    version: z.string().refine(v => parseVersion(v) !== null, 'must be a version such as 1.0.0'),
    description: z.string().max(300).optional(),
    glassboard: z.string().min(1).max(100),
    // Files the browser may load are served from this folder, nothing else in the plugin's folder
    assets: innerPath.default('dist'),
    // ES module with the browser part, relative to `assets`
    client: innerPath.optional(),
    // Stylesheet, relative to `assets`
    style: innerPath.optional(),
    // ES module with the server part, relative to the plugin's folder
    server: innerPath.optional(),
    repository: z.string().max(300).optional(),
}).refine(m => m.client || m.server, 'needs a client or a server entry');

/**
 * @typedef {z.infer<typeof manifestSchema>} PluginManifest
 */

/**
 * Turns zod's issues into one readable sentence.
 * @param {z.ZodError} error - The validation error.
 * @returns {string} Such as `plugin.json: id must be lowercase …`.
 */
const describe = (error) => `${MANIFEST_FILE}: ${error.issues.map(i => `${i.path.join('.') || 'it'} ${i.message}`).join('; ')}`;

/**
 * Reads and checks a plugin's manifest: its fields, that it works with this version of
 * Glassboard, and that the files it names exist.
 * @param {string} dir - The plugin's folder.
 * @returns {PluginManifest} The manifest.
 * @throws {Error} Saying what is wrong.
 */
export function readManifest(dir) {
    const file = path.join(dir, MANIFEST_FILE);
    if (!fs.existsSync(file)) throw new Error(`No ${MANIFEST_FILE} in the plugin folder`);
    let raw;
    try {
        raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (err) {
        throw new Error(`${MANIFEST_FILE} is not valid JSON: ${err.message}`);
    }
    const parsed = manifestSchema.safeParse(raw);
    if (!parsed.success) throw new Error(describe(parsed.error));
    const manifest = parsed.data;

    let fits;
    try {
        fits = satisfies(GLASSBOARD_VERSION, manifest.glassboard);
    } catch (err) {
        throw new Error(`${MANIFEST_FILE}: glassboard ${err.message}`);
    }
    if (!fits) throw new Error(`Needs Glassboard ${manifest.glassboard}, this is ${GLASSBOARD_VERSION}`);

    const assetsDir = path.join(dir, manifest.assets);
    [
        manifest.client && path.join(assetsDir, manifest.client),
        manifest.style && path.join(assetsDir, manifest.style),
        manifest.server && path.join(dir, manifest.server),
    ].filter(Boolean).forEach((entry) => {
        if (!fs.existsSync(entry) || !fs.statSync(entry).isFile()) {
            throw new Error(`${path.relative(dir, entry)} is named in ${MANIFEST_FILE} but missing`);
        }
    });
    return manifest;
}
