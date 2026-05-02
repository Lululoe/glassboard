
import { getConfigGit } from '../config.js';
import fetch from 'node-fetch';
import logger from '../logger.js';



/**
 * Validates and normalizes the repository config.
 * @param {Object} repoConfig 
 */
function normalizeRepo(repoConfig) {
    if (typeof repoConfig === 'string') {
        const parts = repoConfig.split('/');
        if (parts.length !== 2) {
            logger.warn(`Invalid repo format: ${repoConfig}`);
            return null;
        }
        const [owner, repo] = parts;

        // Strict validation: alphanumeric, hyphens, underscores, periods
        if (!/^[a-zA-Z0-9.\-_]+$/.test(owner) || !/^[a-zA-Z0-9.\-_]+$/.test(repo)) {
            logger.warn(`Invalid repo characters: ${repoConfig}`);
            return null;
        }

        return { type: 'github', owner, repo, id: repoConfig };
    }
    return repoConfig; // Expected { type, owner, repo, id, ... }
}

/**
 * Fetches pull requests from GitHub for a given repository.
 * @param {Object} repo - Repository configuration object.
 * @param {Object} credentials - Git credentials object.
 * @returns {Promise<Array>} List of mapped pull requests.
 */
async function fetchGithubPRs(repo, credentials) {
    try {
        const token = credentials.github?.token;
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Glassboard-Dashboard'
        };
        if (token) headers['Authorization'] = `token ${token}`;

        const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/pulls?state=all&per_page=10`;
        const response = await fetch(url, { headers });

        if (!response.ok) {
            logger.error(`GitHub API error for ${repo.owner}/${repo.repo}: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        return data.map(pr => ({
            id: pr.id,
            title: pr.title,
            repo: `${repo.owner}/${repo.repo}`,
            number: pr.number,
            state: pr.state === 'open' ? (pr.draft ? 'draft' : 'open') : pr.state, // GitHub uses 'open'/'closed' but logic needs refinement for merged
            merged: !!pr.merged_at,
            author: pr.user.login,
            updatedAt: new Date(pr.updated_at).toISOString(),
            url: pr.html_url,
            comments: pr.comments || 0, // GitHub list doesn't always include comment count, might need separate call or ignore
            labels: pr.labels ? pr.labels.map(l => l.name) : [],
            platform: 'github'
        })).map(pr => ({
            ...pr,
            state: pr.merged ? 'merged' : pr.state // Fix state for merged
        }));

    } catch (error) {
        logger.error('Error fetching GitHub PRs:', error);
        return [];
    }
}

/**
 * Fetches merge requests from GitLab for a given repository.
 * @param {Object} repo - Repository configuration object.
 * @param {Object} credentials - Git credentials object.
 * @returns {Promise<Array>} List of mapped merge requests.
 */
async function fetchGitlabMRs(repo, credentials) {
    try {
        const token = credentials.gitlab?.token;
        const baseUrl = credentials.gitlab?.url || 'https://gitlab.com';
        const headers = {};
        if (token) headers['PRIVATE-TOKEN'] = token;

        // GitLab needs project ID or URL-encoded path
        const projectPath = encodeURIComponent(`${repo.owner}/${repo.repo}`);
        const url = `${baseUrl}/api/v4/projects/${projectPath}/merge_requests?state=opened&per_page=10`; // Simplify to opened for now

        const response = await fetch(url, { headers });
        if (!response.ok) {
            logger.error(`GitLab API error: ${response.status}`);
            return [];
        }

        const data = await response.json();
        return data.map(mr => ({
            id: mr.id,
            title: mr.title,
            repo: `${repo.owner}/${repo.repo}`,
            number: mr.iid,
            state: mr.state === 'opened' ? (mr.work_in_progress ? 'draft' : 'open') : mr.state,
            author: mr.author.username,
            updatedAt: new Date(mr.updated_at).toISOString(),
            url: mr.web_url,
            comments: mr.user_notes_count,
            labels: mr.labels || [],
            platform: 'gitlab'
        }));
    } catch (e) {
        logger.error('Error fetching GitLab MRs:', e);
        return [];
    }
}

