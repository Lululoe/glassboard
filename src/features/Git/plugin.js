import GitCard from './GitCard';

/**
 * The Pull Requests plugin: its card type and how edit mode shows it.
 * @type {import('../../plugins/registry').GlassboardPlugin}
 */
const plugin = {
    id: 'git',
    name: 'Pull Requests',
    register(api) {
        api.registerCard('git', {
            Component: GitCard,
            headerIcon: true,
            name: 'Pull Requests',
            description: 'Open pull requests from GitHub, GitLab or Gitea',
            icon: 'lu-GitPullRequest',
            defaults: { repositories: [] },
        });
    },
};

export default plugin;
