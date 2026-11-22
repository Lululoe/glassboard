import { createElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import { Field } from './EditorFields';
import {
    DOMAIN_NAMES, ENTITY_ID, MAX_RESULTS, domainOf, iconOf, searchEntities, useEntities,
} from './entityModel';
import './EntityPicker.css';

/**
 * @typedef {import('./entityModel').ListedEntity} ListedEntity
 */

/**
 * The icon of an entity.
 * @param {Object} props
 * @param {{entity_id: string, device_class?: string}} props.entity - The entity.
 * @returns {JSX.Element} The icon.
 */
const EntityIcon = ({ entity }) => createElement(iconOf(entity), { size: 16, 'aria-hidden': true });

/**
 * The panel of a picker: a search, chips that narrow it to one kind, and the results. Arrow
 * keys move through the results and Enter picks one. An id that isn't listed can be typed in.
 * @param {Object} props
 * @param {string} props.label - What is picked, for assistive technology.
 * @param {ListedEntity[]} props.entities - Entities to pick from.
 * @param {'idle'|'loading'|'ready'|'error'} props.status - Whether they are loaded.
 * @param {(entityId: string) => void} props.onPick - Receives the picked entity.
 * @param {() => void} props.onClose - Closes the panel.
 * @param {string} [props.placeholder] - Example id for the search.
 * @returns {JSX.Element} The panel.
 */
function EntityPanel({ label, entities, status, onPick, onClose, placeholder }) {
    const listId = useId();
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const [query, setQuery] = useState('');
    const [domain, setDomain] = useState(/** @type {string|null} */ (null));
    const [active, setActive] = useState(0);

    useEffect(() => {
        inputRef.current?.focus({ preventScroll: true });
    }, []);

    const domains = useMemo(() => {
        const counts = new Map();
        entities.forEach(e => counts.set(domainOf(e.entity_id), (counts.get(domainOf(e.entity_id)) ?? 0) + 1));
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
    }, [entities]);

    const shown = domain ? entities.filter(e => domainOf(e.entity_id) === domain) : entities;
    const matches = searchEntities(shown, query);
    const typed = query.trim().toLowerCase();
    const custom = ENTITY_ID.test(typed) && !entities.some(e => e.entity_id === typed) ? typed : null;
    const options = [...(custom ? [{ entity_id: custom, name: `Use “${custom}”`, custom: true }] : []), ...matches.slice(0, MAX_RESULTS)];
    const current = Math.min(active, Math.max(0, options.length - 1));

    useEffect(() => {
        listRef.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView?.({ block: 'nearest' });
    }, [current]);

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setActive(Math.max(0, Math.min(options.length - 1, current + step)));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (options[current]) onPick(options[current].entity_id);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose();
        }
    };

    return (
        <div className="entity-panel">
            <div className="entity-search">
                <Search size={16} aria-hidden="true" />
                <input
                    ref={inputRef}
                    type="search"
                    role="combobox"
                    aria-label={`Search ${label}`}
                    aria-expanded="true"
                    aria-controls={listId}
                    aria-activedescendant={options[current] ? `${listId}-${current}` : undefined}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={status === 'error' ? `Type an entity id${placeholder ? `, e.g. ${placeholder}` : ''}` : 'Search by name or id'}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setActive(0);
                    }}
                    onKeyDown={onKeyDown}
                />
            </div>
            {domains.length > 1 && (
                <div className="entity-chips" role="radiogroup" aria-label="Kind">
                    <button type="button" role="radio" aria-checked={domain === null} className="button-reset entity-chip" onClick={() => { setDomain(null); setActive(0); }}>All</button>
                    {domains.map(d => (
                        <button key={d} type="button" role="radio" aria-checked={domain === d} className="button-reset entity-chip" onClick={() => { setDomain(d); setActive(0); }}>
                            {DOMAIN_NAMES[d] ?? d}
                        </button>
                    ))}
                </div>
            )}
            <ul className="entity-results" id={listId} role="listbox" aria-label={label} ref={listRef}>
                {options.map((e, index) => {
                    return (
                        <li
                            key={e.entity_id + (/** @type {any} */ (e).custom ? ':custom' : '')}
                            id={`${listId}-${index}`}
                            data-index={index}
                            role="option"
                            aria-selected={index === current}
                            className={`entity-option${index === current ? ' is-active' : ''}`}
                            onPointerMove={() => { if (index !== current) setActive(index); }}
                            onClick={() => onPick(e.entity_id)}
                        >
                            <span className="entity-option-icon">{/** @type {any} */ (e).custom ? <Plus size={16} aria-hidden="true" /> : <EntityIcon entity={e} />}</span>
                            <span className="entity-option-text">
                                <span className="entity-option-name">{e.name}</span>
                                {!(/** @type {any} */ (e).custom) && <span className="entity-option-id">{e.entity_id}</span>}
                            </span>
                            {/** @type {ListedEntity} */ (e).unit && <span className="entity-option-unit">{/** @type {ListedEntity} */ (e).unit}</span>}
                        </li>
                    );
                })}
            </ul>
            {status === 'loading' && <p className="entity-note">Loading entities…</p>}
            {status === 'error' && <p className="entity-note">Couldn’t load the entities from Home Assistant. Type an entity id above.</p>}
            {status === 'ready' && options.length === 0 && <p className="entity-note">{query ? 'Nothing found.' : 'No entities of this kind.'}</p>}
            {matches.length > MAX_RESULTS && <p className="entity-note">Showing {MAX_RESULTS} of {matches.length}. Search to narrow them down.</p>}
        </div>
    );
}

