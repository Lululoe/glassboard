import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import AppIcon from '../../Shared/AppIcon';
import { useGridCapacity } from '../../../features/AppGrid/useGridCapacity';
import '../../../features/AppGrid/AppGridCard.css';
import { setIn } from '../setIn';
import ItemInspector from './ItemInspector';
import { boxOf } from './cardBox';
import ArrangeSlot from './ArrangeSlot';
import Stage from './Stage';
import { useArrangeable, useArrangedList, useMoveAnimation } from './useArrangeable';

const SIZES = new Set(['small', 'medium', 'large']);

const NEW_APP = { name: '', url: '', icon: 'lu-Globe' };

/**
 * The tiles of an app grid card, arranged directly. Tiles that don't fit the card's size are
 * shown in a tray under it instead of silently being cut off, and can be dragged back up.
 * @param {Object} props
 * @param {Object} props.config - The card being edited.
 * @param {Object} [props.globalConfig] - The dashboard config, for the header menu's apps.
 * @param {(config: Object) => void} props.onChange - Receives the changed card.
 * @param {{list: string, index: number}|null} props.selection - The selected tile.
 * @param {(selection: {list: string, index: number}|null) => void} props.onSelect - Changes the selection.
 * @returns {JSX.Element} The stage.
 */
export const AppGridStage = ({ config, globalConfig, onChange, selection, onSelect }) => {
    const own = config.data?.apps || [];
    const followsMenu = own.length === 0;
    const menuApps = globalConfig?.launcher?.apps || [];
    const shown = followsMenu ? menuApps : own;

    const [stash, setStash] = useState(null);
    const [undo, setUndo] = useState(null);
    const rootRef = useRef(null);
    const gridRef = useRef(null);

    const size = SIZES.has(config.size) ? config.size : 'medium';
    const showLabels = config.showLabels !== false;
    const box = boxOf(config);

    const capacity = useGridCapacity(gridRef, `${size}|${showLabels}|${config.columns}|${box.width}|${box.height}`);
    const limit = config.maxApps > 0 ? Math.min(config.maxApps, capacity) : capacity;

    const setApps = (apps) => onChange(setIn(config, ['data', 'apps'], apps));
    const list = useArrangedList({ name: 'apps', items: own, onChange: setApps, selection, onSelect });

    const remove = (_name, index) => {
        setUndo({ index, item: own[index] });
        list.removeAt(index);
    };

    const { dragging, itemProps } = useArrangeable({ rootRef, lists: { apps: list }, selection, onSelect, onRemove: remove });

    const useOwnApps = () => {
        setApps(stash || structuredClone(menuApps));
        setStash(null);
    };

    const useMenuApps = () => {
        setStash(own);
        setUndo(null);
        onSelect(null);
        setApps([]);
    };

    const addApp = () => {
        setUndo(null);
        list.insertAt(own.length, { ...NEW_APP });
    };

    const undoRemove = () => {
        list.insertAt(undo.index, undo.item);
        setUndo(null);
    };

    const tile = (app, index, inTray) => {
        const label = app.name || 'New app';
        const selected = !followsMenu && selection?.list === 'apps' && selection.index === index;
        const icon = <AppIcon icon={app.icon} background={app.bgColor} className={inTray ? '' : 'app-grid-icon'} size="100%" />;
        const name = showLabels && <span className="app-name">{label}</span>;
        if (followsMenu) {
            return (
                <div key={index} className="app-item">
                    <div className="app-icon-wrap">{icon}</div>
                    {name}
                </div>
            );
        }
        return (
            <ArrangeSlot
                key={list.ids[index]}
                id={list.ids[index]}
                label={label}
                className={inTray ? 'app-item arrange-tray-item' : 'app-item'}
                selected={selected}
                dragging={dragging?.list === 'apps' && dragging.index === index}
                itemProps={itemProps('apps', index)}
                onRemove={inTray ? undefined : () => remove('apps', index)}
            >
                <div className="app-icon-wrap">{icon}</div>
                {name}
            </ArrangeSlot>
        );
    };

    const fits = shown.slice(0, limit);
    const overflow = followsMenu ? [] : own.slice(limit);

    const source = (
        <div className="editor-segmented icon-stage-source" role="radiogroup" aria-label="Apps shown on this card">
            <button type="button" role="radio" className="button-reset" aria-checked={!followsMenu} onClick={followsMenu ? useOwnApps : undefined}>This card's apps</button>
            <button type="button" role="radio" className="button-reset" aria-checked={followsMenu} onClick={followsMenu ? undefined : useMenuApps}>Header menu's apps</button>
        </div>
    );

    return (
        <div ref={rootRef} className="icon-stage-root">
            <Stage
                width={box.width}
                height={box.height}
                tools={(
                    <>
                        {source}
                        <div className="icon-stage-tools">
                            {!followsMenu && (
                                <button type="button" className="button-reset icon-stage-add" onClick={addApp}>
                                    <Plus size={18} aria-hidden="true" />Add app
                                </button>
                            )}
                            <StageHint undo={undo} onUndo={undoRemove} followsMenu={followsMenu} />
                        </div>
                    </>
                )}
                footer={overflow.length > 0 && (
                    <div className="arrange-tray">
                        <div className="arrange-tray-title">
                            Won't show: {overflow.length}{' '}
                            <span>This card has room for {limit}. Drag one up to swap it in.</span>
                        </div>
                        <div className="arrange-tray-items">
                            {overflow.map((app, i) => tile(app, limit + i, true))}
                        </div>
                    </div>
                )}
            >
                {(zoom) => (
                    <Animated rootRef={rootRef} zoom={zoom}>
                        <div className={`glass-card app-grid-card app-grid-${size}${showLabels ? '' : ' app-grid-no-labels'}`} style={{ height: '100%' }}>
                            <div className="card-content">
                                <div
                                    className="app-grid-container"
                                    ref={gridRef}
                                    style={config.columns > 0 ? { gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))` } : undefined}
                                >
                                    {fits.map((app, index) => tile(app, index, false))}
                                </div>
                            </div>
                        </div>
                    </Animated>
                )}
            </Stage>
        </div>
    );
};

/**
 * Runs the move animation inside the stage, where the zoom is known.
 * @param {Object} props
 * @param {import('react').RefObject<HTMLElement>} props.rootRef - Element holding the items.
 * @param {number} props.zoom - The stage's zoom.
 * @param {import('react').ReactNode} props.children - The content.
 * @returns {import('react').ReactNode} The content.
 */
export const Animated = ({ rootRef, zoom, children }) => {
    useMoveAnimation(rootRef, zoom);
    return children;
};

/**
 * What the preview offers right now, or the undo of the last removal.
 * @param {Object} props
 * @param {{item: Object}|null} props.undo - The removal that can be undone.
 * @param {() => void} props.onUndo - Puts the item back.
 * @param {boolean} [props.followsMenu] - Whether the card shows the header menu's apps.
 * @returns {JSX.Element} The hint.
 */
export const StageHint = ({ undo, onUndo, followsMenu = false }) => (
    <div className="icon-stage-hint" role="status">
        {undo && (
            <>
                Removed {undo.item.name || 'item'}.{' '}
                <button type="button" className="button-reset icon-stage-undo" onClick={onUndo}>Undo</button>
            </>
        )}
        {!undo && (followsMenu ? 'Follows the header menu. Edit the apps there.' : 'Drag to reorder. Select an icon to change it.')}
    </div>
);

/**
 * Settings of the selected tile.
 * @param {Object} props
 * @param {Object} props.config - The card being edited.
 * @param {(config: Object) => void} props.onChange - Receives the changed card.
 * @param {{list: string, index: number}|null} props.selection - The selected tile.
 * @param {(selection: {list: string, index: number}|null) => void} props.onSelect - Changes the selection.
 * @returns {JSX.Element|null} The settings, or null when nothing is selected.
 */
export const AppGridInspector = ({ config, onChange, selection, onSelect }) => {
    const apps = config.data?.apps || [];
    const item = selection?.list === 'apps' ? apps[selection.index] : undefined;
    if (!item) return null;

    const setApps = (next) => onChange(setIn(config, ['data', 'apps'], next));
    return (
        <ItemInspector
            key={selection.index}
            kind="App"
            item={item}
            onChange={(app) => setApps(apps.map((a, i) => (i === selection.index ? app : a)))}
            onRemove={() => {
                onSelect(null);
                setApps(apps.filter((_, i) => i !== selection.index));
            }}
            onDone={() => onSelect(null)}
        />
    );
};
