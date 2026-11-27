/**
 * What the Proxmox card reports to the sidebar through `useCardNotice`: a plain function from
 * the data the card already shows to its notices, so the rules can be tested without rendering it.
 * It returns a list, which is empty when there is nothing to tell.
 */

/**
 * Proxmox: the host can't be reached. Stopped guests are not reported, as many are stopped on
 * purpose.
 * @param {string|null} error - Why loading failed.
 * @returns {Array<Object>} The notices.
 */
export function proxmoxNotices(error) {
    return error ? [{ level: 'alert', title: "Can't reach Proxmox" }] : [];
}
