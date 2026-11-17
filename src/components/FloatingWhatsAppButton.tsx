import React, { useState } from 'react';
import { HelpCircle, ShieldCheck, X, MessageCircle } from 'lucide-react';

export const CONFIGURED_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP || '')
  .replace(/[^0-9]/g, '')
  .trim();

export const DEFAULT_SUPPORT_MESSAGE = encodeURIComponent(
  'مرحباً فريق دعم Karya، أحتاج إلى مساعدة بخصوص حجز سيارة.',
);

export const FloatingWhatsAppButton: React.FC = () => {
  const [open, setOpen] = useState(false);

  if (CONFIGURED_WHATSAPP.length >= 9) {
    const href = `https://wa.me/${CONFIGURED_WHATSAPP}?text=${DEFAULT_SUPPORT_MESSAGE}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="تواصل مع الدعم الفني عبر واتساب"
        title="تواصل مع الدعم الفني عبر واتساب"
        className="fixed bottom-[76px] left-4 md:bottom-6 md:left-6 z-30 inline-flex items-center justify-center md:gap-2 rounded-full bg-[#0D9488] hover:bg-[#0F766E] text-white w-12 h-12 md:w-auto md:h-auto md:px-4 md:py-2.5 shadow-lg shadow-teal-900/20 transition-transform hover:scale-[1.04] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0D9488]"
      >
        <MessageCircle className="w-5 h-5 md:w-4 md:h-4 shrink-0" aria-hidden="true" />
        <span className="hidden md:inline text-xs font-extrabold whitespace-nowrap">
          دعم واتساب
        </span>
      </a>
    );
  }

  return (
    <div className="fixed bottom-[76px] left-4 md:bottom-6 md:left-6 z-30" dir="rtl">
      {open && (
        <div className="mb-3 w-72 sm:w-80 rounded-2xl bg-white border border-slate-200 shadow-2xl p-4 space-y-2.5 text-xs text-slate-700">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-[#0F2942] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0D9488]" />
              <span>كيف تعمل منصة Karya؟</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق المساعدة"
              className="p-1 rounded-lg text-slate-400 hover:text-[#0F2942] hover:bg-slate-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ul className="space-y-1.5 leading-relaxed text-[11px] text-slate-600">
            <li>• بدون كفالة أو شيك ضمان (0 DH) وبحد أدنى 3 أيام.</li>
            <li>• يشترط توفر رخصة سياقة بأقدمية سنتين على الأقل.</li>
            <li>• تدفع 10% كتسبيق لتثبيت الحجز و90% مباشرة عند الاستلام.</li>
            <li>• إذا تعذر توفر السيارة، تسترجع تسبيقك 100% من صفحة «حجوزاتي».</li>
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="دليل ومساعدة المنصة"
        className="inline-flex items-center justify-center md:gap-2 rounded-full bg-[#0F2942] hover:bg-[#173B5E] text-white w-12 h-12 md:w-auto md:h-auto md:px-4 md:py-2.5 shadow-lg shadow-[#0F2942]/25 transition-transform hover:scale-[1.04] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0F2942]"
      >
        <HelpCircle className="w-5 h-5 md:w-4 md:h-4 shrink-0 text-[#2DD4BF]" aria-hidden="true" />
        <span className="hidden md:inline text-xs font-extrabold whitespace-nowrap">مساعدة</span>
      </button>
    </div>
  );
};
