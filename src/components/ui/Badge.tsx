import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'neutral';

export interface BadgeProps {
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50/90 text-emerald-800 border-emerald-200/70',
  warning: 'bg-gold-soft text-[#8A6526] border-gold/35',
  error: 'bg-rose-50/90 text-rose-800 border-rose-200/70',
  neutral: 'bg-ivory text-ink border-[#E2DDD3]',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  icon,
  children,
  className = '',
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 ${BADGE_CLASSES[variant]} ${className}`}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
