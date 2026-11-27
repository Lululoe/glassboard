import ProxmoxCard from './ProxmoxCard';

/**
 * The Proxmox plugin: its card type and how edit mode shows it.
 * @type {import('../../plugins/registry').GlassboardPlugin}
 */
const plugin = {
    id: 'proxmox',
    name: 'Proxmox',
    register(api) {
        api.registerCard('proxmox', {
            Component: ProxmoxCard,
            headerIcon: true,
            name: 'Proxmox',
            description: 'Nodes, VMs and containers of a Proxmox cluster',
            icon: 'lu-Server',
        });
    },
};

export default plugin;
