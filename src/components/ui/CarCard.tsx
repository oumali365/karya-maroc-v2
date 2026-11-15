import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CarFront, Star } from 'lucide-react';
import { useLanguage } from '../../i18n';
import type { CarOffer } from '../../types/karya';
import { PrimaryButton } from './Button';

export interface CarCardProps {
  car: CarOffer;
  onBook: (car: CarOffer) => void;
}

export const CarCard: React.FC<CarCardProps> = ({ car, onBook }) => {
  const { t, dir, formatPrice } = useLanguage();
  const [imgFailed, setImgFailed] = useState(false);

  const fuelLabel = t(`car.fuel.${car.fuel_type || 'diesel'}`);
  const transmissionLabel = t(`car.transmission.${car.transmission || 'manual'}`);

  return (
    <article className="group bg-white rounded-2xl border border-[#EAE6DD] hover:border-gold/60 transition-all duration-200 overflow-hidden flex flex-col shadow-xs hover:shadow-md">
      <button
        type="button"
        onClick={() => onBook(car)}
        aria-label={`${t('car.viewDetailsAria')} ${car.brand} ${car.model}`}
        className="relative aspect-[4/3] w-full bg-ivory overflow-hidden cursor-pointer text-start block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
      >
        {!imgFailed && car.primary_image_url ? (
          <img
            src={car.primary_image_url}
            alt={`${car.brand} ${car.model}`}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-navy/5 to-gold/10 text-ink-muted p-6">
            <CarFront className="w-10 h-10 text-navy/40" />
            <span className="text-xs font-semibold text-ink font-latin">
              {car.brand} {car.model}
            </span>
          </div>
        )}
      </button>

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-lg text-ink font-latin truncate">
              {car.brand} {car.model}
            </h3>
            {car.model_year && (
              <span className="text-xs text-ink-muted font-latin tabular-nums">
                {t('car.modelYear')} {car.model_year}
              </span>
            )}
          </div>

          <div className="text-end shrink-0">
            <div className="font-latin tabular-nums font-extrabold text-lg text-navy leading-tight">
              {formatPrice(car.daily_price, 0)}
            </div>
            <span className="text-[11px] text-ink-muted block">{t('common.perDay')}</span>
          </div>
        </div>

        {/* Clean zero-pill metadata with typographic separators */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted mt-3">
          <span>{fuelLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{transmissionLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {car.seats} {t('car.seats')}
          </span>
          {car.distance_km != null && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-latin tabular-nums text-navy font-medium">
                {car.distance_km.toFixed(1)} {t('common.km')}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-ink-muted mt-4 pt-3.5 border-t border-[#F0ECE3]">
          <span className="truncate font-medium text-ink/85">{car.agency_name}</span>
          {car.agency_rating > 0 && (
            <span className="inline-flex items-center gap-1 font-latin tabular-nums text-ink font-semibold shrink-0">
              <Star className="w-3.5 h-3.5 text-gold fill-gold" />
              {car.agency_rating.toFixed(1)}
            </span>
          )}
        </div>

        <PrimaryButton fullWidth onClick={() => onBook(car)} className="mt-4">
          <span>{t('car.bookNow')}</span>
          {dir === 'rtl' ? (
            <ArrowDownLeft className="w-4 h-4" />
          ) : (
            <ArrowUpRight className="w-4 h-4" />
          )}
        </PrimaryButton>
      </div>
    </article>
  );
};
