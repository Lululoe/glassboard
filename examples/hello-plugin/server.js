/**
 * The server part of the Hello plugin: a `hello` service that greets the name set on the card.
 * Glassboard calls `setup` once when it loads the plugin, with `ctx`, its API for plugins.
 * @param {Object} ctx - The plugin context (config, errors, logger, Home Assistant).
 * @returns {Object} The plugin's services, and their versions for demo mode.
 */
export function setup(ctx) {
    /**
     * Greets the name set on the card. The card sends its id; the name is read from the
     * config, never taken from the request.
     * @param {{cardId?: string}} params - Request parameters.
     * @returns {{greeting: string, time: string}} The greeting and the server's time.
     */
    const hello = ({ cardId }) => {
        const card = ctx.config.findCard(cardId);
        if (!card || card.type !== 'hello') throw new ctx.errors.HttpError(404, `Not a hello card: ${cardId}`);
        const name = typeof card.name === 'string' && card.name.trim() ? card.name.trim() : 'there';
        return { greeting: `Hello, ${name}!`, time: new Date().toISOString() };
    };
    ctx.logger.info('Hello plugin is ready');
    return { services: { hello }, demo: { hello } };
}
