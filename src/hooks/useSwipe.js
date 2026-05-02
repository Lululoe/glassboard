import { useRef } from 'react';

/**
 * Hook to handle touch swipe gestures for navigation.
 * @param {Object} props
 * @param {Function} props.onSwipeLeft - Callback for a left swipe.
 * @param {Function} props.onSwipeRight - Callback for a right swipe.
 * @param {number} [props.threshold=50] - Pixel distance required to trigger a swipe.
 * @returns {Object} Event handlers: onTouchStart, onTouchMove, onTouchEnd.
 */
export const useSwipe = ({ onSwipeLeft, onSwipeRight, threshold = 50 }) => {
    const touchStart = useRef(null);
    const touchEnd = useRef(null);

    const onTouchStart = (e) => {
        touchEnd.current = null;
        touchStart.current = e.targetTouches[0].clientX;
    };

    const onTouchMove = (e) => {
        touchEnd.current = e.targetTouches[0].clientX;
    };

    const onTouchEnd = () => {
        if (!touchStart.current || !touchEnd.current) return;
        const distance = touchStart.current - touchEnd.current;
        const isLeftSwipe = distance > threshold;
        const isRightSwipe = distance < -threshold;

        if (isLeftSwipe && onSwipeLeft) {
            onSwipeLeft();
        } else if (isRightSwipe && onSwipeRight) {
            onSwipeRight();
        }
    };

    return {
        onTouchStart,
        onTouchMove,
        onTouchEnd
    };
};
