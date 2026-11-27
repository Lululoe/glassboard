import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installPlugin, listServerPlugins, previewPlugin, removePlugin } from '../../lib/api';
import { loadExternalPlugin, unloadExternalPlugin } from '../../plugins/external';
import PluginSettings from './PluginSettings';
import { mergePlugins, pluginIssues } from './pluginList';
import { loadPlugins } from '../../plugins/registry';
// Registers the built-in plugins
import '../../features/registry';

vi.mock('../../lib/api', () => ({
    listServerPlugins: vi.fn(async () => ({
        plugins: [
            { id: 'core', services: ['homeassistant', 'weather'], routes: false, builtIn: true },
            { id: 'vacuum', services: ['vacuum'], routes: true, builtIn: true },
        ],
        failed: [
            { id: 'broken', error: 'Plugin broken has no setup function', builtIn: false },
            // The vacuum cards loaded, but not their service
            { id: 'vacuum', error: 'Cannot read the robots', builtIn: true },
        ],
        install: { allowed: false, reason: 'Set plugins.install: true in config.yaml to install plugins here.', folder: '/app/plugins' },
    })),
    installPlugin: vi.fn(),
    previewPlugin: vi.fn(),
    removePlugin: vi.fn(async () => ({ removed: true })),
}));

vi.mock('../../plugins/external', () => ({
    loadExternalPlugin: vi.fn(async () => true),
    unloadExternalPlugin: vi.fn(),
}));

const HELLO = {
    id: 'hello', name: 'Hello', version: '1.0.0', description: 'Says hello', services: ['hello'], builtIn: false, external: true,
    source: { url: 'https://github.com/someone/glassboard-hello', ref: 'v1.0.0' },
    client: '/_plugins/hello/client.js?v=1', style: null,
};

/**
 * A preview of the Hello plugin, as the server answers it.
 * @param {Object} [changes] - Fields to change.
 */
const preview = (changes = {}) => ({
    preview: 'p1',
    upToDate: false,
    plugin: { id: 'hello', name: 'Hello', version: '1.0.0', description: 'Says hello', glassboard: '^2.0.0', hasServer: true, hasClient: true },
    repository: { url: 'https://github.com/someone/glassboard-hello', owner: 'someone', stars: 3, createdAt: '2026-11-20T00:00:00Z', pushedAt: '2026-11-21T00:00:00Z', archived: false, isNew: true },
    release: { ref: 'v1.0.0', kind: 'asset', commit: 'c0ffee'.padEnd(40, '0'), url: 'https://github.com/someone/glassboard-hello/releases/tag/v1.0.0', notes: 'First release' },
    sha256: 'ab'.repeat(32),
    installed: null,
    ...changes,
});

/** The server's plugins, with installing allowed and the Hello plugin installed. */
const withHello = () => ({ plugins: [HELLO], failed: [], install: { allowed: true, reason: null, folder: '/app/plugins' } });

const itemOf = (name) => screen.getByText(name, { selector: '.plugin-item-name' }).closest('li');

