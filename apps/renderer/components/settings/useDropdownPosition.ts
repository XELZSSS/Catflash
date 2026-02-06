import { RefObject, useCallback, useEffect, useLayoutEffect, useState } from 'react';

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
  height: number;
  openUp: boolean;
};

type UseDropdownPositionOptions = {
  open: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  onRequestClose: () => void;
};

export const useDropdownPosition = ({
  open,
  containerRef,
  triggerRef,
  menuRef,
  onRequestClose,
}: UseDropdownPositionOptions) => {
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const [menuHeight, setMenuHeight] = useState<number | null>(null);
  const [menuReady, setMenuReady] = useState(false);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const maxMenuHeight = 224;
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
  }, [menuHeight, triggerRef]);

  useEffect(() => {
    if (!open) {
      setMenuHeight(null);
      setMenuReady(false);
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      if (containerRef.current?.contains(target)) return;
      onRequestClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRequestClose();
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
  }, [containerRef, menuRef, onRequestClose, open, triggerRef, updatePosition]);

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
  }, [menuHeight, menuReady, menuRef, open, updatePosition]);

  return {
    position,
    menuReady,
    updatePosition,
  };
};
