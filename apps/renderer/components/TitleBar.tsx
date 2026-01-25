import React, { useEffect, useState } from 'react';
const WinIcon = ({ type }: { type: 'min' | 'max' | 'close' }) => {
  if (type === 'min') {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <rect x="1" y="5" width="8" height="1" fill="currentColor" />
      </svg>
    );
  }
  if (type === 'max') {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <rect
          x="1.5"
          y="1.5"
          width="7"
          height="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 2 L8 8 M8 2 L2 8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
};

const isElectron = typeof window !== 'undefined' && !!window.gero;

const TitleBar: React.FC = () => {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isElectron || !window.gero) return;
    let cleanup: (() => void) | undefined;
    window.gero.isMaximized().then((value) => setMaximized(value));
    cleanup = window.gero.onMaximizeChanged((value) => setMaximized(value));
    return () => cleanup?.();
  }, []);

  if (!isElectron) return null;

  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={() => window.gero?.minimize()}>
          <WinIcon type="min" />
        </button>
        <button className="titlebar-btn" onClick={() => window.gero?.toggleMaximize()}>
          <WinIcon type="max" />
          <span className="sr-only">{maximized ? 'Restore' : 'Maximize'}</span>
        </button>
        <button className="titlebar-btn titlebar-btn-close" onClick={() => window.gero?.close()}>
          <WinIcon type="close" />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
