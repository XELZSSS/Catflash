import React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  compact?: boolean;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', compact = false, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`rounded-md bg-[var(--bg-2)] [background-image:none] shadow-none text-[var(--ink-1)] outline-none ring-1 ring-[var(--line-1)] focus:ring-[color:var(--ink-3)] ${
          compact ? 'px-2.5 py-1.5 text-sm' : 'px-3 py-2 text-sm'
        } ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export default Input;
