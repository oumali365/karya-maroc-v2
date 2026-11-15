import React, { useId } from 'react';

interface BaseFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  containerClassName?: string;
}

export interface InputFieldProps
  extends BaseFieldProps,
    React.InputHTMLAttributes<HTMLInputElement> {}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  error,
  hint,
  icon,
  id,
  containerClassName = '',
  className = '',
  ...rest
}) => {
  const generatedId = useId();
  const fieldId = id || generatedId;

  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <label htmlFor={fieldId} className="block text-xs font-semibold text-ink">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none flex items-center">
            {icon}
          </span>
        )}
        <input
          id={fieldId}
          className={`w-full min-h-[44px] rounded-xl border bg-white py-2.5 text-sm text-ink placeholder:text-ink-muted/70 transition-colors duration-150 focus:outline-none focus:ring-2 ${
            icon ? 'ps-10 pe-4' : 'px-4'
          } ${
            error
              ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/15'
              : 'border-[#E2DDD3] focus:border-gold focus:ring-gold/20'
          } ${className}`}
          {...rest}
        />
      </div>
      {error && <p className="text-xs font-medium text-rose-700">{error}</p>}
      {!error && hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
};

export interface SelectFieldProps
  extends BaseFieldProps,
    React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  error,
  hint,
  icon,
  id,
  containerClassName = '',
  className = '',
  children,
  ...rest
}) => {
  const generatedId = useId();
  const fieldId = id || generatedId;

  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <label htmlFor={fieldId} className="block text-xs font-semibold text-ink">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none flex items-center">
            {icon}
          </span>
        )}
        <select
          id={fieldId}
          className={`w-full min-h-[44px] appearance-none rounded-xl border bg-white py-2.5 text-sm font-semibold text-ink transition-colors duration-150 focus:outline-none focus:ring-2 cursor-pointer ${
            icon ? 'ps-10 pe-9' : 'ps-4 pe-9'
          } ${
            error
              ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/15'
              : 'border-[#E2DDD3] focus:border-gold focus:ring-gold/20'
          } ${className}`}
          {...rest}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4 text-ink-muted absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      {error && <p className="text-xs font-medium text-rose-700">{error}</p>}
      {!error && hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
};
