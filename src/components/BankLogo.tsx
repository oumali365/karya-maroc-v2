import React from 'react';

interface BankLogoProps {
  code: string;
  className?: string;
}

export const BankLogo: React.FC<BankLogoProps> = ({ code, className = 'w-8 h-8' }) => {
  switch (code) {
    case 'AL_BARID':
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
          <rect width="40" height="40" rx="8" fill="#FEF9C3" />
          <path d="M10 24c4-7 11-11 20-12-5 4-9 9-12 16l-8-4z" fill="#EAB308" />
          <path d="M16 14l6 4-8 6 2-10z" fill="#854D0E" />
        </svg>
      );
    case 'CHAABI':
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
          <rect width="40" height="40" rx="8" fill="#FFEDD5" />
          <circle cx="20" cy="20" r="11" fill="#C2410C" />
          <path d="M16 25c0-5 2-9 6-10-1 3 0 6 2 8-2 2-5 2-8 2z" fill="#FDE68A" />
        </svg>
      );
    case 'CIH':
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
          <rect width="40" height="40" rx="8" fill="#F1F5F9" />
          <path d="M12 12l10 8-10 8V12z" fill="#EA580C" />
          <path d="M20 12l10 8-10 8V12z" fill="#0284C7" opacity="0.88" />
        </svg>
      );
    case 'TIJJARI':
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
          <rect width="40" height="40" rx="8" fill="#FEF3C7" />
          <path d="M10 11h20v10l-10 8-10-8V11z" fill="#F59E0B" />
          <path d="M14 15h12v4H14z" fill="#7C2D12" />
        </svg>
      );
    case 'BMCE':
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
          <rect width="40" height="40" rx="8" fill="#E0F2FE" />
          <circle cx="20" cy="20" r="10" fill="#0369A1" />
          <path d="M13 20c3-4 11-4 14 0-3 4-11 4-14 0z" fill="#E0F2FE" />
          <circle cx="20" cy="20" r="3" fill="#0369A1" />
        </svg>
      );
    case 'CASHPLUS':
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
          <rect width="40" height="40" rx="8" fill="#CCFBF1" />
          <circle cx="20" cy="20" r="10" fill="#0D9488" />
          <path d="M15 20h10M20 15v10" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
          <rect width="40" height="40" rx="8" fill="#ECFDF5" />
          <path d="M10 17h20v12H10z" fill="#059669" />
          <path d="M8 17l12-7 12 7H8z" fill="#065F46" />
        </svg>
      );
  }
};
