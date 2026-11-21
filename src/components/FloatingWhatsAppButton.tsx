import React from 'react';
import { MessageCircle } from 'lucide-react';

function normalizeMoroccanWhatsApp(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').trim();
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length === 10) {
    return `212${digits.slice(1)}`;
  }
  return digits;
}

export const PLATFORM_WHATSAPP_DISPLAY = '0772865632';

export const CONFIGURED_WHATSAPP = normalizeMoroccanWhatsApp(
  import.meta.env.VITE_SUPPORT_WHATSAPP || PLATFORM_WHATSAPP_DISPLAY,
);

export const DEFAULT_SUPPORT_MESSAGE = encodeURIComponent(
  'مرحباً فريق Karya، أرغب في التواصل بخصوص خدمات المنصة.',
);

export const FloatingWhatsAppButton: React.FC = () => {
  const phone = CONFIGURED_WHATSAPP || '212772865632';
  const href = `https://wa.me/${phone}?text=${DEFAULT_SUPPORT_MESSAGE}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`تواصل مباشر عبر واتساب (${PLATFORM_WHATSAPP_DISPLAY})`}
      title={`واتساب Karya: ${PLATFORM_WHATSAPP_DISPLAY}`}
      className="hidden md:inline-flex fixed bottom-6 left-6 z-30 items-center justify-center gap-2 rounded-xl bg-[var(--karya-primary)] hover:bg-[var(--karya-action)] text-white px-4 py-2.5 shadow-lg shadow-[#173B57]/20 border border-white/15 transition-all hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--karya-action)]"
    >
      <MessageCircle className="w-5 h-5 md:w-4 md:h-4 shrink-0 text-[var(--karya-accent)]" aria-hidden="true" />
      <span className="hidden md:inline text-xs font-extrabold whitespace-nowrap">
        واتساب مباشر
      </span>
    </a>
  );
};
