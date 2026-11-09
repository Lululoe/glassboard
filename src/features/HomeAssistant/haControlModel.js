/**
 * Returns the cards with every Home Assistant control card as a quarter tile with one entity.
 * Cards from before the card became a single tile may list several entities; each entity
 * then gets a card of its own, in the same place. The first keeps the card's id, the others
 * get ids made from it, so the split is the same on every load and can be saved.
 * @param {Array<Object>} cards - A page's cards.
 * @returns {Array<Object>} The cards; the same array when nothing changes.
 */
export function splitControlCards(cards) {
    if (!Array.isArray(cards)) return cards;
    const isControl = (card) => String(card?.type || '').toLowerCase() === 'hacontrol';
    if (!cards.some(card => isControl(card) && (card.tileSize !== 'quarter' || (card.data?.entities?.length || 0) > 1))) {
        return cards;
    }

    const taken = new Set(cards.map(card => String(card?.id)));
    const idFor = (base, n) => {
        let id = `${base}-${n}`;
        for (let i = 2; taken.has(id); i++) id = `${base}-${n}-${i}`;
        taken.add(id);
        return id;
    };

    return cards.flatMap(card => {
        if (!isControl(card)) return [card];
        const { colSpan: _colSpan, ...rest } = card;
        const entities = Array.isArray(card.data?.entities) ? card.data.entities : [];
        if (entities.length <= 1) return [{ ...rest, tileSize: 'quarter' }];
        return entities.map((entity, i) => ({
            ...rest,
            ...(i > 0 && card.id !== undefined ? { id: idFor(card.id, i + 1) } : {}),
            tileSize: 'quarter',
            data: { ...card.data, entities: [entity] },
        }));
    });
}
