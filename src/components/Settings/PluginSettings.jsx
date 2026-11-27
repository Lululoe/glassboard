import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Group } from '../Editor/EditorFields';
import Icon from '../Shared/Icon';
import { getCardInfo, usePluginFailures, usePlugins } from '../../features/registry';
import { installPlugin, listServerPlugins, previewPlugin, removePlugin } from '../../lib/api';
import { plural } from '../../lib/format';
import { loadExternalPlugin, unloadExternalPlugin } from '../../plugins/external';
import { mergePlugins, pluginIssues } from './pluginList';
import PluginReview from './PluginReview';
import './PluginSettings.css';

/**
 * What a plugin adds, in a few words.
 * @param {import('./pluginList').PluginRow} plugin - The plugin.
 * @returns {string} Such as `2 cards · 1 service`.
 */
const summaryOf = (plugin) => [
    plugin.cards.length > 0 && plural(plugin.cards.length, 'card'),
    plugin.services.length > 0 && plural(plugin.services.length, 'service'),
].filter(Boolean).join(' · ') || 'Adds nothing';

/** Where a part of a plugin runs, as the page says it. */
const WHERE = { browser: 'in the browser', server: 'on the server' };

/**
 * A repository URL shortened for display, such as `owner/repo`.
 * @param {string} url - The URL.
 * @returns {string} The short form.
 */
const shortSource = url => url.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\.git$/, '');

/**
 * @typedef {Object} PluginActions
 * @property {string|null} busy - The plugin being changed, or `'install'`.
 * @property {(id: string) => void} onUpdate - Looks for a plugin's newest version.
 * @property {(id: string) => void} onRemove - Removes a plugin.
 * @property {boolean} allowed - Whether plugins can be changed from here.
 */

/**
 * Update and Remove for a plugin from the plugins folder. Remove asks first.
 * @param {Object} props
 * @param {string} props.id - The plugin.
 * @param {string} props.name - Its name.
 * @param {boolean} props.canUpdate - Whether it knows where it came from.
 * @param {PluginActions} props.actions - What the buttons do.
 * @returns {JSX.Element|null} The buttons.
 */
const PluginButtons = ({ id, name, canUpdate, actions }) => {
    const [confirming, setConfirming] = useState(false);
    if (!actions.allowed) return null;
    const disabled = actions.busy !== null;
    if (confirming) {
        return (
            <div className="settings-confirm plugin-actions">
                <span>Remove {name}? Its cards stay in the layout until you delete them.</span>
                <button type="button" className="button-reset editor-dialog-action" onClick={() => setConfirming(false)}>Keep</button>
                <button
                    type="button"
                    className="button-reset editor-dialog-action destructive"
                    disabled={disabled}
                    onClick={() => { setConfirming(false); actions.onRemove(id); }}
                >
                    Remove
                </button>
            </div>
        );
    }
    return (
        <div className="plugin-actions">
            {canUpdate && (
                <button type="button" className="button-reset plugin-button" disabled={disabled} onClick={() => actions.onUpdate(id)}>
                    {actions.busy === id ? 'Checking…' : 'Update…'}
                </button>
            )}
            <button type="button" className="button-reset plugin-button is-danger" disabled={disabled} onClick={() => setConfirming(true)}>
                Remove
            </button>
        </div>
    );
};

/**
 * One plugin: its name, what it adds, its cards with their icons and its services, and a
 * warning when a part of it failed to load. Plugins from the plugins folder can be updated and
 * removed.
 * @param {Object} props
 * @param {import('./pluginList').PluginRow} props.plugin - The plugin.
 * @param {import('./pluginList').PluginIssue[]} props.issues - Parts of it that failed.
 * @param {PluginActions} props.actions - What its buttons do.
 * @returns {JSX.Element} The row.
 */
