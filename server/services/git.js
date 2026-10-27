import { findCard, getServiceConfig } from '../config.js';
import { HttpError } from '../errors.js';
import logger from '../logger.js';

const CACHE_DURATION = 60 * 1000;
const SEGMENT = /^[a-zA-Z0-9._-]+$/;
const GROUP_PATH = /^[a-zA-Z0-9._-]+(\/[a-zA-Z0-9._-]+)*$/;
const PLATFORMS = new Set(['github', 'gitlab', 'gitea']);
const cache = new Map();

/**
 * Validates and normalizes a repository entry from a git card.
 * Accepts "owner/repo" strings (GitHub) or `{ type, owner, repo }` objects.
 * GitLab owners may contain nested groups ("group/subgroup").
 * @param {string|Object} entry - Repository config.
 * @returns {{type: string, owner: string, repo: string}|null} Normalized repo, or null if invalid.
 */
export function normalizeRepo(entry) {
    let repo = entry;
    if (typeof entry === 'string') {
        const parts = entry.split('/');
        repo = { type: 'github', owner: parts.slice(0, -1).join('/'), repo: parts[parts.length - 1] };
    }
    const type = String(repo?.type || 'github').toLowerCase();
    const owner = String(repo?.owner || '');
    const name = String(repo?.repo || '');
    const ownerPattern = type === 'gitlab' ? GROUP_PATH : SEGMENT;

    if (!PLATFORMS.has(type) || !ownerPattern.test(owner) || !SEGMENT.test(name)) {
        logger.warn(`Ignoring invalid git repository: ${JSON.stringify(entry)}`);
        return null;
    }
    return { type, owner, repo: name };
}

/**
 * Resolves credentials and base URLs for every git platform.
 * @returns {Object<string, {token?: string, url?: string}>} Settings keyed by platform.
 */
function getGitCredentials() {
    return {
        github: getServiceConfig(['git.github', 'github'], { token: { env: ['GITHUB_TOKEN'] } }),
        gitlab: getServiceConfig(['git.gitlab', 'gitlab'], {
            token: { env: ['GITLAB_TOKEN'] },
            url: { env: ['GITLAB_URL'], default: 'https://gitlab.com' },
        }),
        gitea: getServiceConfig(['git.gitea', 'gitea'], {
            token: { env: ['GITEA_TOKEN'] },
            url: { env: ['GITEA_URL'], default: 'https://gitea.com' },
        }),
    };
}

/**
 * Fetches JSON from a git API, logging and returning null on failure.
 * @param {string} url - Request URL.
 * @param {Object} headers - Request headers.
 * @param {string} label - Label used in log messages.
 * @returns {Promise<Array|null>} Parsed JSON or null.
 */
async function fetchJson(url, headers, label) {
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            logger.error(`${label} API error: ${response.status} ${response.statusText}`);
            return null;
        }
        return await response.json();
    } catch (e) {
        logger.error(`${label} request failed: ${e.message}`);
        return null;
    }
}

