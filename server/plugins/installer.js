import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { HttpError } from '../errors.js';
import { MANIFEST_FILE, PLUGIN_ID, RESERVED_IDS, readManifest } from './manifest.js';
import { SOURCE_FILE, loadPluginFolder, pluginsDir, unloadPlugin } from './loader.js';
import { untarGz } from './tar.js';

/** Largest download a plugin may come in. */
export const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;

/** Hosts a download may come from, after redirects. */
const DOWNLOAD_HOSTS = new Set([
    'api.github.com', 'github.com', 'codeload.github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com',
]);

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const REF = /^[A-Za-z0-9_./-]{1,200}$/;

/**
 * @typedef {Object} PluginSource
 * @property {string} owner - GitHub user or organization.
 * @property {string} repo - Repository.
 * @property {string} [ref] - Tag, branch or commit; the latest release (or default branch) without one.
 * @property {string} url - The repository's page.
 */

/**
 * Reads where to install a plugin from: a GitHub repository as `owner/repo`, its URL, or
 * either with a tag, branch or commit after `@` or `#` (or as `/tree/<ref>` in the URL).
 * @param {string} input - What was typed.
 * @returns {PluginSource} The repository.
 * @throws {HttpError} 400 when it isn't a GitHub repository.
 */
export function parseSource(input) {
    let rest = String(input || '').trim();
    let ref;
    const at = /^(.*?)[@#]([^@#/][^@#]*)$/.exec(rest);
    if (at && !/^https?:\/\/[^/]*$/.test(at[1])) {
        rest = at[1];
        ref = at[2];
    }
    rest = rest.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/^github\.com\//i, '').replace(/\/+$/, '');
    const tree = /^([^/]+)\/([^/]+)\/tree\/(.+)$/.exec(rest);
    if (tree) {
        rest = `${tree[1]}/${tree[2]}`;
        ref ??= tree[3];
    }
    const [owner, repo, ...extra] = rest.replace(/\.git$/, '').split('/');
    if (extra.length > 0 || !NAME.test(owner || '') || !NAME.test(repo || '') || (ref !== undefined && !REF.test(ref))) {
        throw new HttpError(400, 'Enter a GitHub repository, such as owner/repository or its URL');
    }
    return { owner, repo, ref, url: `https://github.com/${owner}/${repo}` };
}

/**
 * Calls the GitHub API.
 * @param {typeof fetch} fetchImpl - Fetch.
 * @param {string} apiPath - Path below `https://api.github.com`.
 * @returns {Promise<Object|null>} The answer, or null for 404.
 * @throws {HttpError} 502 for other failures.
 */
async function github(fetchImpl, apiPath) {
    const res = await fetchImpl(`https://api.github.com${apiPath}`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Glassboard' },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
        const limited = res.status === 403 || res.status === 429;
        throw new HttpError(502, limited ? 'GitHub is limiting requests; try again in a while' : `GitHub answered ${res.status}`);
    }
    return res.json();
}

/**
 * @typedef {Object} DownloadPlan
 * @property {string} url - The archive.
 * @property {string} ref - The tag or branch it is from.
 * @property {'asset'|'tarball'} kind - A file attached to a release, or an archive GitHub makes
 *   from the code. GitHub may pack the same code differently over time, so only an asset's hash
 *   is expected to stay the same.
 * @property {{url?: string, publishedAt?: string, notes?: string}|null} release - The release it is from.
 */

/**
 * Finds what to download for a repository: a `.tgz` or `.tar.gz` attached to its latest
 * release, else the release's source, else its default branch; or the ref that was asked for.
 * @param {PluginSource} source - The repository.
 * @param {typeof fetch} fetchImpl - Fetch.
 * @returns {Promise<DownloadPlan>} What to download.
 * @throws {HttpError} 404 when the repository can't be found.
 */
export async function resolveDownload(source, fetchImpl) {
    const base = `/repos/${source.owner}/${source.repo}`;
    const tarball = ref => `https://api.github.com${base}/tarball/${encodeURIComponent(ref)}`;
    if (source.ref) return { url: tarball(source.ref), ref: source.ref, kind: 'tarball', release: null };

    const release = await github(fetchImpl, `${base}/releases/latest`);
    if (release) {
        const asset = (release.assets || []).find(a => /\.(tgz|tar\.gz)$/i.test(a.name || ''));
        const about = {
            url: release.html_url,
            publishedAt: release.published_at,
            notes: typeof release.body === 'string' ? release.body.slice(0, 2000) : undefined,
        };
        return asset?.browser_download_url
            ? { url: asset.browser_download_url, ref: release.tag_name, kind: 'asset', release: about }
            : { url: release.tarball_url, ref: release.tag_name, kind: 'tarball', release: about };
    }
    const repo = await github(fetchImpl, base);
    if (!repo) throw new HttpError(404, `Can't find ${source.owner}/${source.repo} on GitHub; it must be public`);
    return { url: tarball(repo.default_branch), ref: repo.default_branch, kind: 'tarball', release: null };
}

/** Repositories younger than this are pointed out before installing. */
const NEW_REPOSITORY_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * What GitHub says about a repository, to judge whether to trust it.
 * @param {PluginSource} source - The repository.
 * @param {typeof fetch} fetchImpl - Fetch.
 * @returns {Promise<{owner: string, description?: string, stars?: number, createdAt?: string, pushedAt?: string, archived?: boolean, isNew?: boolean}>}
 *   The details; only the owner when GitHub has none.
 */
async function repositoryInfo(source, fetchImpl) {
    const repo = await github(fetchImpl, `/repos/${source.owner}/${source.repo}`).catch(() => null);
    if (!repo) return { owner: source.owner };
    return {
        owner: repo.owner?.login || source.owner,
        description: repo.description || undefined,
        stars: repo.stargazers_count,
        createdAt: repo.created_at,
        pushedAt: repo.pushed_at,
        archived: Boolean(repo.archived),
        // A new repository has had little time to be noticed if it is up to no good
        isNew: Boolean(repo.created_at) && Date.now() - new Date(repo.created_at).getTime() < NEW_REPOSITORY_MS,
    };
}

/**
 * The commit a tag or branch points at.
 * @param {PluginSource} source - The repository.
 * @param {string} ref - The tag or branch.
 * @param {typeof fetch} fetchImpl - Fetch.
 * @returns {Promise<string|null>} The commit's SHA, or null when GitHub doesn't say.
 */
async function commitOf(source, ref, fetchImpl) {
    const commit = await github(fetchImpl, `/repos/${source.owner}/${source.repo}/commits/${encodeURIComponent(ref)}`).catch(() => null);
    return typeof commit?.sha === 'string' && /^[0-9a-f]{40}$/.test(commit.sha) ? commit.sha : null;
}

/**
 * Downloads an archive from GitHub, at most `MAX_DOWNLOAD_BYTES`.
 * @param {string} url - The archive.
 * @param {typeof fetch} fetchImpl - Fetch.
 * @returns {Promise<Buffer>} Its bytes.
 * @throws {HttpError} 502 when it fails, comes from elsewhere or is too large.
 */
export async function download(url, fetchImpl) {
    if (!DOWNLOAD_HOSTS.has(new URL(url).hostname)) throw new HttpError(400, 'Plugins can only be downloaded from GitHub');
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'Glassboard' }, redirect: 'follow' });
    if (res.url && !DOWNLOAD_HOSTS.has(new URL(res.url).hostname)) throw new HttpError(502, 'The download was redirected away from GitHub');
    if (!res.ok) throw new HttpError(502, `The download failed (${res.status})`);
    if (Number(res.headers.get('content-length')) > MAX_DOWNLOAD_BYTES) throw new HttpError(413, 'The plugin is too large to install');

    const chunks = [];
    let size = 0;
    for await (const chunk of /** @type {AsyncIterable<Uint8Array>} */ (res.body)) {
        size += chunk.length;
        if (size > MAX_DOWNLOAD_BYTES) throw new HttpError(413, 'The plugin is too large to install');
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

/**
 * Writes unpacked files into a folder.
 * @param {string} dir - The folder, which is created.
 * @param {Map<string, Buffer>} files - Files by relative path.
 */
function writeFiles(dir, files) {
    for (const [rel, data] of files) {
        const target = path.join(dir, rel);
        // untarGz already refuses such paths; checked again where the file is written
        if (!target.startsWith(dir + path.sep)) throw new Error(`Unsafe path: ${rel}`);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, data);
    }
}

