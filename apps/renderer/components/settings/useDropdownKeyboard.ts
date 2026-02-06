import { Dispatch, KeyboardEvent, RefObject, SetStateAction, useEffect, useState } from 'react';

type UseDropdownKeyboardOptions = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  selectedIndex: number;
  lastIndex: number;
  triggerRef: RefObject<HTMLButtonElement | null>;
  updatePosition: () => void;
  onSelectIndex: (index: number) => void;
};

export const useDropdownKeyboard = ({
  open,
  setOpen,
  selectedIndex,
  lastIndex,
  triggerRef,
  updatePosition,
  onSelectIndex,
}: UseDropdownKeyboardOptions) => {
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setFocusedIndex(selectedIndex);
  }, [open, selectedIndex]);

  const openWithFocus = (nextIndex: number) => {
    updatePosition();
    setFocusedIndex(Math.min(Math.max(nextIndex, 0), lastIndex));
    setOpen(true);
  };

  const closeMenu = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
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
      onSelectIndex(focusedIndex);
    }
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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
      onSelectIndex(focusedIndex);
    }
  };

  return {
    focusedIndex,
    setFocusedIndex,
    closeMenu,
    handleTriggerKeyDown,
    handleMenuKeyDown,
  };
};
