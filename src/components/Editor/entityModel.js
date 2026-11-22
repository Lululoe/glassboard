import { useEffect, useState } from 'react';
import {
    Bot, Camera, CircleDot, Cloud, Fan, Gauge, Hash, Lightbulb, Lock, MousePointerClick, ScrollText,
    Speaker, Thermometer, ToggleRight, User, Blinds, Droplets, Zap,
} from 'lucide-react';
import { listEntities } from '../../lib/api';

/**
 * @typedef {{entity_id: string, name: string, device_class?: string, unit?: string}} ListedEntity
 */

/** How an entity id is written: a domain and an object id. */
export const ENTITY_ID = /^[a-z_]+\.[a-z0-9_]+$/;

/** Most results drawn at once; searching narrows them down. */
export const MAX_RESULTS = 80;

/** Names of the common domains, for the filter chips. */
export const DOMAIN_NAMES = {
    light: 'Lights',
    switch: 'Switches',
    sensor: 'Sensors',
    binary_sensor: 'Binary Sensors',
    climate: 'Climate',
    media_player: 'Media Players',
    weather: 'Weather',
    vacuum: 'Vacuums',
    fan: 'Fans',
    cover: 'Covers',
    lock: 'Locks',
    camera: 'Cameras',
    input_boolean: 'Toggles',
    input_number: 'Number Inputs',
    number: 'Numbers',
    button: 'Buttons',
    input_button: 'Buttons',
    script: 'Scripts',
    scene: 'Scenes',
    person: 'People',
    select: 'Selects',
    group: 'Groups',
    text: 'Texts',
    input_text: 'Texts',
};

const DOMAIN_ICONS = {
    light: Lightbulb,
    switch: ToggleRight,
    input_boolean: ToggleRight,
    group: ToggleRight,
    sensor: Gauge,
    binary_sensor: CircleDot,
    climate: Thermometer,
    media_player: Speaker,
    weather: Cloud,
    vacuum: Bot,
    fan: Fan,
    cover: Blinds,
    lock: Lock,
    camera: Camera,
    number: Hash,
    input_number: Hash,
    button: MousePointerClick,
    input_button: MousePointerClick,
    script: ScrollText,
    scene: ScrollText,
    person: User,
};

const CLASS_ICONS = {
    temperature: Thermometer,
    humidity: Droplets,
    power: Zap,
    energy: Zap,
};

export const domainOf = (entityId) => String(entityId).split('.')[0];

/**
 * The icon for an entity: by its device class, else its domain.
 * @param {ListedEntity|{entity_id: string}} entity - The entity.
 * @returns {import('react').ComponentType<{size?: number, 'aria-hidden'?: boolean|'true'}>} The icon.
 */
export const iconOf = (entity) => CLASS_ICONS[/** @type {ListedEntity} */ (entity).device_class] ?? DOMAIN_ICONS[domainOf(entity.entity_id)] ?? CircleDot;

/** @type {Promise<ListedEntity[]>|null} The entities, loaded once while the editors are used. */
let loading = null;
/** @type {ListedEntity[]|null} The entities once loaded, so pickers opened later show them at once. */
let loaded = null;

/**
 * The Home Assistant entities, loaded once and shared by every picker. A failed load is tried
 * again the next time a picker opens.
 * @param {boolean} enabled - Whether they are needed yet.
 * @returns {{entities: ListedEntity[], status: 'idle'|'loading'|'ready'|'error'}} The entities.
 */
export function useEntities(enabled = true) {
    const [state, setState] = useState(/** @type {{entities: ListedEntity[], status: 'idle'|'loading'|'ready'|'error'}} */ (
        loaded ? { entities: loaded, status: 'ready' } : { entities: [], status: 'idle' }
    ));
    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        loading ??= listEntities().then((entities) => {
            loaded = Array.isArray(entities) ? entities : [];
            return loaded;
        }, (err) => {
            loading = null;
            throw err;
        });
        loading.then(
            (entities) => { if (!cancelled) setState({ entities: Array.isArray(entities) ? entities : [], status: 'ready' }); },
            () => { if (!cancelled) setState({ entities: [], status: 'error' }); },
        );
        return () => { cancelled = true; };
    }, [enabled]);
    if (enabled && loaded && state.status !== 'ready') return { entities: loaded, status: 'ready' };
    return enabled && state.status === 'idle' ? { entities: [], status: 'loading' } : state;
}

/** Forgets the loaded entities. Intended for tests. */
export function resetEntityCache() {
    loading = null;
    loaded = null;
}

/**
 * The entities matching a search: every word must be in the name or the id. Exact ids come
 * first, then names starting with the search, then the rest by name.
 * @param {ListedEntity[]} entities - The entities.
 * @param {string} query - The search.
 * @returns {ListedEntity[]} The matches.
 */
export function searchEntities(entities, query) {
    const q = query.trim().toLowerCase();
    if (!q) return [...entities].sort((a, b) => a.name.localeCompare(b.name));
    const words = q.split(/\s+/);
    const rank = (e) => {
        const name = e.name.toLowerCase();
        if (e.entity_id === q) return 0;
        if (name.startsWith(q) || e.entity_id.split('.')[1]?.startsWith(q.replace(/\s+/g, '_'))) return 1;
        return 2;
    };
    return entities
        .filter(e => words.every(w => e.name.toLowerCase().includes(w) || e.entity_id.includes(w)))
        .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

