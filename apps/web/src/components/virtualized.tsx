import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ScrollElement = HTMLElement | Window;

type VirtualRowsOptions = {
  estimatedRowHeight: number;
  gap: number;
  overscan: number;
  resetKey: string;
  rowCount: number;
  scrollParentRef?: RefObject<HTMLElement | null>;
};

type VirtualRow = {
  index: number;
  offsetTop: number;
};

type VirtualRowsResult = {
  setRowElement: (index: number, element: HTMLDivElement | null) => void;
  spacerRef: RefObject<HTMLDivElement | null>;
  totalHeight: number;
  virtualRows: VirtualRow[];
};

function isWindow(element: ScrollElement): element is Window {
  return element === window;
}

function nearestScrollParent(element: HTMLElement): ScrollElement {
  let parent = element.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return parent;
    }
    parent = parent.parentElement;
  }
  return window;
}

function scrollSnapshot(scrollElement: ScrollElement, spacer: HTMLElement) {
  if (isWindow(scrollElement)) {
    return {
      containerTop: spacer.getBoundingClientRect().top + window.scrollY,
      scrollTop: window.scrollY,
      viewportHeight: window.innerHeight,
    };
  }

  const scrollRect = scrollElement.getBoundingClientRect();
  const spacerRect = spacer.getBoundingClientRect();
  return {
    containerTop: spacerRect.top - scrollRect.top + scrollElement.scrollTop,
    scrollTop: scrollElement.scrollTop,
    viewportHeight: scrollElement.clientHeight,
  };
}

function rowStarts(
  rowCount: number,
  heightForRow: (index: number) => number,
  gap: number,
) {
  const starts: number[] = [];
  let offset = 0;
  for (let index = 0; index < rowCount; index += 1) {
    starts.push(offset);
    offset += heightForRow(index) + (index === rowCount - 1 ? 0 : gap);
  }
  return { starts, totalHeight: offset };
}

function firstVisibleRow(
  starts: number[],
  rowCount: number,
  heightForRow: (index: number) => number,
  visibleTop: number,
) {
  let low = 0;
  let high = rowCount - 1;
  let result = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const start = starts[middle] ?? 0;
    const end = start + heightForRow(middle);
    if (end < visibleTop) {
      low = middle + 1;
    } else {
      result = middle;
      high = middle - 1;
    }
  }
  return result;
}

function lastVisibleRow(starts: number[], rowCount: number, visibleBottom: number) {
  let low = 0;
  let high = rowCount - 1;
  let result = rowCount - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const start = starts[middle] ?? 0;
    if (start <= visibleBottom) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return result;
}

function useElementWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateWidth = () => {
      const nextWidth = element.getBoundingClientRect().width;
      setWidth((current) =>
        Math.abs(current - nextWidth) > 0.5 ? nextWidth : current,
      );
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

function useVirtualRows({
  estimatedRowHeight,
  gap,
  overscan,
  resetKey,
  rowCount,
  scrollParentRef,
}: VirtualRowsOptions): VirtualRowsResult {
  const spacerRef = useRef<HTMLDivElement>(null);
  const rowHeightsRef = useRef(new Map<number, number>());
  const rowObserversRef = useRef(new Map<number, ResizeObserver>());
  const [measurementVersion, setMeasurementVersion] = useState(0);
  const [viewport, setViewport] = useState({
    containerTop: 0,
    scrollTop: 0,
    viewportHeight: 0,
  });

  const updateViewport = useCallback(() => {
    const spacer = spacerRef.current;
    if (!spacer || typeof window === "undefined") {
      return;
    }

    const scrollElement = scrollParentRef?.current ?? nearestScrollParent(spacer);
    const next = scrollSnapshot(scrollElement, spacer);
    setViewport((current) =>
      Math.abs(current.containerTop - next.containerTop) > 0.5 ||
      Math.abs(current.scrollTop - next.scrollTop) > 0.5 ||
      Math.abs(current.viewportHeight - next.viewportHeight) > 0.5
        ? next
        : current,
    );
  }, [scrollParentRef]);

  useEffect(() => {
    rowHeightsRef.current.clear();
    setMeasurementVersion((version) => version + 1);
    updateViewport();
  }, [resetKey, updateViewport]);

  useEffect(() => {
    const spacer = spacerRef.current;
    if (!spacer || typeof window === "undefined") {
      return;
    }

    const scrollElement = scrollParentRef?.current ?? nearestScrollParent(spacer);
    const scrollTarget = isWindow(scrollElement) ? window : scrollElement;
    scrollTarget.addEventListener("scroll", updateViewport, { passive: true });
    window.addEventListener("resize", updateViewport);

    const scrollResizeObserver =
      !isWindow(scrollElement) && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateViewport)
        : undefined;
    scrollResizeObserver?.observe(scrollElement as HTMLElement);

    updateViewport();

    return () => {
      scrollTarget.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      scrollResizeObserver?.disconnect();
    };
  }, [resetKey, scrollParentRef, updateViewport]);

  useEffect(() => {
    return () => {
      rowObserversRef.current.forEach((observer) => observer.disconnect());
      rowObserversRef.current.clear();
    };
  }, []);

  const setRowElement = useCallback(
    (index: number, element: HTMLDivElement | null) => {
      rowObserversRef.current.get(index)?.disconnect();
      rowObserversRef.current.delete(index);

      if (!element) {
        return;
      }

      const measure = () => {
        const height = element.getBoundingClientRect().height;
        const current = rowHeightsRef.current.get(index);
        if (height > 0 && Math.abs((current ?? 0) - height) > 0.5) {
          rowHeightsRef.current.set(index, height);
          setMeasurementVersion((version) => version + 1);
          updateViewport();
        }
      };

      measure();
      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        rowObserversRef.current.set(index, observer);
      }
    },
    [updateViewport],
  );

  const heightForRow = useCallback(
    (index: number) => rowHeightsRef.current.get(index) ?? estimatedRowHeight,
    [estimatedRowHeight, measurementVersion],
  );
  const { starts, totalHeight } = useMemo(
    () => rowStarts(rowCount, heightForRow, gap),
    [gap, heightForRow, rowCount],
  );

  const virtualRows = useMemo<VirtualRow[]>(() => {
    if (rowCount === 0) {
      return [];
    }

    const visibleTop = Math.max(0, viewport.scrollTop - viewport.containerTop);
    const visibleBottom = Math.max(
      visibleTop,
      visibleTop + Math.max(0, viewport.viewportHeight),
    );
    const startIndex = Math.max(
      0,
      firstVisibleRow(starts, rowCount, heightForRow, visibleTop) - overscan,
    );
    const endIndex = Math.min(
      rowCount - 1,
      lastVisibleRow(starts, rowCount, visibleBottom) + overscan,
    );

    const nextRows: VirtualRow[] = [];
    for (let index = startIndex; index <= endIndex; index += 1) {
      nextRows.push({ index, offsetTop: starts[index] ?? 0 });
    }
    return nextRows;
  }, [heightForRow, overscan, rowCount, starts, viewport]);

  return {
    setRowElement,
    spacerRef,
    totalHeight,
    virtualRows,
  };
}

