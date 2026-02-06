import React from 'react';

type TabItem<T extends string> = {
  id: T;
  label: string;
};

type TabsProps<T extends string> = {
  items: Array<TabItem<T>>;
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
};

const Tabs = <T extends string>({ items, activeId, onChange, className = '' }: TabsProps<T>) => {
  return (
    <div
      className={`flex w-full flex-none gap-2 overflow-x-auto pb-1 sm:w-44 sm:flex-col sm:overflow-visible ${className}`}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
            activeId === item.id
              ? 'bg-[var(--bg-2)] text-[var(--ink-1)] ring-1 ring-[var(--line-1)]'
              : 'text-[var(--ink-3)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-1)]'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
