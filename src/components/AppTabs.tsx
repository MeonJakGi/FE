import { useEffect, useMemo, useRef, useState } from 'react';

interface TabItem<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
}

export default function AppTabs<T extends string>({ items, value, onChange }: Props<T>) {
  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const activeIndex = useMemo(
    () => Math.max(0, items.findIndex((item) => item.key === value)),
    [items, value],
  );

  useEffect(() => {
    const navEl = navRef.current;
    const btnEl = itemRefs.current[activeIndex];
    if (!navEl || !btnEl) return;
    const left = btnEl.offsetLeft;
    const width = btnEl.offsetWidth;
    setIndicator({ left, width });
  }, [activeIndex, items]);

  return (
    <nav ref={navRef} className="tabs" aria-label="main-tabs">
      {items.map((item) => (
        <button
          key={item.key}
          ref={(el) => {
            itemRefs.current = itemRefs.current.slice(0, items.length);
            itemRefs.current[items.findIndex((x) => x.key === item.key)] = el;
          }}
          className={`tab ${value === item.key ? 'active' : ''}`}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
      <span
        className="tab-indicator"
        style={{
          width: `${indicator.width}px`,
          transform: `translateX(${indicator.left}px)`,
        }}
      />
    </nav>
  );
}