describe('PluginSettings', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('joins the browser and server plugins by id', () => {
        const rows = mergePlugins(
            [{ id: 'vacuum', name: 'Vacuum', cards: ['vacuum'], builtIn: true }, { id: 'spacer', name: 'Empty Space', cards: ['spacer'], builtIn: true }],
            [{ id: 'vacuum', services: ['vacuum'], builtIn: true }, { id: 'core', services: ['weather'], builtIn: true }, { id: 'extra', services: [], builtIn: false }],
        );
        expect(rows).toEqual([
            { id: 'vacuum', name: 'Vacuum', builtIn: true, cards: ['vacuum'], services: ['vacuum'], external: false, source: null },
            { id: 'spacer', name: 'Empty Space', builtIn: true, cards: ['spacer'], services: [], external: false },
            { id: 'core', name: 'Core', builtIn: true, cards: [], services: ['weather'], external: false, source: null },
            { id: 'extra', name: 'extra', builtIn: false, cards: [], services: [], external: false, source: null },
        ]);
    });

    it('lists what failed to load, in the browser or on the server, and whether its other part loaded', () => {
        const rows = [{ id: 'vacuum', name: 'Vacuum', builtIn: true, cards: ['vacuum'], services: [] }];
        expect(pluginIssues(
            [{ id: 'bad-card', name: 'Bad Card', error: 'no Component', builtIn: false }],
            [
                { id: 'vacuum', error: 'Cannot read the robots', builtIn: true },
                { id: 'core', error: 'boom', builtIn: true },
                { id: 'bad-card', error: 'no service', builtIn: false, external: true },
            ],
            rows,
        )).toEqual([
            { id: 'bad-card', name: 'Bad Card', where: 'browser', error: 'no Component', builtIn: false, partly: false, external: true },
            { id: 'vacuum', name: 'Vacuum', where: 'server', error: 'Cannot read the robots', builtIn: true, partly: true, external: false },
            { id: 'core', name: 'Core', where: 'server', error: 'boom', builtIn: true, partly: false, external: false },
            { id: 'bad-card', name: 'Bad Card', where: 'server', error: 'no service', builtIn: false, partly: false, external: true },
        ]);
    });

    it('lists every loaded plugin with its cards and services, and those that failed', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        loadPlugins([
            { id: 'bad-register', name: 'Bad Register', register() { throw new Error('Something went wrong in register'); } },
            { id: 'bad-clash', name: 'Bad Clash', register: api => api.registerCard('weather', { Component: () => null, name: 'X', icon: 'lu-Bug' }) },
            { id: 'bad-card', name: 'Bad Card', register: api => api.registerCard('bad_card', { name: 'Bad Card', icon: 'lu-Bug' }) },
            { name: 'Nameless', register() {} },
        ]);
        consoleError.mockRestore();
        render(<PluginSettings />);
        expect(await screen.findByText('Core')).toBeInTheDocument();

        const vacuum = itemOf('Vacuum');
        expect(within(vacuum).getByText('Built in')).toBeInTheDocument();
        expect(within(vacuum).getByText('2 cards · 1 service')).toBeInTheDocument();
        expect(within(vacuum).getByText('Multiple Vacuums')).toBeInTheDocument();
        expect(within(vacuum).getByText('vacuum', { selector: '.is-service' })).toBeInTheDocument();

        expect(within(itemOf('Core')).getByText('2 services')).toBeInTheDocument();
        expect(within(itemOf('Empty Space')).getByText('1 card')).toBeInTheDocument();

        // Plugins that didn't load at all come first, with where they failed and why
        const failed = screen.getByRole('heading', { name: "Couldn't Load" }).closest('section');
        expect(within(failed).getAllByText(/^Failed /).map(el => el.closest('li').querySelector('.plugin-item-name').textContent))
            .toEqual(['Bad Register', 'Bad Clash', 'Bad Card', 'Nameless', 'broken']);
        expect(within(itemOf('Bad Card')).getByText('Failed in the browser')).toBeInTheDocument();
        expect(within(itemOf('Bad Card')).getByText('Plugin bad-card: card type "bad_card" has no Component')).toBeInTheDocument();
        expect(within(itemOf('broken')).getByText('Failed on the server')).toBeInTheDocument();
        expect(within(itemOf('broken')).getByText('Plugin broken has no setup function')).toBeInTheDocument();

        // A plugin that loaded in one place but not the other is marked among the loaded ones
        expect(within(vacuum).getByText('Partly loaded')).toBeInTheDocument();
        expect(within(vacuum).getByText('Not loaded on the server: Cannot read the robots')).toBeInTheDocument();
        expect(within(itemOf('Weather')).queryByText('Partly loaded')).toBeNull();
    });

    it('still lists the browser plugins when the server can’t be reached', async () => {
        vi.mocked(listServerPlugins).mockRejectedValueOnce(new Error('Server down'));
        render(<PluginSettings />);
        expect(await screen.findByText("Couldn't load the server's plugins: Server down")).toHaveAttribute('role', 'alert');
        expect(itemOf('Weather')).toBeInTheDocument();
        expect(screen.queryByText('Core')).toBeNull();
    });

    it('explains how to turn on installing when it is off', async () => {
        render(<PluginSettings />);
        expect(await screen.findByText(/Set plugins.install: true in config.yaml/)).toBeInTheDocument();
        expect(screen.getByLabelText('GitHub repository')).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
    });

    it('shows a plugin from GitHub for review, and installs it once confirmed', async () => {
        vi.mocked(listServerPlugins)
            .mockResolvedValueOnce({ plugins: [], failed: [], install: { allowed: true, reason: null, folder: '/app/plugins' } })
            .mockResolvedValueOnce({ plugins: [], failed: [], install: { allowed: true, reason: null, folder: '/app/plugins' } })
            .mockResolvedValueOnce(withHello());
        vi.mocked(previewPlugin).mockResolvedValueOnce(preview());
        vi.mocked(installPlugin).mockResolvedValueOnce({ plugin: HELLO, updated: false, restartRecommended: false });
        render(<PluginSettings />);

        const input = await screen.findByLabelText('GitHub repository');
        await vi.waitFor(() => expect(input).toBeEnabled());
        fireEvent.change(input, { target: { value: ' someone/glassboard-hello ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Review' }));

        // Nothing is installed before it is confirmed
        const review = (await screen.findByRole('heading', { name: 'Review Plugin' })).closest('section');
        expect(previewPlugin).toHaveBeenCalledWith({ source: 'someone/glassboard-hello' });
        expect(installPlugin).not.toHaveBeenCalled();
        expect(within(review).getByText(/runs code on the server, with access to every credential/)).toBeInTheDocument();
        expect(within(review).getByText('New')).toBeInTheDocument();
        expect(within(review).getByRole('link', { name: 'someone/glassboard-hello' })).toHaveAttribute('href', 'https://github.com/someone/glassboard-hello');
        expect(within(review).getByRole('link', { name: 'c0ffee0000' })).toHaveAttribute('href', `https://github.com/someone/glassboard-hello/commit/${'c0ffee'.padEnd(40, '0')}`);
        expect(within(review).getByText('First release')).toBeInTheDocument();

        fireEvent.click(within(review).getByRole('button', { name: 'Install' }));
        expect(await screen.findByText('Installed Hello 1.0.0.')).toHaveAttribute('role', 'status');
        expect(installPlugin).toHaveBeenCalledWith('p1');
        expect(loadExternalPlugin).toHaveBeenCalledWith(HELLO, { replace: false });
        expect(screen.queryByRole('heading', { name: 'Review Plugin' })).toBeNull();
        const hello = itemOf('Hello');
        expect(within(hello).getByText('1.0.0')).toBeInTheDocument();
        expect(within(hello).getByRole('link', { name: 'someone/glassboard-hello' })).toHaveAttribute('href', HELLO.source.url);
    });

    it('drops a review on Cancel', async () => {
        vi.mocked(listServerPlugins).mockResolvedValue({ plugins: [], failed: [], install: { allowed: true, reason: null, folder: '/app/plugins' } });
        vi.mocked(previewPlugin).mockResolvedValueOnce(preview());
        render(<PluginSettings />);
        const input = await screen.findByLabelText('GitHub repository');
        await vi.waitFor(() => expect(input).toBeEnabled());
        fireEvent.change(input, { target: { value: 'someone/glassboard-hello' } });
        fireEvent.click(screen.getByRole('button', { name: 'Review' }));
        const review = (await screen.findByRole('heading', { name: 'Review Plugin' })).closest('section');
        fireEvent.click(within(review).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('heading', { name: 'Review Plugin' })).toBeNull();
        expect(installPlugin).not.toHaveBeenCalled();
        vi.mocked(listServerPlugins).mockReset();
    });

    it('says why a plugin can’t be installed', async () => {
        vi.mocked(listServerPlugins).mockResolvedValueOnce({ plugins: [], failed: [], install: { allowed: true, reason: null, folder: '/app/plugins' } });
        vi.mocked(previewPlugin).mockRejectedValueOnce(new Error('No plugin.json in someone/nothing'));
        render(<PluginSettings />);
        const input = await screen.findByLabelText('GitHub repository');
        await vi.waitFor(() => expect(input).toBeEnabled());
        fireEvent.change(input, { target: { value: 'someone/nothing' } });
        fireEvent.click(screen.getByRole('button', { name: 'Review' }));
        expect(await screen.findByText('No plugin.json in someone/nothing')).toHaveAttribute('role', 'alert');
        expect(installPlugin).not.toHaveBeenCalled();
        expect(input).toHaveValue('someone/nothing');
    });

    it('reviews updates, and removes installed plugins, but not built-in ones', async () => {
        vi.mocked(listServerPlugins).mockResolvedValue(withHello());
        vi.mocked(previewPlugin)
            .mockResolvedValueOnce(preview({ upToDate: true }))
            .mockResolvedValueOnce(preview({ preview: 'p2', plugin: { ...preview().plugin, version: '1.1.0' }, installed: { version: '1.0.0', ref: 'v1.0.0' } }));
        vi.mocked(installPlugin).mockResolvedValueOnce({ plugin: { ...HELLO, version: '1.1.0' }, updated: true, restartRecommended: true });
        render(<PluginSettings />);
        const hello = await vi.waitFor(() => itemOf('Hello'));
        expect(within(itemOf('Weather')).queryByRole('button')).toBeNull();

        fireEvent.click(within(hello).getByRole('button', { name: 'Update…' }));
        expect(await screen.findByText('Hello 1.0.0 is the newest release.')).toBeInTheDocument();
        expect(previewPlugin).toHaveBeenCalledWith({ id: 'hello' });

        fireEvent.click(within(itemOf('Hello')).getByRole('button', { name: 'Update…' }));
        const review = (await screen.findByRole('heading', { name: 'Review Update' })).closest('section');
        expect(within(review).getByText('1.0.0 → 1.1.0')).toBeInTheDocument();
        fireEvent.click(within(review).getByRole('button', { name: 'Update to 1.1.0' }));
        expect(await screen.findByText('Updated Hello 1.1.0. Restart Glassboard to finish updating its server part.')).toBeInTheDocument();
        expect(installPlugin).toHaveBeenCalledWith('p2');
        expect(loadExternalPlugin).toHaveBeenCalledWith({ ...HELLO, version: '1.1.0' }, { replace: true });

        fireEvent.click(within(itemOf('Hello')).getByRole('button', { name: 'Remove' }));
        expect(removePlugin).not.toHaveBeenCalled();
        fireEvent.click(within(itemOf('Hello')).getByRole('button', { name: 'Remove' }));
        expect(await screen.findByText('Removed the plugin.')).toBeInTheDocument();
        expect(removePlugin).toHaveBeenCalledWith('hello');
        expect(unloadExternalPlugin).toHaveBeenCalledWith('hello');
        vi.mocked(listServerPlugins).mockReset();
    });
});
