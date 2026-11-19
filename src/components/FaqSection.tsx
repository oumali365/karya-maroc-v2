import React, { useId, useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export interface FaqItem {
  q: string;
  a: string;
}

interface FaqSectionProps {
  title: string;
  subtitle: string;
  ariaLabel: string;
  items: FaqItem[];
  className?: string;
}

export const FaqSection: React.FC<FaqSectionProps> = ({
  title,
  subtitle,
  ariaLabel,
  items,
  className = '',
}) => {
  const baseId = useId();
  const [openIndices, setOpenIndices] = useState<Set<number>>(() => new Set([0]));

  const allExpanded = items.length > 0 && openIndices.size === items.length;

  const toggleItem = (idx: number) => {
    setOpenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) {
      setOpenIndices(new Set());
    } else {
      setOpenIndices(new Set(items.map((_, i) => i)));
    }
  };

  return (
    <section aria-label={ariaLabel} className={className} dir="rtl">
      <div className="space-y-5">
        {/* Clean Editorial Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 px-1">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[var(--karya-action-soft)] border border-[var(--karya-action)]/15 text-[var(--karya-action)] flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-[var(--karya-primary)]">
                {title}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--karya-text-muted)] leading-relaxed">
                {subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleAll}
            className="self-start sm:self-auto shrink-0 text-xs font-bold text-[var(--karya-action)] hover:text-[var(--karya-action-hover)] hover:underline px-2 py-1.5 rounded-lg transition-colors"
          >
            {allExpanded ? 'طي جميع الإجابات' : 'عرض جميع الإجابات'}
          </button>
        </div>

        {/* Responsive 2-Column Comfortable Card Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4 items-start">
          {items.map((item, idx) => {
            const isOpen = openIndices.has(idx);
            const numLabel = String(idx + 1).padStart(2, '0');
            const buttonId = `${baseId}-btn-${idx}`;
            const panelId = `${baseId}-panel-${idx}`;

            return (
              <div
                key={item.q}
                className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                  isOpen
                    ? 'bg-white border-[var(--karya-action)]/45 shadow-sm ring-1 ring-[var(--karya-action)]/10'
                    : 'bg-white border-[var(--karya-border)] hover:border-slate-300'
                }`}
              >
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleItem(idx)}
                  className="w-full flex items-start justify-between gap-3 text-right p-4 sm:p-5 min-h-[64px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--karya-action)]"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-lg font-mono-tabular text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        isOpen
                          ? 'bg-[var(--karya-action)] text-white'
                          : 'bg-[var(--karya-bg)] text-[var(--karya-primary)] border border-[var(--karya-border)]'
                      }`}
                      aria-hidden="true"
                    >
                      {numLabel}
                    </span>
                    <span className="text-[13.5px] sm:text-[15px] font-extrabold text-[var(--karya-primary)] leading-relaxed pt-0.5">
                      {item.q}
                    </span>
                  </div>

                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      isOpen
                        ? 'bg-[var(--karya-action-soft)] text-[var(--karya-action)]'
                        : 'bg-[var(--karya-bg)] text-[var(--karya-text-muted)]'
                    }`}
                    aria-hidden="true"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </span>
                </button>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                      <div className="pt-3.5 border-t border-[var(--karya-border)]/70">
                        <p className="text-[13px] sm:text-sm text-[var(--karya-text)]/85 leading-[1.85]">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
