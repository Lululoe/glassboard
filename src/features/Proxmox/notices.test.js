import { describe, it, expect } from 'vitest';
import { proxmoxNotices } from './notices';

describe('Proxmox notices', () => {
    it('reports an unreachable Proxmox host', () => {
        expect(proxmoxNotices('timeout')).toEqual([{ level: 'alert', title: "Can't reach Proxmox" }]);
        expect(proxmoxNotices(null)).toEqual([]);
    });
});
