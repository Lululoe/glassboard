import { sizeOf } from '../../Grid/gridLayout';

const TILE = 315;
const GAP = 30;
const HALF_TILE = (TILE - GAP) / 2;

/**
 * The size a card has on a desktop-width dashboard, which its preview is drawn at.
 * @param {Object} card - The card config.
 * @returns {{width: number, height: number}} Its size in pixels.
 */
export function boxOf(card) {
    const size = sizeOf(card);
    if (size === 'quarter') return { width: HALF_TILE, height: HALF_TILE };
    if (size === 'half') return { width: TILE, height: HALF_TILE };
    return { width: TILE * Number(size) + GAP * (Number(size) - 1), height: TILE };
}