const fetchers = {
    /**
     * Fetches the latest pull requests from GitHub.
     * @param {Object} repo - Normalized repository.
     * @param {Object} creds - GitHub settings.
     * @returns {Promise<Array<Object>>} Mapped pull requests.
     */
    async github(repo, creds) {
        const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'Glassboard-Dashboard' };
        if (creds.token) headers.Authorization = `Bearer ${creds.token}`;
        const data = await fetchJson(
            `https://api.github.com/repos/${repo.owner}/${repo.repo}/pulls?state=all&per_page=10`,
            headers, 'GitHub') || [];
        return data.map(pr => ({
            id: `github-${pr.id}`,
            title: pr.title,
            number: pr.number,
            state: pr.merged_at ? 'merged' : pr.state === 'open' && pr.draft ? 'draft' : pr.state,
            author: pr.user?.login,
            updatedAt: pr.updated_at,
            url: pr.html_url,
            comments: pr.comments || 0,
            labels: (pr.labels || []).map(l => l.name),
        }));
    },

    /**
     * Fetches open merge requests from GitLab.
     * @param {Object} repo - Normalized repository.
     * @param {Object} creds - GitLab settings.
     * @returns {Promise<Array<Object>>} Mapped merge requests.
     */
    async gitlab(repo, creds) {
        const headers = creds.token ? { 'PRIVATE-TOKEN': creds.token } : {};
        const project = encodeURIComponent(`${repo.owner}/${repo.repo}`);
        const data = await fetchJson(
            `${creds.url.replace(/\/$/, '')}/api/v4/projects/${project}/merge_requests?state=opened&per_page=10`,
            headers, 'GitLab') || [];
        return data.map(mr => ({
            id: `gitlab-${mr.id}`,
            title: mr.title,
            number: mr.iid,
            state: mr.state === 'opened' ? ((mr.draft ?? mr.work_in_progress) ? 'draft' : 'open') : mr.state,
            author: mr.author?.username,
            updatedAt: mr.updated_at,
            url: mr.web_url,
            comments: mr.user_notes_count || 0,
            labels: mr.labels || [],
        }));
    },

    /**
     * Fetches open pull requests from Gitea.
     * @param {Object} repo - Normalized repository.
     * @param {Object} creds - Gitea settings.
     * @returns {Promise<Array<Object>>} Mapped pull requests.
     */
    async gitea(repo, creds) {
        const headers = { Accept: 'application/json' };
        if (creds.token) headers.Authorization = `token ${creds.token}`;
        const data = await fetchJson(
            `${creds.url.replace(/\/$/, '')}/api/v1/repos/${repo.owner}/${repo.repo}/pulls?state=open&limit=10`,
            headers, 'Gitea') || [];
        return data.map(pr => ({
            id: `gitea-${pr.id}`,
            title: pr.title,
            number: pr.number,
            state: pr.merged ? 'merged' : pr.draft ? 'draft' : pr.state,
            author: pr.user?.login,
            updatedAt: pr.updated_at,
            url: pr.html_url,
            comments: pr.comments || 0,
            labels: (pr.labels || []).map(l => l.name),
        }));
    },
};

/**
 * Converts a list option (array or comma-separated string) to an array.
 * @param {string|string[]|undefined} value - Raw option.
 * @returns {string[]} List of values.
 */
function toList(value) {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean);
    return [];
}

/**
 * Returns pull requests for the repositories configured on a git card.
 * The repository list and filters are read from the server-side card config, never from
 * the request, so the configured tokens can only be used for the configured repositories.
 * Results are cached per card for one minute to stay within API rate limits.
 * @param {Object} params
 * @param {string} params.cardId - Id of the git card.
 * @returns {Promise<{prs: Array<Object>, stats: {count: number, open: number}}>}
 */
export async function handleGitRequest({ cardId }) {
    const card = cardId !== undefined ? findCard(cardId) : undefined;
    if (!card || card.type !== 'git') throw new HttpError(404, `Git card not found: ${cardId}`);

    const cached = cache.get(card.id);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.data;

    const repos = (card.repositories || card.repos || []).map(normalizeRepo).filter(Boolean);
    const credentials = getGitCredentials();
    const results = await Promise.all(repos.map(async repo => {
        const prs = await fetchers[repo.type](repo, credentials[repo.type]);
        return prs.map(pr => ({ ...pr, repo: `${repo.owner}/${repo.repo}`, platform: repo.type }));
    }));

    const labels = toList(card.filterLabels || card.labels);
    const statuses = toList(card.filterStatus || card.status);
    const prs = results.flat()
        .filter(pr => labels.length === 0 || pr.labels.some(l => labels.includes(l)))
        .filter(pr => statuses.length === 0 || statuses.includes(pr.state))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

    const data = {
        prs,
        stats: { count: prs.length, open: prs.filter(p => p.state === 'open').length },
    };
    cache.set(card.id, { timestamp: Date.now(), data });
    return data;
}

/**
 * Clears the pull request cache. Intended for tests.
 */
export function clearGitCache() {
    cache.clear();
}