const PluginItem = ({ plugin, issues, actions }) => (
    <li className={`plugin-item${issues.length ? ' has-issue' : ''}`}>
        <div className="plugin-item-head">
            <span className="plugin-item-name">{plugin.name}</span>
            {plugin.version && <span className="plugin-item-version">{plugin.version}</span>}
            {plugin.builtIn && <span className="plugin-badge">Built in</span>}
            {issues.length > 0 && <span className="plugin-badge is-issue">Partly loaded</span>}
            <span className="plugin-item-summary">{summaryOf(plugin)}</span>
        </div>
        {plugin.description && <p className="plugin-description">{plugin.description}</p>}
        {plugin.source && (
            <p className="plugin-source">
                From <a href={plugin.source.url} target="_blank" rel="noreferrer noopener">{shortSource(plugin.source.url)}</a>
                {plugin.source.ref && <> at {plugin.source.ref}</>}
            </p>
        )}
        {issues.map(issue => (
            <p key={issue.where} className="plugin-error">
                Not loaded {WHERE[issue.where]}: {issue.error}
            </p>
        ))}
        {(plugin.cards.length > 0 || plugin.services.length > 0) && (
            <ul className="plugin-chips" aria-label={`What ${plugin.name} adds`}>
                {plugin.cards.map((type) => {
                    const info = getCardInfo(type);
                    return (
                        <li key={`card-${type}`} className="plugin-chip" title={`Card type: ${type}`}>
                            {info?.icon && <Icon icon={info.icon} size={14} />}
                            <span>{info?.name || type}</span>
                        </li>
                    );
                })}
                {plugin.services.map(name => (
                    <li key={`service-${name}`} className="plugin-chip is-service" title="Server service">
                        {name}
                    </li>
                ))}
            </ul>
        )}
        {plugin.external && <PluginButtons id={plugin.id} name={plugin.name} canUpdate={Boolean(plugin.source)} actions={actions} />}
    </li>
);

/**
 * The form that installs a plugin from a GitHub repository. When installing is turned off, it
 * says how to turn it on instead.
 * @param {Object} props
 * @param {{allowed: boolean, reason: string|null, folder: string}|undefined} props.install - What the server allows.
 * @param {boolean} props.busy - Whether a change is running.
 * @param {(source: string) => Promise<boolean>} props.onInstall - Looks the plugin up; resolves to whether it worked.
 * @returns {JSX.Element} The group.
 */
const AddPlugin = ({ install, busy, onInstall }) => {
    const id = useId();
    const [source, setSource] = useState('');
    const allowed = Boolean(install?.allowed);

    const submit = async (e) => {
        e.preventDefault();
        if (!source.trim() || busy) return;
        if (await onInstall(source.trim())) setSource('');
    };

    return (
        <Group
            title="Add Plugin"
            description="Installs a plugin from a GitHub repository, from its latest release. You can check where it comes from before it is installed. Plugins run with full access to the dashboard and its credentials, so only install plugins you trust."
        >
            {install && !allowed && (
                <p className="plugin-note">
                    {install.reason || 'Installing plugins is turned off.'} You can also copy a plugin into {install.folder || 'the plugins folder'} and restart Glassboard.
                </p>
            )}
            <form className="plugin-install" onSubmit={submit}>
                <label htmlFor={id} className="visually-hidden">GitHub repository</label>
                <input
                    id={id}
                    className="editor-input"
                    type="text"
                    value={source}
                    placeholder="owner/repository"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={!allowed}
                    onChange={e => setSource(e.target.value)}
                />
                <button type="submit" className="button-reset plugin-button is-primary" disabled={!allowed || busy || !source.trim()}>
                    {busy ? 'Checking…' : 'Review'}
                </button>
            </form>
            {allowed && <p className="plugin-hint">Such as owner/repository, its URL, or owner/repository@v1.2.0 for a version.</p>}
        </Group>
    );
};

/**
 * Plugins section of the settings window: a form to install plugins from GitHub, the plugins
 * that failed to load and why, then every plugin the dashboard has loaded, with the cards it
 * adds in the browser and the services it adds on the server. Changes here happen at once,
 * not with Done.
 * @returns {JSX.Element} The section.
 */
