/**
 * Returns a copy of `obj` with the value at `path` replaced. `undefined`, `''` and empty
 * arrays remove the key, so cleared fields do not end up in the YAML.
 * @param {Object} obj - The object to update.
 * @param {string[]} path - Keys leading to the value.
 * @param {*} value - The new value.
 * @returns {Object} The updated copy.
 */
export function setIn(obj, path, value) {
    const [key, ...rest] = path;
    const next = { ...(obj || {}) };
    if (rest.length > 0) {
        const child = setIn(next[key], rest, value);
        if (Object.keys(child).length === 0) delete next[key];
        else next[key] = child;
        return next;
    }
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) delete next[key];
    else next[key] = value;
    return next;
}
