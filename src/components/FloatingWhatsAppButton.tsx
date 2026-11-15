import React from 'react';
import { useLanguage } from '../i18n';

const SUPPORT_WHATSAPP_NUMBER = '212600000000';

export const FloatingWhatsAppButton: React.FC = () => {
  const { t, dir } = useLanguage();
  const href = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(t('whatsapp.message'))}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('whatsapp.ariaLabel')}
      title={t('whatsapp.title')}
      className={`fixed bottom-5 ${
        dir === 'rtl' ? 'left-5' : 'right-5'
      } z-40 inline-flex items-center gap-2.5 rounded-full bg-navy hover:bg-navy-light text-white border border-gold/40 px-4 py-3 min-h-[48px] shadow-lg shadow-navy/25 transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gold`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-5 h-5 shrink-0"
        aria-hidden="true"
      >
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.78 14.08c-.24.68-1.41 1.3-1.95 1.38-.5.08-1.13.11-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.26-4.79-4.18-4.94-4.38-.15-.2-1.18-1.57-1.18-3 0-1.43.75-2.13 1.01-2.42.26-.29.58-.36.77-.36.19 0 .38 0 .55.01.18.01.42-.07.65.49.24.58.82 2.01.89 2.16.07.15.12.32.02.52-.1.2-.15.32-.3.49-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.75 1.24 1.61 2.01 1.11.99 2.04 1.3 2.33 1.44.29.15.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.64-.15.26.1 1.68.79 1.97.94.29.14.48.22.55.34.07.12.07.69-.17 1.37z" />
      </svg>
      <span className="hidden sm:inline text-xs font-bold whitespace-nowrap">
        {t('whatsapp.label')}
      </span>
    </a>
  );
};
