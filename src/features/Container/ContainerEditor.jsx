import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Group, SegmentedField, TextField, ToggleField } from '../../components/Editor/EditorFields';
import { setIn } from '../../components/Editor/setIn';
import AddCardDialog from '../../components/Editor/AddCardDialog';
import CardEditor from '../../components/Editor/CardEditor';
import { fitToColumns, moveItem, sizeOf } from '../../components/Grid/gridLayout';
import Icon from '../../components/Shared/Icon';
import { getCardInfo } from '../registry';
import { CONTAINER_TYPE, flattenCards } from '../../../shared/containerCards';
import { DEFAULT_SCALE, columnsOf, newChildId, scaleOf } from './containerModel';
import './ContainerEditor.css';

const SIZE_NAMES = { quarter: 'Quarter', half: 'Half', 1: '1 wide', 2: '2 wide', 3: '3 wide' };

const SCALES = [
    { value: 1, label: 'Full size' },
    { value: DEFAULT_SCALE, label: 'A bit smaller' },
    { value: 0.76, label: 'Smaller' },
    { value: 0.64, label: 'Compact' },
];

/**
 * Collects the ids of every card on the dashboard, those inside containers included.
 * @param {Object} [globalConfig] - The dashboard config.
 * @returns {Set<string>} The ids.
 */
function dashboardIds(globalConfig) {
    const pages = Array.isArray(globalConfig?.pages) ? globalConfig.pages : [{ cards: globalConfig?.cards }];
    return new Set(flattenCards(pages.flatMap(p => p?.cards || [])).map(c => String(c.id)));
}

/**
 * Names a card in the list: its title or name, else its type's name.
 * @param {Object} card - The card config.
 * @returns {string} The name.
 */
const nameOf = (card) => String(card.title || card.name || getCardInfo(card.type)?.name || card.type || 'Card');

/**
 * Settings form for the container card: its title and look, how much smaller the cards inside
 * are drawn, and the cards it holds. Cards are added, opened in their own editor, reordered and
 * removed here; their size is limited to the container's width.
 * @param {Object} props
 * @param {Object} props.config - The container's config being edited.
 * @param {(config: Object) => void} props.onChange - Receives the updated config.
 * @param {Object} [props.globalConfig] - The dashboard config, for ids and card previews.
 * @returns {JSX.Element} The form.
 */
const ContainerEditor = ({ config, onChange, globalConfig }) => {
    const cards = Array.isArray(config.cards) ? config.cards : [];
    const columns = columnsOf(config);
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState(/** @type {{index: number, card: Object, isNew: boolean}|null} */ (null));

    const setCards = (next) => onChange(setIn(config, ['cards'], next));
    const scale = scaleOf(config);

    const add = (type) => {
        const taken = dashboardIds(globalConfig);
        flattenCards(cards).forEach(c => taken.add(String(c.id)));
        const info = getCardInfo(type);
        const card = fitToColumns({ id: newChildId(type, taken), type, ...structuredClone(info?.defaults || {}) }, columns);
        setAdding(false);
        setEditing({ index: cards.length, card, isNew: true });
    };

    const save = (card) => {
        const { index, isNew } = editing;
        setCards(isNew ? [...cards, card] : cards.map((c, i) => (i === index ? card : c)));
        setEditing(null);
    };

    return (
        <>
            <Group title="General">
                <TextField
                    label="Title"
                    value={config.title}
                    placeholder="No title"
                    hint="Shown small above the cards."
                    onChange={(v) => onChange(setIn(config, ['title'], v))}
                />
                <ToggleField
                    label="Panel behind the cards"
                    checked={config.background !== false}
                    onChange={(on) => onChange(setIn(config, ['background'], on ? undefined : false))}
                />
                <SegmentedField
                    label="Cards inside"
                    value={SCALES.some(s => s.value === scale) ? scale : undefined}
                    options={SCALES}
                    hint="How much smaller the cards are drawn than on the page."
                    onChange={(value) => onChange(setIn(config, ['scale'], value === DEFAULT_SCALE ? undefined : value))}
                />
            </Group>

            <section className="editor-group">
                <header className="editor-group-header">
                    <h3 className="editor-group-title">
                        Cards
                        {cards.length > 0 && <span className="editor-group-count">{cards.length}</span>}
                    </h3>
                    <p className="editor-group-description">
                        The container has {columns} {columns === 1 ? 'column' : 'columns'}, like its width. Make it wider or
                        taller in the Layout tab, or with its resize handle on the page.
                    </p>
                </header>
                <div className="editor-group-body editor-items">
                    {cards.length === 0 && <p className="editor-items-empty">Nothing added yet.</p>}
                    {cards.map((card, index) => {
                        const title = nameOf(card);
                        const info = getCardInfo(card.type);
                        return (
                            <div className="editor-item" key={card.id ?? index}>
                                <div className="editor-item-head">
                                    <button
                                        type="button"
                                        className="button-reset editor-item-toggle"
                                        aria-label={`Edit ${title}`}
                                        onClick={() => setEditing({ index, card, isNew: false })}
                                    >
                                        <span className="container-editor-icon" aria-hidden="true">
                                            <Icon icon={info?.icon || 'lu-Square'} size={16} />
                                        </span>
                                        <span className="editor-item-text">
                                            <span className="editor-item-title">{title}</span>
                                            <span className="editor-item-detail container-editor-detail">
                                                {title !== (info?.name || card.type) && `${info?.name || card.type} · `}
                                                {SIZE_NAMES[sizeOf(fitToColumns(card, columns))]}
                                            </span>
                                        </span>
                                        <ChevronRight className="editor-item-chevron" size={18} aria-hidden="true" />
                                    </button>
                                    <div className="editor-item-actions">
                                        <button
                                            type="button"
                                            className="button-reset editor-item-action"
                                            aria-label={`Move ${title} up`}
                                            disabled={index === 0}
                                            onClick={() => setCards(moveItem(cards, index, index - 1))}
                                        >
                                            <ArrowUp size={16} aria-hidden="true" />
                                        </button>
                                        <button
                                            type="button"
                                            className="button-reset editor-item-action"
                                            aria-label={`Move ${title} down`}
                                            disabled={index === cards.length - 1}
                                            onClick={() => setCards(moveItem(cards, index, index + 1))}
                                        >
                                            <ArrowDown size={16} aria-hidden="true" />
                                        </button>
                                        <button
                                            type="button"
                                            className="button-reset editor-item-action destructive"
                                            aria-label={`Remove ${title}`}
                                            onClick={() => setCards(cards.filter((_, i) => i !== index))}
                                        >
                                            <Trash2 size={16} aria-hidden="true" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <button type="button" className="button-reset editor-add-button" onClick={() => setAdding(true)}>
                        <Plus size={16} aria-hidden="true" />
                        Add card
                    </button>
                </div>
            </section>

            {adding && <AddCardDialog exclude={[CONTAINER_TYPE]} onPick={add} onCancel={() => setAdding(false)} />}
            {editing && (
                <CardEditor
                    card={editing.card}
                    globalConfig={globalConfig}
                    isNew={editing.isNew}
                    maxColumns={columns}
                    nested
                    onSave={save}
                    onCancel={() => setEditing(null)}
                    onRemove={() => {
                        if (!editing.isNew) setCards(cards.filter((_, i) => i !== editing.index));
                        setEditing(null);
                    }}
                />
            )}
        </>
    );
};

export default ContainerEditor;
