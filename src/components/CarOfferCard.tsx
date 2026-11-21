import React from 'react';
import {
  Star,
  Fuel,
  Users,
  Gauge,
  ArrowLeft,
  ShieldCheck,
  CalendarClock,
} from 'lucide-react';
import { CarImage } from './CarImage';
import type { CarOffer } from '../types/karya';

interface CarOfferCardProps {
  car: CarOffer;
  searchDays: number;
  onSelect: (car: CarOffer) => void;
}

function getFuelLabel(fuel: CarOffer['fuel_type']): string {
  if (fuel === 'diesel') return 'ديزل';
  if (fuel === 'hybrid') return 'هجين';
  if (fuel === 'electric') return 'كهرباء';
  return 'بنزين';
}

function formatDays(d: number): string {
  if (d <= 10) return `${d} أيام`;
  return `${d} يومًا`;
}

function formatBookedUntil(iso?: string | null): string | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString('ar-MA', {
    day: 'numeric',
    month: 'short',
  });
}

export const CarOfferCard: React.FC<CarOfferCardProps> = ({
  car,
  searchDays,
  onSelect,
}) => {
  const total = car.daily_price * searchDays;
  const isBooked = Boolean(car.is_booked);
  const bookedUntilText = formatBookedUntil(car.booked_until);

  return (
    <article
      className={`group bg-[var(--karya-surface)] rounded-xl border overflow-hidden flex flex-col transition-all duration-200 ${
        isBooked
          ? 'border-red-200/90 bg-slate-50/60'
          : 'border-[var(--karya-border)] hover:border-[var(--karya-action)]/45 hover:shadow-[0_10px_28px_-10px_rgba(23,59,87,0.16)] hover:-translate-y-0.5'
      }`}
    >
      {/* Automotive Showcase Image */}
      <button
        type="button"
        disabled={isBooked}
        onClick={() => {
          if (!isBooked) onSelect(car);
        }}
        className={`h-40 sm:h-auto sm:aspect-[16/10] bg-slate-100 overflow-hidden block w-full text-right relative ${
          isBooked ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
        aria-label={
          isBooked
            ? `${car.brand} ${car.model} — محجوزة حالياً`
            : `حجز ${car.brand} ${car.model}`
        }
      >
        <CarImage
          src={car.primary_image_url}
          brand={car.brand}
          model={car.model}
          alt={`${car.brand} ${car.model}`}
          className={`w-full h-full object-cover transition-transform duration-500 ease-out ${
            isBooked
              ? 'grayscale-[50%] blur-[1.5px] opacity-75 scale-[1.02]'
              : 'group-hover:scale-[1.04]'
          }`}
        />

        {!isBooked && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/20 to-transparent"
            aria-hidden="true"
          />
        )}

        {/* Rating Badge (only shown when real ratings exist) */}
        {car.agency_rating_count > 0 && car.agency_rating > 0 && (
          <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-lg bg-white/95 backdrop-blur-xs px-2.5 py-1 text-xs font-extrabold text-[var(--karya-primary)] shadow-sm border border-black/5">
            <Star
              className="w-3.5 h-3.5 fill-[#D49A42] text-[#D49A42]"
              aria-hidden="true"
            />
            <span className="font-mono-tabular">{car.agency_rating.toFixed(1)}</span>
          </div>
        )}

        {/* Model Year Label */}
        {car.model_year && !isBooked && (
          <span className="absolute top-3 right-3 inline-flex items-center rounded-lg bg-[#173B57]/90 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 shadow-sm font-mono-tabular">
            {car.model_year}
          </span>
        )}

        {/* Currently Booked Overlay */}
        {isBooked && (
          <div className="absolute inset-0 bg-[#173B57]/60 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-4 py-1.5 text-xs font-extrabold shadow-md">
              محجوزة حالياً
            </span>
            {bookedUntilText && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 text-[var(--karya-primary)] px-3 py-1 text-[11px] font-bold shadow-sm">
                <CalendarClock className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                <span>تتوفر ابتداءً من {bookedUntilText}</span>
              </span>
            )}
          </div>
        )}
      </button>

      {/* Card Body */}
      <div className="p-3.5 sm:p-5 flex-1 flex flex-col gap-3 sm:gap-3.5">
        {/* Car Title, Agency & No-Deposit Indicator */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-extrabold text-base sm:text-lg text-[var(--karya-primary)] leading-snug truncate">
              {car.brand} {car.model}
            </h3>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[var(--karya-text-muted)] font-medium truncate">
              {car.agency_name}
            </span>
            <span className="inline-flex items-center gap-1 font-bold text-[var(--karya-action)] shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>بدون ضمانة مالية</span>
            </span>
          </div>
        </div>

        {/* Unified Specs Bar with Neutral Icons & Hairline Dividers */}
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-[var(--karya-border)] rounded-lg bg-[var(--karya-bg)] border border-[var(--karya-border)]/70 py-2">
          <div className="px-2 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[var(--karya-text)]">
            <Fuel className="w-3.5 h-3.5 text-[var(--karya-text-muted)] shrink-0" aria-hidden="true" />
            <span className="truncate">{getFuelLabel(car.fuel_type)}</span>
          </div>
          <div className="px-2 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[var(--karya-text)]">
            <Users className="w-3.5 h-3.5 text-[var(--karya-text-muted)] shrink-0" aria-hidden="true" />
            <span className="truncate">{car.seats} مقاعد</span>
          </div>
          <div className="px-2 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[var(--karya-text)]">
            <Gauge className="w-3.5 h-3.5 text-[var(--karya-text-muted)] shrink-0" aria-hidden="true" />
            <span className="truncate">
              {car.transmission === 'automatic' ? 'أوتوماتيك' : 'يدوي'}
            </span>
          </div>
        </div>

        {/* Prominent Daily Price & Booking CTA */}
        <div className="mt-auto pt-3 sm:pt-3.5 border-t border-[var(--karya-border)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[var(--karya-text-muted)] mb-0.5">
              السعر اليومي
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-extrabold text-[var(--karya-primary)] font-mono-tabular leading-none">
                {car.daily_price}
              </span>
              <span className="text-xs font-bold text-[var(--karya-text-muted)]">DH / يوم</span>
            </div>
            {total > 0 && (
              <p className="text-[11px] text-[var(--karya-text-muted)] mt-1 font-mono-tabular truncate">
                الإجمالي <strong className="text-[var(--karya-text)]">{total} DH</strong> ·{' '}
                {formatDays(searchDays)}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={isBooked}
            onClick={() => {
              if (!isBooked) onSelect(car);
            }}
            className={`shrink-0 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 min-h-[44px] rounded-lg text-sm font-extrabold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--karya-action)] focus-visible:ring-offset-2 ${
              isBooked
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] active:scale-[0.98] text-white shadow-xs'
            }`}
          >
            {isBooked ? (
              <span>غير متاحة</span>
            ) : (
              <>
                <span>احجز الآن</span>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};