/** A random suffix for folders that only exist during an install. */
const tempName = (prefix, id) => `.${prefix}-${id}-${crypto.randomBytes(4).toString('hex')}`;

/** @type {Promise<unknown>} */
let queue = Promise.resolve();

/**
 * Runs installs and removals one after another, so two can't write the same folder.
 * @template T
 * @param {() => Promise<T>} task - The work.
 * @returns {Promise<T>} Its result.
 */
function serialized(task) {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
}

/** How long a preview can be installed. */
export const PREVIEW_TTL_MS = 10 * 60 * 1000;
/** Most previews kept at once; older ones are dropped. */
const MAX_PREVIEWS = 5;

/**
 * @typedef {Object} PinnedSource
 * @property {string} url - The repository.
 * @property {string} ref - The tag or branch installed.
 * @property {'asset'|'tarball'} [kind] - What was downloaded.
 * @property {string|null} [commit] - The commit the ref pointed at.
 * @property {string} [sha256] - Hash of the downloaded archive.
 * @property {string} [installedAt] - When.
 */

/**
 * @typedef {Object} Preview
 * @property {number} expires - When it can no longer be installed.
 * @property {string} id - The plugin's id.
 * @property {Buffer} archive - The download, unpacked again to install it.
 * @property {PinnedSource} pin - Where it comes from, exactly.
 * @property {Object} summary - What the settings window shows before installing.
 */

