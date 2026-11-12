import { useCallback, useState } from 'react';
import { getCardInfo } from '../features/registry';
import { flattenCards } from '../../shared/containerCards';
import { resetLayout, restoreLayout, saveLayout } from '../lib/api';

/**
 * Returns the key a page is saved under: its id, or its index.
 * @param {Object} page - Page config.
 * @param {number} idx - Page index.
 * @returns {string} The page key.
 */
export const pageKey = (page, idx) => String(page.id ?? idx);

/**
 * Creates an id for a new card that no other card uses.
 * @param {string} type - The card type.
 * @param {Object<string, Array<Object>>} drafts - All cards per page.
 * @returns {string} A new id such as `weather-k3f9`.
 */
function newCardId(type, drafts) {
    const taken = new Set(flattenCards(Object.values(drafts).flat()).map(c => String(c.id)));
    for (;;) {
        const id = `${type}-${Math.random().toString(36).slice(2, 6)}`;
        if (!taken.has(id)) return id;
    }
}

/**
 * Makes a page id from a name: lowercase letters, digits and dashes, unique among `taken`.
 * @param {string} name - The page name.
 * @param {Set<string>} taken - Page keys already in use.
 * @returns {string} The id, such as `garden` or `garden-2`.
 */
export function pageIdFor(name, taken) {
    const base = String(name || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'page';
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    return id;
}

/**
 * Edit mode for the whole dashboard. While editing, every grid page's cards are kept as a
 * draft, so cards can move between pages and be added, changed or removed; "Done" saves the
 * whole draft at once. Pages can be added too; they follow the pages of config.yaml and can be
 * renamed and deleted again. Drafts stay visible until the reloaded config arrives, so the grid
 * does not jump back in between.
 * @param {Object} config - The dashboard configuration.
 * @param {Array<Object>} pages - The pages of the config, before any page added while editing;
 *   `withDraftPages` gives the pages to show.
 * @returns {Object} Edit state and actions.
 */
export function useDashboardEditing(config, pages) {
    const [editing, setEditing] = useState(false);
    const [drafts, setDrafts] = useState(/** @type {Object<string, Array<Object>>|null} */ (null));
    const [status, setStatus] = useState(null);
    const [saving, setSaving] = useState(false);
    const [savedFor, setSavedFor] = useState(null);
    const [editor, setEditor] = useState(/** @type {{key: string, index: number, isNew: boolean, mode?: 'card'|'icon'}|null} */ (null));
    const [adding, setAdding] = useState(false);
    const [carry, setCarry] = useState(null);
    const [shared, setShared] = useState(/** @type {{launcher?: Object, iconBackgrounds: string[], background?: Object, pageBackgrounds: Object<string, Object>, pageHeader?: *, pageHeaders: Object<string, *>, headerAutoHide?: string}|null} */ (null));
    const [editingBackground, setEditingBackground] = useState(/** @type {false|'all'|'page'} */ (false));
    const [editingHeader, setEditingHeader] = useState(/** @type {null|'layout'|'title'|'subtitle'|'widget'|'widget-add'} */ (null));
    const [editingWidget, setEditingWidget] = useState(/** @type {number|null} */ (null));
    const [newWidgetType, setNewWidgetType] = useState(/** @type {string|null} */ (null));
    const [pageDrafts, setPageDrafts] = useState(/** @type {Array<{id: string, name?: string}>|null} */ (null));
    const [pageDialog, setPageDialog] = useState(/** @type {{id?: string}|null} */ (null));
    const [editingMenu, setEditingMenu] = useState(false);
    const [confirmingReset, setConfirmingReset] = useState(false);
    const [canUndoReset, setCanUndoReset] = useState(false);
    const [undoFailed, setUndoFailed] = useState(false);

    // Drop the drafts once the config they were saved against has been replaced
    if (savedFor && savedFor !== config && !editing) {
        setSavedFor(null);
        setDrafts(null);
        setShared(null);
        setPageDrafts(null);
    }

    const savedPages = pages.filter(p => p.addedInEditor).map(p => ({ id: String(p.id), ...(p.name ? { name: p.name } : {}) }));

    const gridPages = pages
        .map((page, idx) => ({ page, idx, key: pageKey(page, idx) }))
        .filter(({ page }) => page.type !== 'iframe');

    const savedShared = {
        launcher: config.launcher,
        iconBackgrounds: config.iconBackgrounds || [],
        background: config.background,
        pageBackgrounds: Object.fromEntries(gridPages.filter(({ page }) => page.background).map(({ page, key }) => [key, page.background])),
        pageHeader: config.pageHeader,
        pageHeaders: Object.fromEntries(gridPages.filter(({ page }) => page.pageHeader !== undefined).map(({ page, key }) => [key, page.pageHeader])),
        headerAutoHide: config.headerAutoHide,
    };

    const cardsOf = (page, idx) => drafts?.[pageKey(page, idx)] ?? page.cards;

    const start = () => {
        setStatus(null);
        setCanUndoReset(false);
        setDrafts(Object.fromEntries(gridPages.map(({ page, key }) => [key, page.cards || []])));
        setShared(savedShared);
        setPageDrafts(savedPages);
        setEditing(true);
    };

    /**
     * Returns the pages to show: those of config.yaml, then the pages added in the browser as
     * they are in the draft, so new, renamed and deleted pages show right away.
     * @param {Array<Object>} configPages - The pages of the config.
     * @returns {Array<Object>} The pages.
     */
    const withDraftPages = (configPages) => {
        if (!pageDrafts) return configPages;
        const byId = new Map(configPages.filter(p => p.addedInEditor).map(p => [String(p.id), p]));
        return [
            ...configPages.filter(p => !p.addedInEditor),
            ...pageDrafts.map(d => ({ ...(byId.get(d.id) || { cards: [] }), id: d.id, name: d.name, addedInEditor: true })),
        ];
    };

    /**
     * Adds an empty page after the others.
     * @param {string} name - Its name.
     * @returns {string} Its id, which is also its address.
     */
    const addPage = (name) => {
        const taken = new Set([...pages.map((p, i) => pageKey(p, i)), ...(pageDrafts || []).map(p => p.id)]);
        const id = pageIdFor(name, taken);
        setPageDrafts(prev => [...(prev || []), { id, ...(name ? { name } : {}) }]);
        setDrafts(prev => ({ ...prev, [id]: [] }));
        setPageDialog(null);
        return id;
    };

    const renamePage = (id, name) => {
        setPageDrafts(prev => prev.map(p => (p.id === id ? { id, ...(name ? { name } : {}) } : p)));
        setPageDialog(null);
    };

    /**
     * Deletes a page added in the browser, with its cards.
     * @param {string} id - The page's id.
     */
    const deletePage = (id) => {
        setPageDrafts(prev => prev.filter(p => p.id !== id));
        setDrafts(prev => {
            const { [id]: _removed, ...rest } = prev;
            return rest;
        });
        setShared(prev => {
            const { [id]: _removed, ...pageBackgrounds } = prev.pageBackgrounds;
            const { [id]: _header, ...pageHeaders } = prev.pageHeaders;
            return { ...prev, pageBackgrounds, pageHeaders };
        });
        setPageDialog(null);
    };

    const updatePage = (key, update) => setDrafts(prev => ({ ...prev, [key]: update(prev?.[key] || []) }));

    const change = (key, cards) => updatePage(key, () => cards);

    /**
     * Moves a card to the end of another page and remembers the drag so that page can continue it.
     * @param {string} fromKey - Page the card is on.
     * @param {number} index - The card's position there.
     * @param {string} toKey - Page to move it to.
     * @param {Object} drag - The drag to continue on the other page.
     */
    const moveToPage = (fromKey, index, toKey, drag) => {
        setDrafts(prev => {
            const card = prev[fromKey][index];
            return {
                ...prev,
                [fromKey]: prev[fromKey].filter((_, i) => i !== index),
                [toKey]: [...(prev[toKey] || []), card],
            };
        });
        setCarry(drag);
    };

    const clearCarry = useCallback(() => setCarry(null), []);

    const openEditor = (key, index) => setEditor({ key, index, isNew: false, mode: 'card' });

    /**
     * Opens the icon editor of a card, which changes only its header icon.
     * @param {string} key - The card's page.
     * @param {number} index - The card's position there.
     */
    const openIconEditor = (key, index) => setEditor({ key, index, isNew: false, mode: 'icon' });

    const addCard = (key, type) => {
        const info = getCardInfo(type);
        const card = { id: newCardId(type, drafts || {}), type, ...structuredClone(info?.defaults || {}) };
        const index = (drafts?.[key] || []).length;
        updatePage(key, cards => [...cards, card]);
        setAdding(false);
        setEditor({ key, index, isNew: true, mode: 'card' });
    };

    const editingCard = editor ? drafts?.[editor.key]?.[editor.index] : null;

    const saveCard = (card) => {
        if (!editor) return;
        updatePage(editor.key, cards => cards.map((c, i) => (i === editor.index ? card : c)));
        setEditor(null);
    };

    const removeCard = () => {
        if (!editor) return;
        updatePage(editor.key, cards => cards.filter((_, i) => i !== editor.index));
        setEditor(null);
    };

    const cancelEditor = () => {
        if (editor?.isNew) removeCard();
        else setEditor(null);
    };

    const finish = async () => {
        if (saving || editor || adding || editingMenu || editingBackground || editingHeader || pageDialog || confirmingReset) return;
        const original = Object.fromEntries(gridPages.map(({ page, key }) => [key, page.cards || []]));
        const unchanged = JSON.stringify(drafts) === JSON.stringify(original)
            && JSON.stringify(shared) === JSON.stringify(savedShared)
            && JSON.stringify(pageDrafts) === JSON.stringify(savedPages);
        if (!drafts || unchanged) {
            setDrafts(null);
            setShared(null);
            setPageDrafts(null);
            setStatus(null);
            setEditing(false);
            return;
        }

        if (Object.values(drafts).flat().some(c => c.id === undefined)) {
            // The server matches cards by id, so a dashboard with id-less cards cannot be saved
            if (window.confirm('Some cards in config.yaml have no id, so these changes cannot be saved. Discard them?')) {
                setDrafts(null);
                setShared(null);
                setPageDrafts(null);
                setStatus(null);
                setEditing(false);
            }
            return;
        }

        setSaving(true);
        setStatus('Saving…');
        try {
            const { launcher, iconBackgrounds, background, pageBackgrounds, pageHeader, pageHeaders, headerAutoHide } = shared;
            await saveLayout(drafts, {
                ...(launcher ? { launcher } : {}),
                iconBackgrounds,
                background: background ?? null,
                addedPages: pageDrafts,
                // Every page, so a page that follows the others again clears a background set in config.yaml
                pageBackgrounds: Object.fromEntries(Object.keys(drafts).map(key => [key, pageBackgrounds[key] ?? null])),
                // The same for page headers; templates are left to config.yaml by the server
                pageHeader: pageHeader ?? null,
                pageHeaders: Object.fromEntries(Object.keys(drafts).map(key => [key, pageHeaders[key] ?? null])),
                headerAutoHide: headerAutoHide ?? null,
            });
            setSavedFor(config);
            setStatus(null);
            setEditing(false);
        } catch (err) {
            setStatus(`Couldn't save: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const reset = async () => {
        setConfirmingReset(false);
        try {
            await resetLayout();
            setSavedFor(config);
            setStatus(null);
            setEditing(false);
            setCanUndoReset(true);
        } catch (err) {
            setStatus(`Couldn't reset: ${err.message}`);
        }
    };

    const undoReset = async () => {
        setUndoFailed(false);
        try {
            await restoreLayout();
            setCanUndoReset(false);
        } catch {
            setUndoFailed(true);
        }
    };

    return {
        editing, saving, status, cardsOf, start, change, finish, reset, moveToPage,
        confirmingReset, requestReset: () => setConfirmingReset(true), cancelReset: () => setConfirmingReset(false),
        canUndoReset, undoFailed, undoReset,
        carry, clearCarry,
        editor, editingCard, openEditor, openIconEditor, saveCard, removeCard, cancelEditor,
        adding, openAdd: () => setAdding(true), closeAdd: () => setAdding(false), addCard,
        launcher: shared ? shared.launcher : config.launcher,
        iconBackgrounds: shared ? shared.iconBackgrounds : savedShared.iconBackgrounds,
        setIconBackgrounds: (iconBackgrounds) => setShared(prev => ({ ...prev, iconBackgrounds })),
        editingMenu,
        openMenuEditor: () => setEditingMenu(true),
        closeMenuEditor: () => setEditingMenu(false),
        /** When the header bar hides itself, as in the draft while editing. */
        headerAutoHide: shared ? shared.headerAutoHide : config.headerAutoHide,
        /**
         * Keeps the header menu and the header bar's auto-hide in the draft.
         * @param {Object} launcher - The header menu.
         * @param {string} [headerAutoHide] - When the header bar hides itself.
         */
        saveMenu: (launcher, headerAutoHide) => {
            setShared(prev => ({ ...prev, launcher, headerAutoHide }));
            setEditingMenu(false);
        },
        withDraftPages, addPage, renamePage, deletePage,
        pageDialog,
        openAddPage: () => setPageDialog({}),
        openPageSettings: (id) => setPageDialog({ id }),
        closePageDialog: () => setPageDialog(null),
        background: shared ? shared.background : config.background,
        editingBackground,
        /**
         * Opens the background dialog.
         * @param {'all'|'page'} [scope] - Which background it starts on; by default the page's, if it has its own.
         */
        openBackgroundEditor: (scope) => {
            setPageDialog(null);
            setEditingBackground(scope || 'all');
        },
        closeBackgroundEditor: () => setEditingBackground(false),
        /** The page header of all pages, as in the draft while editing. */
        pageHeader: shared ? shared.pageHeader : config.pageHeader,
        /**
         * Returns a page's own page header setting, as in the draft while editing.
         * @param {Object} page - The page.
         * @param {number} idx - Its position.
         * @returns {*} The setting, or undefined when the page follows all pages.
         */
        pageHeaderOf: (page, idx) => (shared ? shared.pageHeaders[pageKey(page, idx)] : page?.pageHeader),
        editingHeader,
        /** Position of the widget being edited, or null for a new one. */
        editingWidget,
        /** The kind picked for a new widget. */
        newWidgetType,
        /**
         * Opens one of the page header's editors. Adding a widget first lists the kinds to pick from.
         * @param {'layout'|'title'|'subtitle'|'widget'} part - The header's arrangement, one of its lines, or a widget.
         * @param {number|null} [index] - For a widget, its position; null adds one.
         */
        openHeaderEditor: (part, index = null) => {
            setEditingWidget(index);
            setNewWidgetType(null);
            setEditingHeader(part === 'widget' && index === null ? 'widget-add' : part);
        },
        /**
         * Opens the editor of a new widget of the picked kind.
         * @param {string} type - The kind.
         */
        pickWidgetType: (type) => {
            setNewWidgetType(type);
            setEditingHeader('widget');
        },
        closeHeaderEditor: () => setEditingHeader(null),
        /**
         * Keeps the page header of all pages and of one page in the draft.
         * @param {{pageHeader: *, pageOwn: *}} saved - The setting of all pages, and the page's own
         *   (undefined when it follows all pages).
         * @param {string} [key] - The page the second one belongs to.
         */
        saveHeader: ({ pageHeader, pageOwn }, key) => {
            setShared(prev => {
                if (key === undefined) return { ...prev, pageHeader };
                const { [key]: _old, ...others } = prev.pageHeaders;
                return { ...prev, pageHeader, pageHeaders: pageOwn === undefined ? others : { ...others, [key]: pageOwn } };
            });
            setEditingHeader(null);
        },
        /**
         * Returns a page's own background, as in the draft while editing.
         * @param {Object} page - The page.
         * @param {number} idx - Its position.
         * @returns {Object|undefined} The background, or undefined when it shows that of all pages.
         */
        pageBackgroundOf: (page, idx) => (shared ? shared.pageBackgrounds[pageKey(page, idx)] : page?.background),
        /**
         * Keeps the background of all pages and of one page in the draft.
         * @param {{background: Object|undefined, pageBackground: Object|undefined}} saved - The settings.
         * @param {string} [key] - The page the second one belongs to.
         */
        saveBackground: ({ background, pageBackground }, key) => {
            setShared(prev => {
                if (key === undefined) return { ...prev, background };
                const { [key]: _old, ...others } = prev.pageBackgrounds;
                return { ...prev, background, pageBackgrounds: pageBackground ? { ...others, [key]: pageBackground } : others };
            });
            setEditingBackground(false);
        },
    };
}
