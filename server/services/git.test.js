// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setConfig } from '../config.js';
import { clearGitCache, handleGitRequest, normalizeRepo } from './git.js';

const githubPr = (overrides) => ({
    id: 1, title: 'PR', number: 1, state: 'open', draft: false, merged_at: null,
    user: { login: 'me' }, updated_at: '2026-01-01T00:00:00Z', html_url: 'https://github.com/x', labels: [],
    ...overrides,
});

describe('normalizeRepo', () => {
    it('accepts valid repositories', () => {
        expect(normalizeRepo('owner/repo')).toEqual({ type: 'github', owner: 'owner', repo: 'repo' });
        expect(normalizeRepo({ type: 'gitlab', owner: 'group/sub', repo: 'r' }))
            .toEqual({ type: 'gitlab', owner: 'group/sub', repo: 'r' });
    });

    it('rejects path traversal and unknown platforms', () => {
        expect(normalizeRepo({ owner: '..', repo: '../../user' })).toBeNull();
        expect(normalizeRepo({ type: 'github', owner: 'a/b', repo: 'c' })).toBeNull();
        expect(normalizeRepo({ type: 'svn', owner: 'a', repo: 'b' })).toBeNull();
        expect(normalizeRepo('just-a-repo')).toBeNull();
    });
});

describe('handleGitRequest', () => {
    beforeEach(() => {
        clearGitCache();
        setConfig({
            services: { git: { github: { token: 'gh-token' } } },
            pages: [{ cards: [{ id: 'prs', type: 'git', repositories: ['me/app'], filterStatus: ['open', 'merged'] }] }],
        });
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            json: async () => [
                githubPr({ id: 1, state: 'open', updated_at: '2026-01-01T00:00:00Z' }),
                githubPr({ id: 2, state: 'closed', merged_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' }),
                githubPr({ id: 3, state: 'closed', updated_at: '2026-01-03T00:00:00Z' }),
            ],
        })));
    });

    it('reads repositories and filters from the card, not the request', async () => {
        const result = await handleGitRequest({ cardId: 'prs', repos: ['victim/private'] });

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0][0]).toContain('/repos/me/app/pulls');
        expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer gh-token');
        expect(result.prs.map(pr => pr.state)).toEqual(['merged', 'open']);
        expect(result.stats).toEqual({ count: 2, open: 1 });
    });

    it('returns 404 for unknown or non-git cards', async () => {
        await expect(handleGitRequest({ cardId: 'nope' })).rejects.toMatchObject({ status: 404 });
        await expect(handleGitRequest({})).rejects.toMatchObject({ status: 404 });
    });

    it('caches results per card', async () => {
        await handleGitRequest({ cardId: 'prs' });
        await handleGitRequest({ cardId: 'prs' });
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});
