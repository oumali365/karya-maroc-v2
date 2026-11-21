import React, { useEffect, useId, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  ChevronDown,
  MapPin,
  Star,
} from 'lucide-react';
import { getCityLabelAr } from '../lib/supabase';
import {
  formatCarsCountAr,
  type AgencyGroup,
} from '../lib/agencyGrouping';
import { CarOfferCard } from './CarOfferCard';
import type { CarOffer } from '../types/karya';

export {
  formatAgenciesCountAr,
  formatCarsCountAr,
  groupCarsByAgency,
  type AgencyGroup,
} from '../lib/agencyGrouping';

interface AgencyGroupListProps {
  groups: AgencyGroup[];
  searchDays: number;
  resetKey: string;
  onSelectCar: (car: CarOffer) => void;
}

export const AgencyGroupList: React.FC<AgencyGroupListProps> = ({
  groups,
  searchDays,
  resetKey,
  onSelectCar,
}) => {
  const baseId = useId();
  const [openKeys, setOpenKeys] = useState<Set<string>>(() =>
    groups.length > 0 ? new Set([groups[0].groupKey]) : new Set(),
  );

  // Open the first agency by default when search/filter context changes
  useEffect(() => {
    if (groups.length > 0) {
      setOpenKeys(new Set([groups[0].groupKey]));
    } else {
      setOpenKeys(new Set());
    }
  }, [resetKey, groups.length > 0 ? groups[0]?.groupKey : '']);

  const toggleGroup = (groupKey: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3 sm:space-y-3.5">
      {groups.map((group, idx) => {
        const isOpen = openKeys.has(group.groupKey);
        const buttonId = `${baseId}-agency-btn-${idx}`;
        const panelId = `${baseId}-agency-panel-${idx}`;
        const hasMixedOrFullBooked = group.availableNowCount < group.totalCount;

        return (
          <section
            key={group.groupKey}
            aria-labelledby={buttonId}
            className={`bg-[var(--karya-surface)] rounded-xl border transition-colors overflow-hidden ${
              isOpen
                ? 'border-[var(--karya-action)]/40'
                : 'border-[var(--karya-border)] hover:border-slate-300'
            }`}
          >
            {/* Compact, Calm Agency Header */}
            <button
              id={buttonId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggleGroup(group.groupKey)}
              className={`w-full flex items-center justify-between gap-2.5 sm:gap-3 text-right px-3.5 py-2.5 sm:px-5 sm:py-3.5 min-h-[58px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--karya-action)] ${
                isOpen
                  ? 'bg-[var(--karya-action-soft)]/35 hover:bg-[var(--karya-action-soft)]/55'
                  : 'bg-white hover:bg-[var(--karya-surface-muted)]'
              }`}
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isOpen
                      ? 'bg-[var(--karya-primary)] text-white'
                      : 'bg-[var(--karya-bg)] text-[var(--karya-primary)] border border-[var(--karya-border)]/80'
                  }`}
                  aria-hidden="true"
                >
                  <Building2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                </div>

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h3 className="text-[13.5px] sm:text-[15px] font-extrabold text-[var(--karya-primary)] truncate">
                      {group.agencyName}
                    </h3>

                    {group.isVerified && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-[var(--karya-bg)] border border-[var(--karya-border)]/80 text-[var(--karya-text-muted)] px-1.5 py-0.5 text-[10px] font-semibold shrink-0">
                        <BadgeCheck
                          className="w-3 h-3 text-[var(--karya-action)] shrink-0"
                          aria-hidden="true"
                        />
                        <span>وكالة موثقة</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] sm:text-xs text-[var(--karya-text-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span>{getCityLabelAr(group.city)}</span>
                    </span>

                    {group.ratingCount > 0 && group.ratingAvg > 0 && (
                      <span className="inline-flex items-center gap-1 font-bold text-[var(--karya-primary)]">
                        <Star
                          className="w-3 h-3 fill-[#D49A42] text-[#D49A42] shrink-0"
                          aria-hidden="true"
                        />
                        <span className="font-mono-tabular">
                          {group.ratingAvg.toFixed(1)}
                        </span>
                        <span className="font-normal text-[var(--karya-text-muted)]">
                          ({group.ratingCount})
                        </span>
                      </span>
                    )}

                    {hasMixedOrFullBooked && (
                      <span className="text-[11px] font-medium text-[var(--karya-text-muted)]">
                        {group.availableNowCount > 0
                          ? `· ${group.availableNowCount} متاحة الآن`
                          : '· محجوزة في هذا التاريخ'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="rounded-md bg-[var(--karya-bg)] border border-[var(--karya-border)]/80 px-2 py-1 text-[11px] sm:text-xs font-bold text-[var(--karya-primary)] whitespace-nowrap">
                  {formatCarsCountAr(group.totalCount)}
                </span>

                <span
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                    isOpen
                      ? 'text-[var(--karya-primary)]'
                      : 'text-[var(--karya-text-muted)]'
                  }`}
                  aria-hidden="true"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </span>
              </div>
            </button>

            {/* Collapsible Cars Grid */}
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="p-3.5 sm:p-5 border-t border-[var(--karya-border)] bg-[var(--karya-surface-muted)]/60">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {group.cars.map((car) => (
                      <CarOfferCard
                        key={car.id}
                        car={car}
                        searchDays={searchDays}
                        onSelect={onSelectCar}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
};