const PluginSettings = () => {
    const client = usePlugins();
    const clientFailures = usePluginFailures();
    const [server, setServer] = useState(/** @type {Awaited<ReturnType<typeof listServerPlugins>>|null} */ (null));
    const [error, setError] = useState(/** @type {string|null} */ (null));
    const [busy, setBusy] = useState(/** @type {string|null} */ (null));
    const [status, setStatus] = useState(/** @type {{kind: 'done'|'error', text: string}|null} */ (null));
    const [review, setReview] = useState(/** @type {import('../../lib/api').PluginPreview|null} */ (null));
    const statusRef = useRef(/** @type {HTMLParagraphElement|null} */ (null));

    // The result shows at the top, which is out of sight after a change further down the list
    useEffect(() => {
        if (status) statusRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }, [status]);

    const refresh = useCallback(() => listServerPlugins()
        .then((data) => { setServer(data); setError(null); })
        .catch((err) => { setError(err instanceof Error ? err.message : String(err)); }), []);

    useEffect(() => {
        let cancelled = false;
        listServerPlugins()
            .then((data) => { if (!cancelled) setServer(data); })
            .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
        return () => { cancelled = true; };
    }, []);

    /**
     * Runs a change, then loads the plugins list again and says how it went.
     * @param {string} key - What is busy.
     * @param {() => Promise<string|null>} action - The change; resolves to what to say, if anything.
     * @returns {Promise<boolean>} Whether it worked.
     */
    const run = async (key, action) => {
        setBusy(key);
        setStatus(null);
        try {
            const text = await action();
            setStatus(text ? { kind: 'done', text } : null);
            return true;
        } catch (err) {
            setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
            return false;
        } finally {
            await refresh();
            setBusy(null);
        }
    };

    /**
     * Loads what was installed in the browser and words the result.
     * @param {{plugin: Object, updated: boolean, restartRecommended: boolean}} result - What the server installed.
     * @returns {Promise<string>} What to say.
     */
    const loaded = async ({ plugin, updated, restartRecommended }) => {
        const ok = await loadExternalPlugin(plugin, { replace: updated });
        const name = `${plugin.name || plugin.id} ${plugin.version || ''}`.trim();
        let text = `${updated ? 'Updated' : 'Installed'} ${name}.`;
        if (!ok) text += ' Its browser part failed to load, see below.';
        if (restartRecommended) text += ' Restart Glassboard to finish updating its server part.';
        return text;
    };

    /** @type {PluginActions} */
    const actions = {
        busy,
        allowed: Boolean(server?.install?.allowed),
        onUpdate: id => run(id, async () => {
            const found = await previewPlugin({ id });
            if (found.upToDate) return `${found.plugin.name} ${found.plugin.version} is the newest release.`;
            setReview(found);
            return null;
        }),
        onRemove: id => run(id, async () => {
            if (review?.plugin.id === id) setReview(null);
            await removePlugin(id);
            unloadExternalPlugin(id);
            return 'Removed the plugin.';
        }),
    };

    const plugins = mergePlugins(client, server?.plugins ?? []);
    const issues = pluginIssues(clientFailures, server?.failed ?? [], plugins);
    const notLoaded = issues.filter(issue => !issue.partly);

    return (
        <div className="settings-form">
            <AddPlugin
                install={server?.install}
                busy={busy === 'install'}
                onInstall={source => run('install', async () => {
                    setReview(null);
                    const found = await previewPlugin({ source });
                    if (found.upToDate) return `${found.plugin.name} ${found.plugin.version} is already installed.`;
                    setReview(found);
                    return null;
                })}
            />
            {review && (
                <PluginReview
                    review={review}
                    busy={busy === 'confirm'}
                    onCancel={() => setReview(null)}
                    onConfirm={() => run('confirm', async () => {
                        // A preview can be installed once, whether that works or not
                        let result;
                        try {
                            result = await installPlugin(review.preview);
                        } finally {
                            setReview(null);
                        }
                        return loaded(result);
                    })}
                />
            )}
            {status && (
                <p ref={statusRef} className={`plugin-status is-${status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'}>
                    {status.text}
                </p>
            )}
            {notLoaded.length > 0 && (
                <Group
                    title="Couldn't Load"
                    description="These plugins failed to load and were skipped. The rest of the dashboard works without them."
                >
                    <ul className="plugin-list" role="alert">
                        {notLoaded.map(issue => (
                            <li key={`${issue.where}-${issue.id}`} className="plugin-item has-issue">
                                <div className="plugin-item-head">
                                    <span className="plugin-item-name">{issue.name}</span>
                                    {issue.builtIn && <span className="plugin-badge">Built in</span>}
                                    <span className="plugin-item-summary">Failed {WHERE[issue.where]}</span>
                                </div>
                                <p className="plugin-error">{issue.error}</p>
                                {issue.external && issue.where === 'server' && (
                                    <PluginButtons id={issue.id} name={issue.name} canUpdate={false} actions={actions} />
                                )}
                            </li>
                        ))}
                    </ul>
                </Group>
            )}
            <Group
                title="Loaded Plugins"
                description="Every card and server service comes from a plugin. Built-in plugins come with Glassboard."
            >
                {error && <p className="plugin-note" role="alert">Couldn&apos;t load the server&apos;s plugins: {error}</p>}
                {!server && !error && <p className="plugin-note">Loading the server&apos;s plugins…</p>}
                <ul className="plugin-list">
                    {plugins.map(plugin => (
                        <PluginItem
                            key={plugin.id}
                            plugin={plugin}
                            issues={issues.filter(issue => issue.partly && issue.id === plugin.id)}
                            actions={actions}
                        />
                    ))}
                </ul>
            </Group>
        </div>
    );
};

export default PluginSettings;
