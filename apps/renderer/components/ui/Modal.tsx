import React from 'react';

type ModalProps = {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
  overlayRef?: React.RefObject<HTMLDivElement>;
};

const Modal: React.FC<ModalProps> = ({ isOpen, children, className = '', overlayRef }) => {
  if (!isOpen) return null;
  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 p-4 titlebar-no-drag"
    >
      <div
        className={`w-full max-h-[92vh] overflow-hidden rounded-xl bg-[var(--bg-1)] ring-1 ring-[var(--line-1)] shadow-none fx-soft-rise ${className}`}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
