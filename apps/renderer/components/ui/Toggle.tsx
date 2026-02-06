import React from 'react';

type ToggleProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

const Toggle: React.FC<ToggleProps> = ({ className = '', ...props }) => {
  return (
    <input
      type="checkbox"
      className={`h-4 w-4 rounded border border-[var(--line-1)] bg-[var(--bg-2)] accent-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink-3)] focus-visible:ring-offset-0 ${className}`}
      {...props}
    />
  );
};

export default Toggle;