/**
 * Closes a panel when the pointer goes down outside its picker.
 * @param {import('react').RefObject<HTMLElement>} ref - The picker.
 * @param {boolean} open - Whether the panel is open.
 * @param {() => void} close - Closes it.
 */
function useOutsideClose(ref, open, close) {
    const latest = useRef(close);
    useEffect(() => {
        latest.current = close;
    });
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
            if (ref.current && !ref.current.contains(/** @type {Node} */ (e.target))) latest.current();
        };
        document.addEventListener('pointerdown', onDown, true);
        return () => document.removeEventListener('pointerdown', onDown, true);
    }, [open, ref]);
}

/**
 * Narrows entities to the domains and filter a picker allows.
 * @param {ListedEntity[]} entities - All entities.
 * @param {string[]} [domains] - Allowed domains.
 * @param {(entity: ListedEntity) => boolean} [filter] - Further filter.
 * @returns {ListedEntity[]} The entities.
 */
const allowed = (entities, domains, filter) => entities
    .filter(e => !domains || domains.includes(domainOf(e.entity_id)))
    .filter(e => !filter || filter(e));

/**
 * Picks one Home Assistant entity, or none. Shows the entity picked by its name and id; opening
 * it searches every entity, or those of the given domains.
 * @param {Object} props
 * @param {string} props.label - Field label.
 * @param {string|undefined} props.value - The entity picked.
 * @param {(value: string|undefined) => void} props.onChange - Receives the entity, or undefined for none.
 * @param {string[]} [props.domains] - Domains to offer; all when left out.
 * @param {(entity: ListedEntity) => boolean} [props.filter] - Offers only entities it returns true for.
 * @param {ListedEntity[]} [props.entities] - Entities to offer; loaded from the server when left out.
 * @param {string} [props.hint] - Help text.
 * @param {string} [props.placeholder] - Example id, shown when nothing is picked.
 * @param {boolean} [props.clearable=true] - Whether it can be set back to none.
 * @returns {JSX.Element} The field.
 */
