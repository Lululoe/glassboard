import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleHaRequest } from './homeassistant.js';

// Mock the internal server configuration algorithms to produce deterministic security environments.
vi.mock('../config.js', () => {
    return {
        getConfigHomeAssistant: vi.fn(() => ({ HA_URL: 'http://mock.ha', HA_TOKEN: 'valid_token' })),
        getValidEntityIds: vi.fn(() => new Set(['light.allowed', 'weather.safe'])),
        validateEntityAction: vi.fn((entityId, service) => {
            return entityId === 'light.allowed' && service === 'light.turn_on';
        })
    };
});

describe('Home Assistant API Security & Proxy Authorization', () => {
    
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', vi.fn(async () => {
            return {
                ok: true,
                json: async () => ({ status: 'success_response' })
            };
        }));
    });

    it('rejects fetching states for entities absent natively from config bindings', async () => {
        // Assert state retrieval is completely blocked using a 403 standard protocol
        await expect(handleHaRequest('states/light.scary_hacker_light', {})).rejects.toThrow('Entity not authorized');
    });

    it('proxies states securely to safely validated layout elements', async () => {
        const response = await handleHaRequest('states/weather.safe', {});
        expect(response.status).toBe('success_response');
    });

    it('restricts service executions independently bounding logic out of bounds of the actual entity definition', async () => {
        // Light is allowed in UI logic! However, passing an explicitly unallowed service block like turn_off triggers 403 authorization failures
        await expect(handleHaRequest('services', { entity_id: 'light.allowed', service: 'light.turn_off' }))
            .rejects.toThrow('Service call not authorized for this entity');
    });

    it('resolves valid actions structurally authorized through the theme pipeline', async () => {
        const response = await handleHaRequest('services', { entity_id: 'light.allowed', service: 'light.turn_on' });
        expect(response.status).toBe('success_response');
    });

});
