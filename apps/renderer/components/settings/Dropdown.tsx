import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type DropdownOption = {
  value: string;
  label: string;
};

type DropdownProps = {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  widthClassName?: string;
  portalContainer?: HTMLElement | null;
};

const Dropdown: React.FC<DropdownProps> = ({
  value,
  options,
  onChange,
  widthClassName,
  portalContainer,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
    openUp: boolean;
  } | null>(null);
  const [menuHeight, setMenuHeight] = useState<number | null>(null);
  const [menuReady, setMenuReady] = useState(false);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const maxMenuHeight = 224; // matches max-h-56
    const spaceBelow = window.innerHeight - rect.bottom;
    const effectiveMenuHeight = menuHeight ?? maxMenuHeight;
    const openUp = spaceBelow < effectiveMenuHeight + 12 && rect.top > effectiveMenuHeight + 12;
    setPosition({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      openUp,
    });
  }, [menuHeight]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      if (containerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    updatePosition();
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      setMenuHeight(null);
      setMenuReady(false);
      return;
    }
    return undefined;
  }, [open, menuHeight]);

  useLayoutEffect(() => {
    if (!open) return;
    const height = menuRef.current?.getBoundingClientRect().height ?? null;
    if (!height) return;
    if (height !== menuHeight) {
      setMenuHeight(height);
      return;
    }
    if (!menuReady) {
      updatePosition();
      setMenuReady(true);
    }
  }, [open, menuHeight, menuReady, updatePosition]);

  const current = options.find((option) => option.value === value)?.label ?? value;

  return (
    <div ref={containerRef} className={`relative w-full ${widthClassName ?? 'sm:w-56'}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          updatePosition();
          setOpen((prev) => !prev);
        }}
        className="flex w-full items-center justify-between rounded-md bg-[var(--bg-2)] [background-image:none] shadow-none px-2.5 py-1.5 text-xs font-sans text-[var(--ink-2)] outline-none ring-1 ring-[var(--line-1)] focus:ring-[color:var(--ink-3)]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{current}</span>
      </button>

      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-50 max-h-56 overflow-auto scrollbar-hide rounded-md border border-[var(--line-1)] bg-[var(--bg-2)] p-1.5 shadow-none"
              style={{
                left: position.left,
                width: position.width,
                top: position.openUp ? position.top - 8 : position.top + position.height + 8,
                transform: position.openUp ? 'translateY(-100%)' : undefined,
                opacity: menuReady ? 1 : 0,
                pointerEvents: menuReady ? 'auto' : 'none',
              }}
              role="listbox"
            >
              {options.map((option) => (
                <div key={option.value} className="px-1.5 py-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-xs font-sans transition-colors ${
                      option.value === value
                        ? 'bg-white/10 text-[var(--ink-1)]'
                        : 'text-[var(--ink-2)] hover:bg-white/5 hover:text-[var(--ink-1)]'
                    }`}
                    role="option"
                    aria-selected={option.value === value}
                  >
                    {option.label}
                  </button>
                </div>
              ))}
            </div>,
            portalContainer ?? document.body
          )
        : null}
    </div>
  );
};

export type { DropdownOption };
export default Dropdown;