export function EntityPicker({ label, value, onChange, domains, filter, entities: given, hint, placeholder, clearable = true }) {
    const id = useId();
    const ref = useRef(null);
    const [open, setOpen] = useState(false);
    const loaded = useEntities(!given && (open || !!value));
    const list = given ?? loaded.entities;
    const status = given ? 'ready' : loaded.status;
    const offered = allowed(list, domains, filter);
    useOutsideClose(ref, open, () => setOpen(false));

    const picked = value ? list.find(e => e.entity_id === value) ?? { entity_id: value, name: value } : null;

    return (
        <Field label={label} hint={hint} htmlFor={id}>
            <div className={`entity-picker${open ? ' is-open' : ''}`} ref={ref}>
                <div className="entity-field">
                    <button
                        id={id}
                        type="button"
                        className="button-reset editor-input entity-trigger"
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        onClick={() => setOpen(o => !o)}
                    >
                        {picked ? (
                            <>
                                <span className="entity-option-icon"><EntityIcon entity={picked} /></span>
                                <span className="entity-option-text">
                                    <span className="entity-option-name">{picked.name}</span>
                                    {picked.name !== picked.entity_id && <span className="entity-option-id">{picked.entity_id}</span>}
                                </span>
                            </>
                        ) : (
                            <span className="entity-trigger-placeholder">{placeholder ? `Choose, e.g. ${placeholder}` : 'Choose an entity'}</span>
                        )}
                        <ChevronDown className="entity-trigger-chevron" size={16} aria-hidden="true" />
                    </button>
                    {picked && clearable && (
                        <button type="button" className="button-reset entity-clear" aria-label={`Clear ${label}`} onClick={() => onChange(undefined)}>
                            <X size={14} aria-hidden="true" />
                        </button>
                    )}
                </div>
                {open && (
                    <EntityPanel
                        label={label}
                        entities={offered}
                        status={status}
                        placeholder={placeholder}
                        onPick={(entityId) => {
                            onChange(entityId);
                            setOpen(false);
                            document.getElementById(id)?.focus();
                        }}
                        onClose={() => {
                            setOpen(false);
                            document.getElementById(id)?.focus();
                        }}
                    />
                )}
            </div>
        </Field>
    );
}

/**
 * Picks several Home Assistant entities, in order. The ones picked are listed with a button to
 * remove each; Add opens the search for more.
 * @param {Object} props
 * @param {string} props.label - Field label.
 * @param {string[]} props.value - The entities picked.
 * @param {(value: string[]) => void} props.onChange - Receives the entities.
 * @param {number} [props.max] - Most that can be picked.
 * @param {string[]} [props.domains] - Domains to offer; all when left out.
 * @param {(entity: ListedEntity) => boolean} [props.filter] - Offers only entities it returns true for.
 * @param {ListedEntity[]} [props.entities] - Entities to offer; loaded from the server when left out.
 * @param {string} [props.hint] - Help text.
 * @returns {JSX.Element} The field.
 */
export function EntityListPicker({ label, value, onChange, max, domains, filter, entities: given, hint }) {
    const ref = useRef(null);
    const addId = useId();
    const [open, setOpen] = useState(false);
    const loaded = useEntities(!given && (open || value.length > 0));
    const list = given ?? loaded.entities;
    const status = given ? 'ready' : loaded.status;
    const offered = allowed(list, domains, filter).filter(e => !value.includes(e.entity_id));
    const full = max !== undefined && value.length >= max;
    useOutsideClose(ref, open, () => setOpen(false));
    const byId = new Map(list.map(e => [e.entity_id, e]));

    return (
        <Field label={label} hint={hint ?? (max !== undefined ? `Up to ${max}.` : undefined)} htmlFor={addId}>
            <div className={`entity-picker${open ? ' is-open' : ''}`} ref={ref}>
                {value.length > 0 && (
                    <ul className="entity-picked" aria-label={label}>
                        {value.map(entityId => {
                            const entity = byId.get(entityId) ?? { entity_id: entityId, name: entityId };
                            return (
                                <li key={entityId} className="entity-picked-item">
                                    <span className="entity-option-icon"><EntityIcon entity={entity} /></span>
                                    <span className="entity-option-text">
                                        <span className="entity-option-name">{entity.name}</span>
                                        {entity.name !== entityId && <span className="entity-option-id">{entityId}</span>}
                                    </span>
                                    <button
                                        type="button"
                                        className="button-reset entity-clear"
                                        aria-label={`Remove ${entity.name}`}
                                        onClick={() => onChange(value.filter(v => v !== entityId))}
                                    >
                                        <X size={14} aria-hidden="true" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <button
                    id={addId}
                    type="button"
                    className="button-reset entity-add"
                    aria-expanded={open}
                    disabled={full}
                    onClick={() => setOpen(o => !o)}
                >
                    <Plus size={16} aria-hidden="true" />
                    {full ? `All ${max} chosen` : 'Add'}
                </button>
                {open && !full && (
                    <EntityPanel
                        label={label}
                        entities={offered}
                        status={status}
                        onPick={(entityId) => {
                            const next = [...value, entityId];
                            onChange(next);
                            if (max !== undefined && next.length >= max) setOpen(false);
                        }}
                        onClose={() => setOpen(false)}
                    />
                )}
            </div>
        </Field>
    );
}
