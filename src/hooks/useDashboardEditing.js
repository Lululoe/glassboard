import { useCallback, useState } from 'react';
import { getCardInfo } from '../features/registry';
import { resetLayout, saveLayout } from '../lib/api';

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
    const taken = new Set(Object.values(drafts).flat().map(c => String(c.id)));
    for (;;) {
        const id = `${type}-${Math.random().toString(36).slice(2, 6)}`;
        if (!taken.has(id)) return id;
    }
}

/**
 * Edit mode for the whole dashboard. While editing, every grid page's cards are kept as a
 * draft, so cards can move between pages and be added, changed or removed; "Done" saves the
 * whole draft at once. Drafts stay visible until the reloaded config arrives, so the grid
 * does not jump back in between.
 * @param {Object} config - The dashboard configuration.
 * @param {Array<Object>} pages - The pages.
 * @returns {Object} Edit state and actions.
 */
export function useDashboardEditing(config, pages) {
    const [editing, setEditing] = useState(false);
    const [drafts, setDrafts] = useState(/** @type {Object<string, Array<Object>>|null} */ (null));
    const [status, setStatus] = useState(null);
    const [saving, setSaving] = useState(false);
    const [savedFor, setSavedFor] = useState(null);
    const [editor, setEditor] = useState(/** @type {{key: string, index: number, isNew: boolean}|null} */ (null));
    const [adding, setAdding] = useState(false);
    const [carry, setCarry] = useState(null);

    // Drop the drafts once the config they were saved against has been replaced
    if (savedFor && savedFor !== config && !editing) {
        setSavedFor(null);
        setDrafts(null);
    }

    const gridPages = pages
        .map((page, idx) => ({ page, idx, key: pageKey(page, idx) }))
        .filter(({ page }) => page.type !== 'iframe');

    const cardsOf = (page, idx) => drafts?.[pageKey(page, idx)] ?? page.cards;

    const start = () => {
        setStatus(null);
        setDrafts(Object.fromEntries(gridPages.map(({ page, key }) => [key, page.cards || []])));
        setEditing(true);
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

    const openEditor = (key, index) => setEditor({ key, index, isNew: false });

    const addCard = (key, type) => {
        const info = getCardInfo(type);
        const card = { id: newCardId(type, drafts || {}), type, ...structuredClone(info?.defaults || {}) };
        const index = (drafts?.[key] || []).length;
        updatePage(key, cards => [...cards, card]);
        setAdding(false);
        setEditor({ key, index, isNew: true });
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
        if (saving || editor || adding) return;
        const original = Object.fromEntries(gridPages.map(({ page, key }) => [key, page.cards || []]));
        if (!drafts || JSON.stringify(drafts) === JSON.stringify(original)) {
            setDrafts(null);
            setStatus(null);
            setEditing(false);
            return;
        }

        if (Object.values(drafts).flat().some(c => c.id === undefined)) {
            // The server matches cards by id, so a dashboard with id-less cards cannot be saved
            if (window.confirm('Some cards in config.yaml have no id, so these changes cannot be saved. Discard them?')) {
                setDrafts(null);
                setStatus(null);
                setEditing(false);
            }
            return;
        }

        setSaving(true);
        setStatus('Saving…');
        try {
            await saveLayout(drafts);
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
        if (!window.confirm('Reset the dashboard to config.yaml? Changes made in the browser, including cards you added, will be removed.')) return;
        try {
            await resetLayout();
            setSavedFor(config);
            setStatus(null);
            setEditing(false);
        } catch (err) {
            setStatus(`Couldn't reset: ${err.message}`);
        }
    };

    return {
        editing, saving, status, cardsOf, start, change, finish, reset, moveToPage,
        carry, clearCarry,
        editor, editingCard, openEditor, saveCard, removeCard, cancelEditor,
        adding, openAdd: () => setAdding(true), closeAdd: () => setAdding(false), addCard,
    };
}
