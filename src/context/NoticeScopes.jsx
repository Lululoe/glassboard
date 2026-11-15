import { useMemo, useState } from 'react';
import { NoticeCardContext, NoticePageContext, NoticesContext, createNoticeStore } from './notices';

/**
 * Holds the notices of the dashboard. Without it, cards publish nothing.
 * @param {Object} props
 * @param {import('react').ReactNode} props.children - The dashboard.
 * @returns {JSX.Element} The provider.
 */
export const NoticesProvider = ({ children }) => {
    const [store] = useState(createNoticeStore);
    return <NoticesContext value={store}>{children}</NoticesContext>;
};

/**
 * Tells the cards inside which page they are on.
 * @param {Object} props
 * @param {string} props.page - The page's key.
 * @param {import('react').ReactNode} props.children - The page's content.
 * @returns {JSX.Element} The scope.
 */
export const NoticePage = ({ page, children }) => <NoticePageContext value={page}>{children}</NoticePageContext>;

/**
 * Tells a card which card it is, so its notice can be found. Previews of cards in editors have
 * no scope, so they never publish a second notice for the same card.
 * @param {Object} props
 * @param {{id?: string|number, type?: string, notify?: *}} props.card - The card's config.
 * @param {import('react').ReactNode} props.children - The card.
 * @returns {JSX.Element} The scope.
 */
export const NoticeCard = ({ card, children }) => {
    const id = String(card.id ?? card.type);
    // Kept as text, so the value stays the same while the card's other options change
    const notify = JSON.stringify(card.notify ?? null);
    const value = useMemo(() => ({ id, notify }), [id, notify]);
    return <NoticeCardContext value={value}>{children}</NoticeCardContext>;
};
