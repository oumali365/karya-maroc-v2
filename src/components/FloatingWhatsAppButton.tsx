import React, { useState } from 'react';
import { HelpCircle, ShieldCheck, X, MessageCircle } from 'lucide-react';

export const CONFIGURED_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP || '')
  .replace(/[^0-9]/g, '')
  .trim();

export const DEFAULT_SUPPORT_MESSAGE = encodeURIComponent(
  'مرحباً فريق دعم Karya، أحتاج إلى مساعدة بخصوص حجز سيارة بدون ضمانة مالية عبر المنصة.',
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
        className="fixed bottom-[76px] left-4 md:bottom-6 md:left-6 z-30 inline-flex items-center justify-center md:gap-2 rounded-xl bg-[var(--karya-primary)] hover:bg-[var(--karya-action)] text-white w-12 h-12 md:w-auto md:h-auto md:px-4 md:py-2.5 shadow-lg shadow-[#173B57]/20 border border-white/15 transition-all hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--karya-action)]"
      >
        <MessageCircle className="w-5 h-5 md:w-4 md:h-4 shrink-0 text-[var(--karya-accent)]" aria-hidden="true" />
        <span className="hidden md:inline text-xs font-extrabold whitespace-nowrap">
          دعم واتساب
        </span>
      </a>
    );
  }

  return (
    <div className="fixed bottom-[76px] left-4 md:bottom-6 md:left-6 z-30" dir="rtl">
      {open && (
        <div className="mb-3 w-72 sm:w-80 rounded-xl bg-[var(--karya-surface)] border border-[var(--karya-border)] shadow-xl p-4 space-y-2.5 text-xs text-[var(--karya-text)]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-[var(--karya-primary)] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[var(--karya-action)]" />
              <span>كيف تعمل منصة Karya؟</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق المساعدة"
              className="p-1.5 rounded-lg text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)] hover:bg-[var(--karya-bg)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ul className="space-y-1.5 leading-relaxed text-[11px] text-[var(--karya-text-muted)]">
            <li>• كراء بدون ضمانة مالية أو شيك ضمان، ولمدة لا تقل عن 3 أيام.</li>
            <li>• يجب أن تكون لديك رخصة سياقة منذ سنتين على الأقل.</li>
            <li>• تدفع 10% لتأكيد الحجز والمبلغ المتبقي (90%) مباشرة للوكالة عند الاستلام.</li>
            <li>• إذا لم تتمكن الوكالة من تسليم السيارة، يمكنك طلب استرجاع المبلغ من صفحة «حجوزاتي» وفق الإجراءات المعتمدة.</li>
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="دليل ومساعدة المنصة"
        className="inline-flex items-center justify-center md:gap-2 rounded-xl bg-[var(--karya-primary)] hover:bg-[var(--karya-action)] text-white w-12 h-12 md:w-auto md:h-auto md:px-4 md:py-2.5 shadow-lg shadow-[#173B57]/20 border border-white/15 transition-all hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--karya-action)]"
      >
        <HelpCircle className="w-5 h-5 md:w-4 md:h-4 shrink-0 text-[var(--karya-accent)]" aria-hidden="true" />
        <span className="hidden md:inline text-xs font-extrabold whitespace-nowrap">مساعدة</span>
      </button>
    </div>
  );
};
