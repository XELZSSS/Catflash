import React from 'react';

type FieldProps = {
  label: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

const Field: React.FC<FieldProps> = ({ label, actions, children, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-[var(--ink-2)]">{label}</label>
        {actions}
      </div>
      {children}
    </div>
  );
};

export default Field;