/** @type {Map<string, Preview>} */
const previews = new Map();

/**
 * Reads where an installed plugin came from.
 * @param {string} dir - The plugins folder.
 * @param {string} id - The plugin.
 * @returns {PinnedSource|null} The source, or null when it wasn't installed from a repository.
 */
function installedSource(dir, id) {
    try {
        const source = JSON.parse(fs.readFileSync(path.join(dir, id, SOURCE_FILE), 'utf-8'));
        return typeof source?.url === 'string' ? source : null;
    } catch {
        return null;
    }
}

/**
 * Downloads a plugin and checks it, without installing it: its manifest, that it works with this
 * Glassboard, and that it doesn't replace a built-in plugin. The download is kept for a while,
 * so the plugin installed after a look at the preview is exactly the one looked at.
 * @param {string} input - The repository, as typed (see parseSource).
 * @param {Object} options
 * @param {import('./host.js').PluginHost} options.host - The plugin host.
 * @param {string} [options.dir] - The plugins folder.
 * @param {typeof fetch} [options.fetchImpl] - Fetch, for tests.
 * @param {string} [options.updating] - The plugin being updated: the download must be it, and a
 *   release whose code changed since it was installed is refused.
 * @returns {Promise<Object>} What the settings window shows: the plugin, its repository and
 *   release, the archive's hash, the installed version, and `preview`, to install it with.
 * @throws {HttpError} Saying what is wrong; nothing is changed.
 */
