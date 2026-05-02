import { describe, it, expect, beforeEach } from 'vitest';
import { getSanitizedConfig, getConfigSonarr, getConfigProxmox } from './config.js';

describe('Backend Configuration Parsing', () => {
    // Keep in mind that loadConfig reads from disk natively with dummy files in the test env.
    // Instead of messing with fs, we can directly assert the environment parser behaviors since they rely on process.env overrides
    
    beforeEach(() => {
        // Reset process.env for controlled environments
        delete process.env.SONARR_URL;
        delete process.env.SONARR_API_KEY;
        delete process.env.PROXMOX_URL;
    });

    it('sanitizes config by aggressively stripping all explicit services', () => {
        // The default CONFIG map might be empty depending on vitest run state, but `services` definitely gets stripped.
        const sanitized = getSanitizedConfig();
        expect(sanitized.services).toBeUndefined();
    });

    it('resolves SONARR credentials reliably prioritizing environment variables', () => {
        process.env.SONARR_URL = 'http://test-sonarr:8989';
        process.env.SONARR_API_KEY = 'test_key_123';
        
        const result = getConfigSonarr();
        expect(result.SONARR_URL).toBe('http://test-sonarr:8989');
        expect(result.SONARR_API_KEY).toBe('test_key_123');
    });

    it('resolves Proxmox connections with node fallbacks safely', () => {
        process.env.PROXMOX_URL = 'https://10.0.0.5:8006';
        const result = getConfigProxmox();
        expect(result.url).toBe('https://10.0.0.5:8006');
        expect(result.node).toBe('pve'); // fallback
    });
});
