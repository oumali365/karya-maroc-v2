import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'navy' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-gold hover:bg-gold-hover text-navy font-bold shadow-xs focus-visible:ring-gold/50',
  secondary:
    'bg-white hover:bg-ivory text-ink border border-[#E2DDD3] hover:border-navy/35 font-semibold focus-visible:ring-navy/25',
  navy:
    'bg-navy hover:bg-navy-light text-white font-bold shadow-xs focus-visible:ring-navy/40',
  ghost:
    'bg-transparent hover:bg-ivory-dark/60 text-ink font-semibold focus-visible:ring-navy/20',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[40px] px-4 py-2 text-xs rounded-xl',
  md: 'min-h-[44px] px-5 py-2.5 text-sm rounded-xl',
  lg: 'min-h-[48px] px-6 py-3 text-sm sm:text-base rounded-xl',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}) => {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.99] ${
        VARIANT_CLASSES[variant]
      } ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
      {children}
    </button>
  );
};

export const PrimaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="primary" {...props} />
);

export const SecondaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="secondary" {...props} />
);