/**
 * Fetches pull requests from Gitea for a given repository.
 * @param {Object} repo - Repository configuration object.
 * @param {Object} credentials - Git credentials object.
 * @returns {Promise<Array>} List of mapped pull requests.
 */
async function fetchGiteaPRs(repo, credentials) {
    // Very similar to GitHub
    try {
        const token = credentials.gitea?.token;
        const baseUrl = credentials.gitea?.url || 'https://gitea.com'; // User needs to provide base URL if self-hosted
        const headers = { 'Accept': 'application/json' };
        if (token) headers['Authorization'] = `token ${token}`;

        const url = `${baseUrl}/api/v1/repos/${repo.owner}/${repo.repo}/pulls?state=open&limit=10`;

        const response = await fetch(url, { headers });
        if (!response.ok) return [];

        const data = await response.json();
        return data.map(pr => ({
            id: pr.id,
            title: pr.title,
            repo: `${repo.owner}/${repo.repo}`,
            number: pr.number,
            state: pr.state,
            author: pr.user.login,
            updatedAt: new Date(pr.updated_at).toISOString(),
            url: pr.html_url,
            comments: pr.comments,
            labels: pr.labels ? pr.labels.map(l => l.name) : [],
            platform: 'gitea'
        }));
    } catch (e) {
        logger.error('Error fetching Gitea PRs:', e);
        return [];
    }
}


/**
 * Handles Git requests.
 * @param {Object} params - The request parameters (query + body)
 */
export async function handleGitRequest(params) {
    // Check cache
    let reposToFetch = [];
    try {
        // Support 'repos' from query (stringified JSON) or body (direct array/object)
        let reposParam = params.repos;
        if (!reposParam && params.repositories) reposParam = params.repositories;

        if (typeof reposParam === 'string') {
            try {
                reposParam = JSON.parse(reposParam);
            } catch {
                // If simple string maybe comma separated?
            }
        }

        if (Array.isArray(reposParam)) {
            reposToFetch = reposParam.map(normalizeRepo).filter(r => r !== null);
        }
    } catch {
        // ignore parse error
        logger.error("Error parsing repos");
    }

    if (reposToFetch.length === 0) {
        // Return empty structure
        return { prs: [], stats: { count: 0, open: 0, review_requested: 0 } };
    }

    const credentials = getConfigGit();

    const results = await Promise.all(reposToFetch.map(repo => {
        if (repo.type === 'github') return fetchGithubPRs(repo, credentials);
        if (repo.type === 'gitlab') return fetchGitlabMRs(repo, credentials);
        if (repo.type === 'gitea') return fetchGiteaPRs(repo, credentials);
        return [];
    }));

    let prs = results.flat();

    // Sort by updated desc
    prs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Filter by labels if requested
    // params.labels can be a comma-separated string or array
    let allowedLabels = [];
    if (params.labels) {
        if (Array.isArray(params.labels)) allowedLabels = params.labels;
        else if (typeof params.labels === 'string') allowedLabels = params.labels.split(',').map(s => s.trim());
    }

    if (allowedLabels.length > 0) {
        prs = prs.filter(pr => {
            // Check if PR has at least one of the allowed labels
            if (!pr.labels || pr.labels.length === 0) return false;
            return pr.labels.some(label => allowedLabels.includes(label));
        });
    }

    // Filter by status if requested
    let allowedStatus = [];
    if (params.filterStatus || params.status) {
        const rawStatus = params.filterStatus || params.status;
        if (Array.isArray(rawStatus)) allowedStatus = rawStatus;
        else if (typeof rawStatus === 'string') allowedStatus = rawStatus.split(',').map(s => s.trim());
    }

    if (allowedStatus.length > 0) {
        prs = prs.filter(pr => allowedStatus.includes(pr.state));
    }

    const stats = {
        count: prs.length,
        open: prs.filter(p => p.state === 'open' || p.state === 'review_required').length,
        review_requested: prs.filter(p => p.state === 'review_required').length
    };

    return { prs, stats };
}
