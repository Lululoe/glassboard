/*
 * Container cards hold other cards in their own `cards` list. These helpers are shared by the
 * browser and the server, so both see the nested cards wherever every card has to be found,
 * such as id lookups, duplicate checks and Home Assistant subscriptions.
 */

/** The card type that holds other cards. */
export const CONTAINER_TYPE = 'container';

/** How many levels of containers inside containers are followed. */
const MAX_DEPTH = 4;

/**
 * Whether a card is a container card.
 * @param {*} card - The card config.
 * @returns {boolean} True for `type: container` (case-insensitive).
 */
export const isContainer = (card) => String(card?.type || '').toLowerCase() === CONTAINER_TYPE;

/**
 * Returns the cards held by a container card.
 * @param {*} card - The card config.
 * @returns {Array<Object>} Its cards; empty for other cards.
 */
export const childCardsOf = (card) => (isContainer(card) && Array.isArray(card.cards) ? card.cards.filter(Boolean) : []);

/**
 * Lists cards together with the cards inside container cards, each container before its cards.
 * @param {Array<Object>|undefined} cards - The cards.
 * @param {number} [depth=0] - Current nesting level, used to stop at `MAX_DEPTH`.
 * @returns {Array<Object>} Every card, nested ones included.
 */
export function flattenCards(cards, depth = 0) {
    if (!Array.isArray(cards)) return [];
    return cards.flatMap(card => {
        if (!card) return [];
        const children = depth < MAX_DEPTH ? childCardsOf(card) : [];
        return [card, ...flattenCards(children, depth + 1)];
    });
}
