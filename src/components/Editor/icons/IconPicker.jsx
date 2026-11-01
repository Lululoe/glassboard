import { useEffect, useState } from 'react';
import Icon from '../../Shared/Icon';
import { SegmentedField, TextField } from '../EditorFields';
import { findSelfhst, loadCatalog, searchCatalog } from './iconCatalog';
import { FOLLOW_TEXT, iconTab, isMonochrome } from './iconModel';

const PAGE_SIZE = 96;

const TABS = [
    { value: 'lucide', label: 'Lucide' },
    { value: 'mdi', label: 'Material' },
    { value: 'selfhst', label: 'Selfh.st' },
    { value: 'image', label: 'Image' },
];

const SEARCH_LABEL = { lucide: 'Lucide', mdi: 'Material', selfhst: 'selfh.st' };

/**
 * Loads the catalog of the given tab and follows its status.
 * @param {'lucide'|'mdi'|'selfhst'|'image'} tab - The picker tab.
 * @returns {{items: Array<Object>, status: ('loading'|'ready'|'error'), retry: () => void}} The catalog.
 */
function useCatalog(tab) {
    const [loaded, setLoaded] = useState({ tab: null, items: [], failed: false });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (tab === 'image') return undefined;
        let cancelled = false;
        loadCatalog(tab).then(
            (items) => { if (!cancelled) setLoaded({ tab, items, failed: false }); },
            () => { if (!cancelled) setLoaded({ tab, items: [], failed: true }); },
        );
        return () => { cancelled = true; };
    }, [tab, attempt]);

    const current = loaded.tab === tab;
    return {
        items: current ? loaded.items : [],
        status: !current ? 'loading' : loaded.failed ? 'error' : 'ready',
        retry: () => {
            setLoaded({ tab: null, items: [], failed: false });
            setAttempt(n => n + 1);
        },
    };
}

/**
 * Searches the complete Lucide, Material and selfh.st catalogs, or takes an image address.
 * Selfh.st icons can be picked in full color or monochrome. The grid draws more icons as it
 * scrolls, since the catalogs run to thousands of them.
 * @param {Object} props
 * @param {string} props.value - The selected icon's reference string.
 * @param {(ref: string) => void} props.onChange - Receives the picked icon.
 * @returns {JSX.Element} The picker.
 */
const IconPicker = ({ value, onChange }) => {
    const [tab, setTab] = useState(() => /** @type {'lucide'|'mdi'|'selfhst'|'image'} */ (iconTab(value)));
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [mono, setMono] = useState(() => isMonochrome(value));
    const { items, status, retry } = useCatalog(tab);

    const selfhst = tab === 'selfhst';
    const matches = searchCatalog(selfhst && mono ? items.filter(item => item.mono) : items, query);
    const entry = selfhst ? findSelfhst(items, value) : undefined;
    const refOf = (item) => (selfhst && mono ? item.mono : item.ref);
    // The catalogs are long: without a search, the selected icon comes first so it can be seen
    const selectedItem = query ? undefined : matches.find(item => refOf(item) === value);
    const ordered = selectedItem ? [selectedItem, ...matches.filter(item => item !== selectedItem)] : matches;

    const showTab = (next) => {
        setTab(next);
        setQuery('');
        setLimit(PAGE_SIZE);
    };

    const search = (text = '') => {
        setQuery(text);
        setLimit(PAGE_SIZE);
    };

    const setStyle = (style) => {
        const next = style === 'mono';
        setMono(next);
        setLimit(PAGE_SIZE);
        if (entry) onChange(next && entry.mono ? entry.mono : entry.ref);
    };

    const onGridScroll = (e) => {
        const grid = e.currentTarget;
        if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 120) setLimit(n => n + PAGE_SIZE);
    };

    return (
        <>
            <SegmentedField label="Icon" value={tab} options={TABS} onChange={showTab} />
            {tab === 'image' ? (
                <TextField
                    label="Image URL"
                    value={/^https?:/.test(value) ? value : ''}
                    placeholder="https://example.com/icon.svg"
                    hint="An SVG can take an icon color. A PNG keeps its own."
                    onChange={(url = '') => onChange(url)}
                />
            ) : (
                <>
                    <input
                        className="editor-input"
                        type="search"
                        value={query}
                        placeholder={`Search ${SEARCH_LABEL[tab]} icons`}
                        aria-label={`Search ${SEARCH_LABEL[tab]} icons`}
                        spellCheck={false}
                        autoComplete="off"
                        onChange={(e) => search(e.target.value)}
                    />
                    {selfhst && (
                        <SegmentedField
                            label="Style"
                            value={mono ? 'mono' : 'color'}
                            options={[{ value: 'color', label: 'Full color' }, { value: 'mono', label: 'Monochrome' }]}
                            onChange={setStyle}
                            hint={mono && entry && !entry.mono ? `${entry.name} has no monochrome version, so it keeps its colors.` : undefined}
                        />
                    )}
                    <div className="icon-grid" role="group" aria-label="Icons" onScroll={onGridScroll}>
                        {status === 'loading' && <p className="icon-grid-note" role="status">Loading icons…</p>}
                        {status === 'error' && (
                            <p className="icon-grid-note">
                                The icons didn't load. Check the connection and{' '}
                                <button type="button" className="button-reset icon-grid-retry" onClick={retry}>try again</button>
                            </p>
                        )}
                        {status === 'ready' && matches.length === 0 && (
                            <p className="icon-grid-note">No icons match “{query}”.</p>
                        )}
                        {status === 'ready' && ordered.slice(0, limit).map((item) => {
                            const ref = refOf(item);
                            return (
                                <button
                                    key={ref}
                                    type="button"
                                    className="button-reset"
                                    aria-pressed={ref === value}
                                    aria-label={item.name}
                                    title={item.name}
                                    onClick={() => onChange(ref)}
                                >
                                    <Icon icon={ref} size={24} color={isMonochrome(ref) ? FOLLOW_TEXT : undefined} />
                                </button>
                            );
                        })}
                    </div>
                    {status === 'ready' && (
                        <div className="editor-hint icon-grid-count" role="status">
                            {matches.length.toLocaleString('en-US')} {matches.length === 1 ? 'icon' : 'icons'}
                        </div>
                    )}
                </>
            )}
        </>
    );
};

export default IconPicker;
