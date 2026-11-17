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
      className={`group bg-white rounded-2xl border overflow-hidden flex flex-col shadow-sm transition-all duration-200 ${
        isBooked
          ? 'border-red-200/80 bg-slate-50/40'
          : 'border-slate-200/80 hover:border-[#0F2942]/25 hover:shadow-lg hover:-translate-y-0.5'
      }`}
    >
      {/* Top Car Image with Rounded Top Corners */}
      <button
        type="button"
        disabled={isBooked}
        onClick={() => {
          if (!isBooked) onSelect(car);
        }}
        className={`aspect-[4/3] bg-slate-100 overflow-hidden block w-full text-right relative rounded-t-2xl ${
          isBooked ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
        aria-label={
          isBooked
            ? `${car.brand} ${car.model} — محجوزة حالياً`
            : `حجز ${car.brand} ${car.model}`
        }
      >
        <img
          src={car.primary_image_url}
          alt={`${car.brand} ${car.model}`}
          referrerPolicy="no-referrer"
          loading="lazy"
          className={`w-full h-full object-cover transition-transform duration-500 ease-out ${
            isBooked
              ? 'grayscale-[50%] blur-[1.5px] opacity-75 scale-[1.02]'
              : 'group-hover:scale-[1.04]'
          }`}
        />

        {/* Floating Rating Badge on Top Left */}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-xl bg-white/95 backdrop-blur-xs px-2.5 py-1 text-xs font-extrabold text-[#0F2942] shadow-md">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
          <span className="font-mono-tabular">{car.agency_rating.toFixed(1)}</span>
        </div>

        {/* Model Year Tag on Top Right (when available) */}
        {car.model_year && !isBooked && (
          <span className="absolute top-3 right-3 inline-flex items-center rounded-xl bg-[#0F2942]/85 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 shadow-sm font-mono-tabular">
            {car.model_year}
          </span>
        )}

        {/* Unavailable / Currently Booked Overlay Variant */}
        {isBooked && (
          <div className="absolute inset-0 bg-[#0F2942]/55 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 text-white px-4 py-1.5 text-xs font-extrabold shadow-lg">
              محجوزة حالياً
            </span>
            {bookedUntilText && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/95 text-[#0F2942] px-3 py-1 text-[11px] font-bold shadow-sm">
                <CalendarClock className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                <span>تتوفر ابتداءً من {bookedUntilText}</span>
              </span>
            )}
          </div>
        )}
      </button>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col gap-3.5">
        {/* Car & Agency Name */}
        <div className="space-y-0.5">
          <h3 className="font-extrabold text-lg text-[#0F2942] leading-snug truncate">
            {car.brand} {car.model}
          </h3>
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <span className="truncate">{car.agency_name}</span>
            <span className="inline-flex items-center gap-1 font-bold text-[#0D9488] shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>0 DH كفالة</span>
            </span>
          </div>
        </div>

        {/* Clean Specs Row with Soft Gray Backgrounds */}
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-xl bg-[#F4F6F9] px-2.5 py-2 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#0F2942]">
            <Fuel className="w-3.5 h-3.5 text-[#0D9488] shrink-0" aria-hidden="true" />
            <span className="truncate">{getFuelLabel(car.fuel_type)}</span>
          </div>
          <div className="flex-1 rounded-xl bg-[#F4F6F9] px-2.5 py-2 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#0F2942]">
            <Users className="w-3.5 h-3.5 text-[#0D9488] shrink-0" aria-hidden="true" />
            <span className="truncate">{car.seats} مقاعد</span>
          </div>
          <div className="flex-1 rounded-xl bg-[#F4F6F9] px-2.5 py-2 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#0F2942]">
            <Gauge className="w-3.5 h-3.5 text-[#0D9488] shrink-0" aria-hidden="true" />
            <span className="truncate">
              {car.transmission === 'automatic' ? 'أوتوماتيك' : 'يدوي'}
            </span>
          </div>
        </div>

        {/* Price (Right) & CTA Button (Left) */}
        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-[#0F2942] font-mono-tabular leading-none">
                {car.daily_price}
              </span>
              <span className="text-xs font-bold text-slate-500">DH / يوم</span>
            </div>
            {total > 0 && (
              <p className="text-[11px] text-slate-500 mt-1 font-mono-tabular">
                الإجمالي <strong className="text-[#0F2942]">{total} DH</strong> · {formatDays(searchDays)}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={isBooked}
            onClick={() => {
              if (!isBooked) onSelect(car);
            }}
            className={`shrink-0 inline-flex items-center gap-1.5 px-5 py-2.5 min-h-[44px] rounded-xl text-sm font-extrabold transition-all ${
              isBooked
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-[#0D9488] hover:bg-[#0F766E] active:scale-[0.98] text-white shadow-sm shadow-teal-600/20'
            }`}
          >
            {isBooked ? (
              <span>غير متوفرة</span>
            ) : (
              <>
                <span>احجز</span>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};
