import React, { useState } from 'react';
import { HelpCircle, ShieldCheck, X, MessageCircle } from 'lucide-react';

const CONFIGURED_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP || '')
  .replace(/[^0-9]/g, '')
  .trim();

const DEFAULT_SUPPORT_MESSAGE = encodeURIComponent(
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
        className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 min-h-[44px] shadow-md shadow-slate-900/15 transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900"
      >
        <MessageCircle className="w-4 h-4 shrink-0 text-emerald-400" aria-hidden="true" />
        <span className="hidden sm:inline text-xs font-bold whitespace-nowrap">مساعدة</span>
      </a>
    );
  }

  return (
    <div className="fixed bottom-5 left-5 z-40" dir="rtl">
      {open && (
        <div className="mb-3 w-72 rounded-2xl bg-white border border-slate-200 shadow-xl p-4 space-y-2.5 text-xs text-slate-700">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
              <span>كيف تعمل منصة Karya؟</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق المساعدة"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
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
        className="inline-flex items-center gap-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 min-h-[44px] shadow-md shadow-slate-900/15 transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900"
      >
        <HelpCircle className="w-4 h-4 shrink-0 text-blue-400" aria-hidden="true" />
        <span className="hidden sm:inline text-xs font-bold whitespace-nowrap">كيف نعمل؟</span>
      </button>
    </div>
  );
};