function chunkRows<T>(items: T[], columnCount: number) {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columnCount) {
    rows.push(items.slice(index, index + columnCount));
  }
  return rows;
}

function MeasuredRow({
  children,
  className,
  offsetTop,
  onRowElement,
  style,
}: {
  children: ReactNode;
  className: string;
  offsetTop: number;
  onRowElement: (element: HTMLDivElement | null) => void;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      ref={onRowElement}
      style={{ ...style, transform: `translateY(${offsetTop}px)` }}
    >
      {children}
    </div>
  );
}

export function VirtualGrid<T>({
  className = "",
  estimatedRowHeight,
  gap = 20,
  getKey,
  items,
  minColumnWidth,
  overscan = 3,
  renderItem,
}: {
  className?: string;
  estimatedRowHeight: number;
  gap?: number;
  getKey: (item: T) => string;
  items: T[];
  minColumnWidth: number;
  overscan?: number;
  renderItem: (item: T) => ReactNode;
}) {
  const resetKey = `${items.length}:${items.map(getKey).join("\u001f")}`;
  const [columnCount, setColumnCount] = useState(1);
  const rows = useMemo(() => chunkRows(items, columnCount), [columnCount, items]);
  const virtual = useVirtualRows({
    estimatedRowHeight,
    gap,
    overscan,
    resetKey: `${columnCount}:${resetKey}`,
    rowCount: rows.length,
  });
  const width = useElementWidth(virtual.spacerRef);

  useEffect(() => {
    if (width <= 0) {
      return;
    }
    const nextColumnCount = Math.max(
      1,
      Math.floor((width + gap) / (minColumnWidth + gap)),
    );
    setColumnCount((current) =>
      current === nextColumnCount ? current : nextColumnCount,
    );
  }, [gap, minColumnWidth, width]);

  return (
    <div
      className={`relative w-full ${className}`}
      ref={virtual.spacerRef}
      style={{ height: virtual.totalHeight }}
    >
      {virtual.virtualRows.map((row) => {
        const rowItems = rows[row.index] ?? [];
        return (
          <MeasuredRow
            className="absolute top-0 left-0 grid w-full"
            key={row.index}
            offsetTop={row.offsetTop}
            onRowElement={(element) => virtual.setRowElement(row.index, element)}
            style={{
              gap,
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
            }}
          >
            {rowItems.map((item) => (
              <div className="h-full min-w-0" key={getKey(item)}>
                {renderItem(item)}
              </div>
            ))}
          </MeasuredRow>
        );
      })}
    </div>
  );
}

export function VirtualList<T>({
  className = "",
  estimatedRowHeight,
  gap = 8,
  getKey,
  items,
  overscan = 6,
  renderItem,
}: {
  className?: string;
  estimatedRowHeight: number;
  gap?: number;
  getKey: (item: T) => string;
  items: T[];
  overscan?: number;
  renderItem: (item: T) => ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const resetKey = `${items.length}:${items.map(getKey).join("\u001f")}`;
  const virtual = useVirtualRows({
    estimatedRowHeight,
    gap,
    overscan,
    resetKey,
    rowCount: items.length,
    scrollParentRef: scrollRef,
  });

  return (
    <div className={className} ref={scrollRef}>
      <div
        className="relative w-full"
        ref={virtual.spacerRef}
        style={{ height: virtual.totalHeight }}
      >
        {virtual.virtualRows.map((row) => {
          const item = items[row.index];
          if (!item) {
            return null;
          }
          return (
            <MeasuredRow
              className="absolute top-0 left-0 w-full"
              key={getKey(item)}
              offsetTop={row.offsetTop}
              onRowElement={(element) => virtual.setRowElement(row.index, element)}
            >
              {renderItem(item)}
            </MeasuredRow>
          );
        })}
      </div>
    </div>
  );
}
