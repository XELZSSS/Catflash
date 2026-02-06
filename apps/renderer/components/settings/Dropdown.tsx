import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
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
  const [focusedIndex, setFocusedIndex] = useState(0);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const maxMenuHeight = 224; // matches max-h-56
    const spaceBelow = window.innerHeight - rect.bottom;
    const effectiveMenuHeight = menuHeight ?? maxMenuHeight;
    const openUp = spaceBelow < effectiveMenuHeight + 12 && rect.top > effectiveMenuHeight + 12;
    setPosition((prev) => {
      if (
        prev &&
        prev.top === rect.top &&
        prev.left === rect.left &&
        prev.width === rect.width &&
        prev.height === rect.height &&
        prev.openUp === openUp
      ) {
        return prev;
      }
      return {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        openUp,
      };
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
    if (!open) return;
    setFocusedIndex(selectedIndex);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) {
      setMenuHeight(null);
      setMenuReady(false);
      return;
    }
    return undefined;
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const rawHeight = menuRef.current?.getBoundingClientRect().height ?? null;
    const height = rawHeight ? Math.round(rawHeight) : null;
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

  useEffect(() => {
    if (!open || !menuReady) return;
    menuRef.current?.focus();
    const target = optionRefs.current[focusedIndex];
    target?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex, menuReady, open]);

  const current = options.find((option) => option.value === value)?.label ?? value;
  const lastIndex = Math.max(0, options.length - 1);

  const openWithFocus = (nextIndex: number) => {
    updatePosition();
    setFocusedIndex(Math.min(Math.max(nextIndex, 0), lastIndex));
    setOpen(true);
  };

  const closeMenu = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const selectOption = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    closeMenu();
  };

  return (
    <div ref={containerRef} className={`relative w-full ${widthClassName ?? 'sm:w-56'}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          updatePosition();
          setOpen((prev) => !prev);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) {
              openWithFocus(selectedIndex);
              return;
            }
            setFocusedIndex((prev) => Math.min(lastIndex, prev + 1));
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) {
              openWithFocus(selectedIndex);
              return;
            }
            setFocusedIndex((prev) => Math.max(0, prev - 1));
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!open) {
              openWithFocus(selectedIndex);
              return;
            }
            selectOption(focusedIndex);
          }
        }}
        className="flex w-full items-center justify-between rounded-md bg-[var(--bg-2)] [background-image:none] shadow-none px-2.5 py-1.5 text-xs font-sans text-[var(--ink-2)] outline-none ring-1 ring-[var(--line-1)] focus:ring-[color:var(--ink-3)]"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
      >
        <span>{current}</span>
      </button>

      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              id={listboxId}
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
              tabIndex={-1}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  closeMenu();
                  return;
                }
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setFocusedIndex((prev) => Math.min(lastIndex, prev + 1));
                  return;
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setFocusedIndex((prev) => Math.max(0, prev - 1));
                  return;
                }
                if (event.key === 'Home') {
                  event.preventDefault();
                  setFocusedIndex(0);
                  return;
                }
                if (event.key === 'End') {
                  event.preventDefault();
                  setFocusedIndex(lastIndex);
                  return;
                }
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectOption(focusedIndex);
                }
              }}
            >
              {options.map((option, index) => (
                <div key={option.value} className="px-1.5 py-0.5">
                  <button
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    type="button"
                    onClick={() => selectOption(index)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-xs font-sans transition-colors ${
                      focusedIndex === index
                        ? 'bg-white/10 text-[var(--ink-1)]'
                        : option.value === value
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
