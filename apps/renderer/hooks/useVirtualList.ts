import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type UseVirtualListOptions<T> = {
  items: T[];
  containerRef: RefObject<HTMLElement | null>;
  estimateSize: (item: T, index: number) => number;
  overscan?: number;
};

type VirtualListItem<T> = {
  item: T;
  index: number;
  key: string;
};

export const useVirtualList = <T>({
  items,
  containerRef,
  estimateSize,
  overscan = 6,
}: UseVirtualListOptions<T>) => {
  const [sizes, setSizes] = useState<number[]>([]);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const frameRef = useRef<number | null>(null);
  const metricsRef = useRef({ scrollTop: 0, viewportHeight: 0 });

  useEffect(() => {
    setSizes((prev) => {
      const next = items.map((item, index) => prev[index] ?? estimateSize(item, index));
      if (prev.length === next.length && prev.every((size, index) => size === next[index])) {
        return prev;
      }
      return next;
    });
  }, [estimateSize, items]);

  const offsets = useMemo(() => {
    const result = new Array(items.length + 1).fill(0);
    for (let i = 0; i < items.length; i += 1) {
      result[i + 1] = result[i] + (sizes[i] ?? 0);
    }
    return result;
  }, [items, sizes]);

  const totalHeight = offsets[offsets.length - 1] ?? 0;

  const findIndexByOffset = useCallback(
    (offset: number) => {
      let low = 0;
      let high = items.length;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (offsets[mid] <= offset) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
      return Math.max(0, low - 1);
    },
    [items.length, offsets]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const nextScrollTop = container.scrollTop;
      const nextViewportHeight = container.clientHeight;
      const prev = metricsRef.current;
      if (prev.scrollTop === nextScrollTop && prev.viewportHeight === nextViewportHeight) {
        return;
      }
      metricsRef.current = {
        scrollTop: nextScrollTop,
        viewportHeight: nextViewportHeight,
      };
      setScrollTop(nextScrollTop);
      setViewportHeight(nextViewportHeight);
    };

    const scheduleUpdate = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        update();
      });
    };
    scheduleUpdate();

    container.addEventListener('scroll', scheduleUpdate, { passive: true });
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(container);

    return () => {
      container.removeEventListener('scroll', scheduleUpdate);
      observer.disconnect();
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [containerRef]);

  const startIndex = Math.max(0, findIndexByOffset(scrollTop) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    findIndexByOffset(scrollTop + viewportHeight) + overscan
  );

  const visibleItems: VirtualListItem<T>[] =
    items.length === 0
      ? []
      : items.slice(startIndex, endIndex + 1).map((item, index) => ({
          item,
          index: startIndex + index,
          key: `${startIndex + index}`,
        }));

  const topSpacerHeight = offsets[startIndex] ?? 0;
  const bottomSpacerHeight =
    totalHeight - (offsets[Math.min(items.length, endIndex + 1)] ?? totalHeight);

  const measureItem = useCallback((index: number, node: HTMLElement | null) => {
    if (!node) return;
    const measured = node.offsetHeight;
    if (!measured) return;
    setSizes((prev) => {
      if (prev[index] === measured) return prev;
      const next = [...prev];
      next[index] = measured;
      return next;
    });
  }, []);

  return {
    visibleItems,
    topSpacerHeight,
    bottomSpacerHeight,
    totalHeight,
    measureItem,
  };
};
