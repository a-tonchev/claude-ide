import { useCallback, useLayoutEffect, useRef } from 'react';

// Within this distance of the bottom a feed follows new items; further up the user is reading
// older ones and stays where they are
const FOLLOW_DISTANCE = 100;

// Keeps a feed scrolled to its newest item unless the user scrolled up. Returns the callback ref
// and onScroll handler for the scrolling element.
// - Whenever `deps` change it scrolls in a layout effect, before paint: the scroll event the DOM
//   change itself causes (the oldest visible item dropping off the top) used to arrive before a
//   plain effect and count as "scrolled up".
// - Content that grows later (mermaid diagrams, images loading, the question block shrinking the
//   feed) doesn't scroll anything, so a ResizeObserver on the element and its items follows that
//   too.
const useFeedAutoScroll = deps => {
  const elRef = useRef(null);
  const scrolledUp = useRef(false);
  const stopObserving = useRef(null);

  const toBottom = useCallback(() => {
    const el = elRef.current;
    if (el && !scrolledUp.current) el.scrollTop = el.scrollHeight;
  }, []);

  const onScroll = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    scrolledUp.current = el.scrollHeight - el.scrollTop - el.clientHeight > FOLLOW_DISTANCE;
  }, []);

  // A callback ref, so a feed element that appears later (the first item arriving) is observed too
  const ref = useCallback(el => {
    stopObserving.current?.();
    stopObserving.current = null;
    elRef.current = el;
    if (!el) return;

    const resizes = new window.ResizeObserver(toBottom);
    resizes.observe(el);
    Array.from(el.children).forEach(child => resizes.observe(child));
    const items = new window.MutationObserver(records => records.forEach(record => {
      record.addedNodes.forEach(node => { if (node.nodeType === 1) resizes.observe(node); });
      record.removedNodes.forEach(node => { if (node.nodeType === 1) resizes.unobserve(node); });
    }));
    items.observe(el, { childList: true });
    stopObserving.current = () => {
      resizes.disconnect();
      items.disconnect();
    };
  }, [toBottom]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(toBottom, deps);

  return { ref, onScroll };
};

export default useFeedAutoScroll;