export async function previewPlugin(input, { host, dir = pluginsDir(), fetchImpl = globalThis.fetch, updating }) {
    const source = parseSource(input);
    const plan = await resolveDownload(source, fetchImpl);
    let archive;
    let files;
    try {
        archive = await download(plan.url, fetchImpl);
        files = untarGz(archive);
    } catch (err) {
        if (err instanceof HttpError) throw err;
        throw new HttpError(422, err instanceof Error ? err.message : String(err));
    }
    if (!files.has(MANIFEST_FILE)) throw new HttpError(422, `${source.owner}/${source.repo} has no ${MANIFEST_FILE} at its top, so it isn't a Glassboard plugin`);

    let id;
    try {
        id = JSON.parse(files.get(MANIFEST_FILE).toString('utf-8')).id;
    } catch {
        throw new HttpError(422, `${MANIFEST_FILE} is not valid JSON`);
    }
    if (typeof id !== 'string' || !PLUGIN_ID.test(id) || RESERVED_IDS.has(id)) throw new HttpError(422, `${MANIFEST_FILE} has no usable id`);
    if (host.find(id)?.builtIn) throw new HttpError(409, `${id} is built into Glassboard and can't be replaced`);
    if (updating && id !== updating) throw new HttpError(409, `${source.owner}/${source.repo} now has the plugin ${id}, not ${updating}`);

    // Checked in a folder of its own, removed right after
    fs.mkdirSync(dir, { recursive: true });
    const check = path.join(dir, tempName('check', id));
    let manifest;
    try {
        writeFiles(check, files);
        manifest = readManifest(check);
    } catch (err) {
        throw new HttpError(422, err instanceof Error ? err.message : String(err));
    } finally {
        fs.rmSync(check, { recursive: true, force: true });
    }

    const sha256 = crypto.createHash('sha256').update(archive).digest('hex');
    const [commit, repository] = await Promise.all([commitOf(source, plan.ref, fetchImpl), repositoryInfo(source, fetchImpl)]);
    const installed = installedSource(dir, id);
    const loaded = host.find(id);

    let upToDate = false;
    if (installed && installed.url === source.url && installed.ref === plan.ref) {
        // The same release again: it must be the same code, or the tag was moved
        const commitChanged = Boolean(installed.commit && commit && installed.commit !== commit);
        const assetChanged = plan.kind === 'asset' && installed.kind === 'asset' && Boolean(installed.sha256) && installed.sha256 !== sha256;
        if (commitChanged || assetChanged) {
            throw new HttpError(409, `${plan.ref} of ${source.owner}/${source.repo} is no longer the code that was installed: it was changed after its release. Check the repository before installing it again.`);
        }
        upToDate = true;
    }

    const preview = crypto.randomBytes(16).toString('hex');
    const summary = {
        preview,
        upToDate,
        plugin: {
            id,
            name: manifest.name,
            version: manifest.version,
            description: manifest.description,
            glassboard: manifest.glassboard,
            hasServer: Boolean(manifest.server),
            hasClient: Boolean(manifest.client),
        },
        repository: { url: source.url, ...repository },
        release: { ref: plan.ref, kind: plan.kind, commit, ...(plan.release || {}) },
        sha256,
        installed: installed || loaded
            ? { version: loaded && 'version' in loaded ? loaded.version : undefined, ref: installed?.ref, commit: installed?.commit ?? null, url: installed?.url }
            : null,
    };

    const now = Date.now();
    for (const [key, p] of previews) if (p.expires < now) previews.delete(key);
    while (previews.size >= MAX_PREVIEWS) previews.delete(previews.keys().next().value);
    previews.set(preview, {
        id,
        expires: now + PREVIEW_TTL_MS,
        archive,
        pin: { url: source.url, ref: plan.ref, kind: plan.kind, commit, sha256 },
        summary,
    });
    return summary;
}

/**
 * Looks at the newest release of an installed plugin, from where it was installed from, before
 * updating it.
 * @param {string} id - The plugin.
 * @param {Object} options - As for previewPlugin.
 * @param {import('./host.js').PluginHost} options.host
 * @param {string} [options.dir]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<Object>} The preview.
 * @throws {HttpError} 404 for a plugin that wasn't installed from a repository.
 */
export async function previewUpdate(id, options) {
    const dir = options.dir ?? pluginsDir();
    const source = PLUGIN_ID.test(String(id)) ? installedSource(dir, String(id)) : null;
    if (!source) throw new HttpError(404, `${id} wasn't installed from a repository, so it can't be updated here`);
    // The newest release, not the ref it was installed from
    return previewPlugin(source.url, { ...options, dir, updating: String(id) });
}

