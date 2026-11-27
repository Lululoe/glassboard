import { useEffect, useRef } from 'react';
import { Group } from '../Editor/EditorFields';

/**
 * A date as the settings window shows it, such as `12 Mar 2026`.
 * @param {string|undefined} iso - The date.
 * @returns {string|null} The text, or null without a date.
 */
const day = (iso) => {
    if (!iso) return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * What to check before installing a plugin: what it is, where it comes from, how long its
 * repository has been around, the exact commit and download, and what it runs. Nothing is
 * installed until it is confirmed, and then exactly this download.
 * @param {Object} props
 * @param {import('../../lib/api').PluginPreview} props.review - The preview.
 * @param {boolean} props.busy - Whether it is being installed.
 * @param {() => void} props.onConfirm - Installs it.
 * @param {() => void} props.onCancel - Drops it.
 * @returns {JSX.Element} The review.
 */
const PluginReview = ({ review, busy, onConfirm, onCancel }) => {
    const ref = useRef(/** @type {HTMLDivElement|null} */ (null));
    const { plugin, repository, release, sha256, installed } = review;
    const updating = Boolean(installed);
    const repoName = repository.url.replace(/^https:\/\/github\.com\//, '');
    const fromRelease = Boolean(release.url);

    useEffect(() => {
        ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }, [review.preview]);

    return (
        <div ref={ref}>
            <Group
                title={updating ? 'Review Update' : 'Review Plugin'}
                description="Check where it comes from before installing it. Glassboard installs exactly the download described here."
            >
                <div className="plugin-review">
                    <div className="plugin-item-head">
                        <span className="plugin-item-name">{plugin.name}</span>
                        <span className="plugin-item-version">
                            {installed?.version && installed.version !== plugin.version ? `${installed.version} → ${plugin.version}` : plugin.version}
                        </span>
                    </div>
                    {plugin.description && <p className="plugin-description">{plugin.description}</p>}

                    {plugin.hasServer && (
                        <p className="plugin-warning">
                            It runs code on the server, with access to every credential in services.yaml.
                        </p>
                    )}
                    {!fromRelease && (
                        <p className="plugin-warning">
                            It isn&apos;t from a release: this is the code on {release.ref} as it is right now.
                        </p>
                    )}
                    {repository.archived && <p className="plugin-warning">Its repository is archived, so it gets no more updates.</p>}

                    <dl className="plugin-facts">
                        <dt>Repository</dt>
                        <dd><a href={repository.url} target="_blank" rel="noreferrer noopener">{repoName}</a></dd>
                        {repository.stars !== undefined && (
                            <>
                                <dt>Stars</dt>
                                <dd>{repository.stars}</dd>
                            </>
                        )}
                        {day(repository.createdAt) && (
                            <>
                                <dt>Created</dt>
                                <dd>
                                    {day(repository.createdAt)}
                                    {repository.isNew && <span className="plugin-badge is-issue">New</span>}
                                </dd>
                            </>
                        )}
                        {day(repository.pushedAt) && (
                            <>
                                <dt>Last change</dt>
                                <dd>{day(repository.pushedAt)}</dd>
                            </>
                        )}
                        <dt>{fromRelease ? 'Release' : 'Branch'}</dt>
                        <dd>
                            {fromRelease ? <a href={release.url} target="_blank" rel="noreferrer noopener">{release.ref}</a> : release.ref}
                            {day(release.publishedAt) && <span>published {day(release.publishedAt)}</span>}
                        </dd>
                        <dt>Commit</dt>
                        <dd>
                            {release.commit
                                ? <a href={`${repository.url}/commit/${release.commit}`} target="_blank" rel="noreferrer noopener"><code>{release.commit.slice(0, 10)}</code></a>
                                : 'Unknown'}
                        </dd>
                        <dt>SHA-256</dt>
                        <dd><code title={sha256}>{sha256.slice(0, 16)}…</code></dd>
                        <dt>Runs</dt>
                        <dd>{plugin.hasClient && plugin.hasServer ? 'In the browser and on the server' : plugin.hasServer ? 'On the server' : 'In the browser'}</dd>
                    </dl>

                    {release.notes && (
                        <details className="plugin-notes">
                            <summary>Release notes</summary>
                            <pre>{release.notes}</pre>
                        </details>
                    )}

                    <div className="plugin-actions">
                        <button type="button" className="button-reset plugin-button" disabled={busy} onClick={onCancel}>Cancel</button>
                        <button type="button" className="button-reset plugin-button is-primary" disabled={busy} onClick={onConfirm}>
                            {busy ? (updating ? 'Updating…' : 'Installing…') : (updating ? `Update to ${plugin.version}` : 'Install')}
                        </button>
                    </div>
                </div>
            </Group>
        </div>
    );
};

export default PluginReview;
