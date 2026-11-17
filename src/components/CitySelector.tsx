import React from 'react';
import { MapPin, Check } from 'lucide-react';

export interface CityCardOption {
  cityFr: string;
  cityAr: string;
  subtitle: string;
}

export const DELIVERY_CITIES: CityCardOption[] = [
  { cityFr: 'Casablanca', cityAr: 'الدار البيضاء', subtitle: 'التسليم داخل المدينة' },
  { cityFr: 'Rabat', cityAr: 'الرباط', subtitle: 'التسليم داخل المدينة' },
  { cityFr: 'Marrakech', cityAr: 'مراكش', subtitle: 'التسليم داخل المدينة' },
  { cityFr: 'Tangier', cityAr: 'طنجة', subtitle: 'التسليم داخل المدينة' },
  { cityFr: 'Fès', cityAr: 'فاس', subtitle: 'التسليم داخل المدينة' },
  { cityFr: 'Agadir', cityAr: 'أكادير', subtitle: 'التسليم داخل المدينة' },
];

interface CitySelectorProps {
  selectedCity: string;
  onSelectCity: (cityFr: string) => void;
}

export const CitySelector: React.FC<CitySelectorProps> = ({
  selectedCity,
  onSelectCity,
}) => {
  return (
    <section
      className="max-w-6xl mx-auto px-4 sm:px-6 pt-7 pb-1"
      aria-label="التسليم داخل المدينة"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm sm:text-base font-extrabold text-[var(--karya-primary)]">
          التسليم داخل المدينة
        </h2>
        <span className="text-xs font-medium text-[var(--karya-text-muted)]">
          اختر مدينة الاستلام
        </span>
      </div>

      <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-2.5 overflow-x-auto no-scrollbar snap-x pb-1">
        {DELIVERY_CITIES.map((item) => {
          const isSelected = selectedCity.toLowerCase() === item.cityFr.toLowerCase();

          return (
            <button
              key={item.cityFr}
              type="button"
              onClick={() => onSelectCity(item.cityFr)}
              aria-pressed={isSelected}
              className={`snap-start shrink-0 min-w-[148px] sm:min-w-0 min-h-[58px] text-right rounded-xl border px-3 py-2.5 transition-all duration-150 flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--karya-action)] ${
                isSelected
                  ? 'bg-[var(--karya-action-soft)] border-[var(--karya-action)] shadow-xs'
                  : 'bg-[var(--karya-surface)] border-[var(--karya-border)] hover:border-[var(--karya-action)]/45'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-[var(--karya-primary)] text-white'
                      : 'bg-[var(--karya-bg)] text-[var(--karya-text-muted)]'
                  }`}
                  aria-hidden="true"
                >
                  <MapPin className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div
                    className={`text-xs font-extrabold truncate ${
                      isSelected ? 'text-[var(--karya-primary)]' : 'text-[var(--karya-text)]'
                    }`}
                  >
                    {item.cityAr}
                  </div>
                  <div className="text-[11px] font-medium text-[var(--karya-text-muted)] truncate">
                    {item.subtitle}
                  </div>
                </div>
              </div>

              {isSelected && (
                <span
                  className="w-5 h-5 rounded-md bg-[var(--karya-action)] text-white flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};