/**
 * @typedef {Object} InstallResult
 * @property {Object} plugin - The plugin as the plugins list shows it.
 * @property {boolean} updated - Whether it replaced an installed version.
 * @property {boolean} restartRecommended - The old version's server part may still be running
 *   until Glassboard restarts.
 */

/**
 * Installs a plugin that was looked at with previewPlugin, from the very files downloaded then,
 * and loads it. An update replaces the installed version only once the new one has loaded; if it
 * doesn't, the old one is put back. Where it came from, with the commit and the archive's hash,
 * is kept with it, so an update can tell when a release was changed.
 * @param {string} previewId - The preview.
 * @param {Object} options
 * @param {import('./host.js').PluginHost} options.host - The plugin host.
 * @param {string} [options.dir] - The plugins folder.
 * @returns {Promise<InstallResult>} What was installed.
 * @throws {HttpError} Saying what went wrong; nothing is changed then.
 */
export async function installPreview(previewId, { host, dir = pluginsDir() }) {
    return serialized(async () => {
        const found = previews.get(String(previewId));
        previews.delete(String(previewId));
        if (!found || found.expires < Date.now()) throw new HttpError(410, 'This preview has expired; look at the plugin again');
        const { id, archive, pin } = found;
        const files = untarGz(archive);
        const existing = host.find(id);
        if (existing?.builtIn) throw new HttpError(409, `${id} is built into Glassboard and can't be replaced`);

        fs.mkdirSync(dir, { recursive: true });
        const staging = path.join(dir, tempName('install', id));
        const target = path.join(dir, id);
        const backup = fs.existsSync(target) ? path.join(dir, tempName('old', id)) : null;
        try {
            writeFiles(staging, files);
            try {
                readManifest(staging);
            } catch (err) {
                throw new HttpError(422, err instanceof Error ? err.message : String(err));
            }
            fs.writeFileSync(path.join(staging, SOURCE_FILE), JSON.stringify({ ...pin, installedAt: new Date().toISOString() }, null, 2));

            const hadServer = Boolean(existing && 'hasServer' in existing && existing.hasServer);
            unloadPlugin(host, id);
            if (backup) fs.renameSync(target, backup);
            fs.renameSync(staging, target);

            if (!(await loadPluginFolder(host, target))) {
                const failure = host.failed.find(f => f.id === id);
                const error = failure?.error ?? 'It failed to load';
                unloadPlugin(host, id);
                fs.rmSync(target, { recursive: true, force: true });
                if (backup) {
                    fs.renameSync(backup, target);
                    await loadPluginFolder(host, target);
                }
                throw new HttpError(422, `${id} was not installed: ${error}`);
            }
            if (backup) fs.rmSync(backup, { recursive: true, force: true });
            return { plugin: host.find(id), updated: Boolean(backup), restartRecommended: Boolean(backup) && hadServer };
        } finally {
            fs.rmSync(staging, { recursive: true, force: true });
        }
    });
}

/**
 * Removes a plugin from the plugins folder and unloads it. Plugins built into Glassboard
 * can't be removed.
 * @param {string} id - The plugin.
 * @param {Object} options
 * @param {import('./host.js').PluginHost} options.host - The plugin host.
 * @param {string} [options.dir] - The plugins folder.
 * @returns {Promise<{restartRecommended: boolean}>} Whether its server part may still be
 *   running until Glassboard restarts.
 * @throws {HttpError} 404 for an unknown plugin, 409 for a built-in one.
 */
export async function removePlugin(id, { host, dir = pluginsDir() }) {
    return serialized(async () => {
        const known = host.find(String(id));
        if (known?.builtIn) throw new HttpError(409, `${id} is built into Glassboard and can't be removed`);
        const target = path.join(dir, String(id));
        if (!PLUGIN_ID.test(String(id)) || !fs.existsSync(target)) throw new HttpError(404, `No plugin ${id} in the plugins folder`);
        const hadServer = Boolean(known && 'hasServer' in known && known.hasServer && host.ids.includes(id));
        unloadPlugin(host, id);
        fs.rmSync(target, { recursive: true, force: true });
        return { restartRecommended: hadServer };
    });
}
