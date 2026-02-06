import React from 'react';
import Button from './Button';

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  danger?: boolean;
};

const IconButton: React.FC<IconButtonProps> = ({
  active = false,
  danger = false,
  className = '',
  ...props
}) => {
  const tone = danger
    ? 'text-[var(--ink-3)] hover:text-red-400'
    : active
      ? 'bg-white/10 text-[var(--ink-1)] ring-[var(--line-1)]'
      : 'text-[var(--ink-3)] hover:text-[var(--ink-1)]';

  return <Button size="icon" variant="subtle" className={`${tone} ${className}`} {...props} />;
};

export default IconButton;
