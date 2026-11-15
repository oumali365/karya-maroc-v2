import React, { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Search,
  CarFront,
  Star,
  Fuel,
  Users,
  Gauge,
  Calendar,
  ArrowLeft,
  Plane,
} from 'lucide-react';
import {
  supabase,
  MOROCCAN_CITIES,
  getCityLabelAr,
} from '../lib/supabase';
import { DEFAULT_CAR_IMAGE_URL, HERO_IMAGE_URL, STARTER_CARS } from '../data/starterData';
import { BookingModal } from './BookingModal';
import type { CarOffer, CreatedBooking } from '../types/karya';

interface CustomerPortalProps {
  onBookingCreated: (booking: CreatedBooking) => void;
  onGoToAgency: () => void;
}

const POPULAR_AIRPORTS = [
  { cityFr: 'Casablanca', cityAr: 'الدار البيضاء', airport: 'مطار محمد الخامس', code: 'CMN' },
  { cityFr: 'Marrakech', cityAr: 'مراكش', airport: 'مطار المنارة', code: 'RAK' },
  { cityFr: 'Agadir', cityAr: 'أكادير', airport: 'مطار المسيرة', code: 'AGA' },
  { cityFr: 'Tangier', cityAr: 'طنجة', airport: 'مطار ابن بطوطة', code: 'TNG' },
];

function getDefaultPickupDate(): string {
  const dt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function getFuelLabel(fuel: CarOffer['fuel_type']): string {
  if (fuel === 'diesel') return 'ديزل';
  if (fuel === 'hybrid') return 'هجين';
  if (fuel === 'electric') return 'كهرباء';
  return 'بنزين';
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  onBookingCreated,
  onGoToAgency,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>('Casablanca');

  const [searchPickupDate, setSearchPickupDate] = useState<string>(getDefaultPickupDate);
  const [searchDays, setSearchDays] = useState<number>(2);

  const [cars, setCars] = useState<CarOffer[]>([]);
  const [loadingCars, setLoadingCars] = useState(true);
  const [dbConnected, setDbConnected] = useState(false);

  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [transmissionFilter, setTransmissionFilter] = useState<'all' | 'automatic' | 'manual'>('all');
  const [selectedCar, setSelectedCar] = useState<CarOffer | null>(null);

  const loadCars = async (cityToLoad: string) => {
    setLoadingCars(true);
    try {
      const { data, error } = await supabase.rpc('get_nearby_cars', {
        p_city: cityToLoad,
        p_lat: null,
        p_lng: null,
        p_radius_km: 80,
      });

      if (!error && Array.isArray(data)) {
        const mapped: CarOffer[] = data.map((row: Record<string, unknown>) => ({
          id: String(row.car_id),
          agency_id: String(row.agency_id),
          agency_name: String(row.agency_name || 'وكالة معتمدة'),
          agency_rating: Number(row.agency_rating ?? 5),
          agency_rating_count: Number(row.agency_rating_count ?? 0),
          brand: String(row.brand),
          model: String(row.model),
          model_year: row.model_year ? Number(row.model_year) : null,
          fuel_type: (row.fuel_type as CarOffer['fuel_type']) || 'diesel',
          transmission: (row.transmission as CarOffer['transmission']) || 'manual',
          seats: Number(row.seats ?? 5),
          primary_image_url: String(row.primary_image_url),
          gallery_images: Array.isArray(row.gallery_images)
            ? (row.gallery_images as string[])
            : [String(row.primary_image_url)],
          daily_price: Number(row.daily_price),
          deposit_amount: Number(row.deposit_amount ?? 0),
          city: String(row.city),
          status: 'available',
          distance_km: row.distance_km != null ? Number(row.distance_km) : null,
          is_demo: false,
        }));
        setCars(mapped);
        setDbConnected(true);
        setLoadingCars(false);
        return;
      }

      const { data: tableData, error: tableErr } = await supabase
        .from('agency_cars')
        .select('*, car_catalog(*), agencies(name, rating_avg, rating_count)')
        .eq('city', cityToLoad)
        .eq('status', 'available');

      if (!tableErr && Array.isArray(tableData)) {
        const mapped: CarOffer[] = tableData.map((row: Record<string, any>) => ({
          id: String(row.id),
          agency_id: String(row.agency_id),
          agency_name: String(row.agencies?.name || 'وكالة معتمدة'),
          agency_rating: Number(row.agencies?.rating_avg ?? 5),
          agency_rating_count: Number(row.agencies?.rating_count ?? 0),
          brand: String(row.brand || row.car_catalog?.brand || 'سيارة'),
          model: String(row.model || row.car_catalog?.model || ''),
          model_year: row.model_year ? Number(row.model_year) : null,
          fuel_type: row.fuel_type || 'diesel',
          transmission: row.transmission || 'manual',
          seats: Number(row.seats ?? 5),
          primary_image_url: String(
            row.primary_image_url ||
              row.car_catalog?.image_url ||
              DEFAULT_CAR_IMAGE_URL,
          ),
          gallery_images: [
            String(
              row.primary_image_url ||
                row.car_catalog?.image_url ||
                DEFAULT_CAR_IMAGE_URL,
            ),
          ],
          daily_price: Number(row.daily_price),
          deposit_amount: Number(row.deposit_amount ?? 0),
          city: String(row.city),
          status: 'available',
          distance_km: null,
          is_demo: false,
        }));
        setCars(mapped);
        setDbConnected(true);
        setLoadingCars(false);
        return;
      }
    } catch {
      // Smoothly fall through to starter fleet
    }

    const demoCityCars = STARTER_CARS.filter(
      (c) => c.city.toLowerCase() === cityToLoad.toLowerCase(),
    );
    setCars(demoCityCars.length > 0 ? demoCityCars : STARTER_CARS.slice(0, 3));
    setDbConnected(false);
    setLoadingCars(false);
  };

  useEffect(() => {
    setBrandFilter('all');
    loadCars(selectedCity);
  }, [selectedCity]);

  const handleDiscoverClick = (e: React.FormEvent) => {
    e.preventDefault();
    loadCars(selectedCity);
    document.getElementById('fleet-offers')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectAirportCity = (cityFr: string) => {
    setSelectedCity(cityFr);
    document.getElementById('fleet-offers')?.scrollIntoView({ behavior: 'smooth' });
  };

  const availableBrands = useMemo(() => {
    return Array.from(new Set(cars.map((c) => c.brand).filter(Boolean)));
  }, [cars]);

  const filteredCars = useMemo(() => {
    return cars.filter((car) => {
      const matchTransmission =
        transmissionFilter === 'all' || car.transmission === transmissionFilter;
      const matchBrand = brandFilter === 'all' || car.brand === brandFilter;
      return matchTransmission && matchBrand;
    });
  }, [cars, transmissionFilter, brandFilter]);

  return (
    <div dir="rtl">
      {/* 1. Full-Bleed Edge-to-Edge Hero + Floating Fields Only */}
      <section className="relative w-full overflow-hidden bg-slate-900 min-h-[380px] sm:min-h-[430px] flex flex-col justify-end">
        <img
          src={HERO_IMAGE_URL}
          alt="سيارة كراء حديثة في المغرب"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-slate-950/25"
          aria-hidden="true"
        />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
          <div className="max-w-xl space-y-2">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-[1.2] [text-wrap:balance]">
              احجز سيارتك في المغرب خلال دقائق
            </h1>
            <p className="text-slate-200 text-sm sm:text-base">
              وكالات موثقة بأسعار واضحة · 10% تسبيق والباقي عند الاستلام.
            </p>
          </div>

          {/* Floating Inputs Only (Zero White Wrapper Background) */}
          <form
            onSubmit={handleDiscoverClick}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-5">
              <label
                htmlFor="hero-city-select"
                className="block text-xs font-semibold text-white/90 mb-1.5"
              >
                المدينة
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[#2563EB] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  id="hero-city-select"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full min-h-[46px] appearance-none rounded-xl bg-white pr-9 pl-3 py-2.5 text-sm font-semibold text-slate-900 shadow-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40"
                >
                  {MOROCCAN_CITIES.map((city) => (
                    <option key={city.slug} value={city.nameFr}>
                      {city.nameAr} ({city.nameFr})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="hero-pickup-date"
                className="block text-xs font-semibold text-white/90 mb-1.5"
              >
                تاريخ الاستلام
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden lg:block" />
                <input
                  id="hero-pickup-date"
                  type="date"
                  value={searchPickupDate}
                  onChange={(e) => setSearchPickupDate(e.target.value)}
                  className="w-full min-h-[46px] rounded-xl bg-white px-3 lg:pr-9 py-2.5 text-xs sm:text-sm font-mono-tabular text-slate-900 shadow-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="hero-days"
                className="block text-xs font-semibold text-white/90 mb-1.5"
              >
                المدة
              </label>
              <select
                id="hero-days"
                value={searchDays}
                onChange={(e) => setSearchDays(Number(e.target.value))}
                className="w-full min-h-[46px] rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40"
              >
                {[1, 2, 3, 4, 5, 7, 10, 14, 30].map((d) => (
                  <option key={d} value={d}>
                    {d === 1 ? 'يوم واحد' : d === 2 ? 'يومان' : `${d} أيام`}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full min-h-[46px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2.5 font-bold text-sm shadow-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Search className="w-4 h-4" />
                <span>بحث</span>
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* 2. Quick Moroccan Airports & Cities Strip */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-2">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {POPULAR_AIRPORTS.map((item) => {
            const active = selectedCity.toLowerCase() === item.cityFr.toLowerCase();
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => handleSelectAirportCity(item.cityFr)}
                className={`text-right rounded-xl border px-3.5 py-2.5 transition-colors flex items-center justify-between gap-2 ${
                  active
                    ? 'bg-blue-50/70 border-[#2563EB]/50 text-slate-900'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-800'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{item.cityAr}</div>
                  <div className="text-[11px] text-slate-500 truncate">{item.airport}</div>
                </div>
                <span className="inline-flex items-center gap-1 font-mono-tabular text-[11px] font-bold text-[#2563EB] shrink-0">
                  <Plane className="w-3.5 h-3.5" />
                  <span>{item.code}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Fleet Discovery Grid */}
      <section id="fleet-offers" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              السيارات في {getCityLabelAr(selectedCity)}
            </h2>
            {!dbConnected && cars.length > 0 && (
              <p className="text-xs text-slate-500">
                عروض توضيحية ·{' '}
                <button
                  type="button"
                  onClick={onGoToAgency}
                  className="font-semibold text-[#2563EB] hover:underline"
                >
                  أضف أسطولك كوكالة
                </button>
              </p>
            )}
          </div>

          {/* Clean Filters: Brands + Transmission */}
          <div className="flex flex-wrap items-center gap-2.5">
            {availableBrands.length > 1 && (
              <div className="flex items-center gap-1 p-1 bg-white border border-slate-200/80 rounded-xl overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setBrandFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    brandFilter === 'all'
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  كل الماركات
                </button>
                {availableBrands.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => setBrandFilter(brand)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      brandFilter === brand
                        ? 'bg-[#2563EB] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1 p-1 bg-white border border-slate-200/80 rounded-xl">
              <button
                type="button"
                onClick={() => setTransmissionFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  transmissionFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل ({cars.length})
              </button>
              <button
                type="button"
                onClick={() => setTransmissionFilter('automatic')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  transmissionFilter === 'automatic'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                أوتوماتيك
              </button>
              <button
                type="button"
                onClick={() => setTransmissionFilter('manual')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  transmissionFilter === 'manual'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                يدوي
              </button>
            </div>
          </div>
        </div>

        {loadingCars ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl border border-slate-200/75 overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-slate-200" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-slate-200 rounded w-1/2" />
                  <div className="h-4 bg-slate-100 rounded w-2/3" />
                  <div className="h-10 bg-slate-200 rounded-xl w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCars.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/75 p-12 text-center space-y-3">
            <CarFront className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-lg text-slate-900">لا توجد سيارات مطابقة حالياً</h3>
            <p className="text-sm text-slate-500">جرّب تغيير الفلتر أو اختيار مدينة أخرى.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCars.map((car) => (
              <article
                key={car.id}
                className="group bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => setSelectedCar(car)}
                  className="aspect-[4/3] bg-slate-100 overflow-hidden block w-full text-right cursor-pointer"
                >
                  <img
                    src={car.primary_image_url}
                    alt={`${car.brand} ${car.model}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </button>

                <div className="p-5 flex-1 flex flex-col">
                  {/* Title + Rating */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base sm:text-lg text-slate-900 leading-snug">
                        {car.brand} {car.model}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">{car.agency_name}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-700 shrink-0 pt-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-mono-tabular">{car.agency_rating.toFixed(1)}</span>
                    </div>
                  </div>

                  {/* Clean Spec Strip — Zero Pills */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-3.5 pt-3.5 border-t border-slate-100">
                    <span className="inline-flex items-center gap-1">
                      <Fuel className="w-3.5 h-3.5 text-slate-400" />
                      <span>{getFuelLabel(car.fuel_type)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-slate-400" />
                      <span>{car.transmission === 'automatic' ? 'أوتوماتيك' : 'يدوي'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{car.seats} مقاعد</span>
                    </span>
                    {car.distance_km != null && (
                      <span className="font-mono-tabular text-slate-400">
                        · {car.distance_km.toFixed(1)} كم
                      </span>
                    )}
                  </div>

                  {/* Price + Primary Action */}
                  <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                    <div>
                      <span className="font-mono-tabular font-extrabold text-lg text-slate-900">
                        {car.daily_price} DH
                      </span>
                      <span className="text-xs text-slate-500"> / يوم</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedCar(car)}
                      className="min-h-[42px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 text-xs font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <span>تفاصيل وحجز</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 4. Concise 3-Step Trust Strip */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <div className="rounded-2xl bg-white border border-slate-200/80 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-slate-900">1. اختر السيارة والتواريخ</h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              تصفح المواصفات والسعر النهائي بدون رسوم خفية.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-sm text-slate-900">2. أكد الحجز بـ 10%</h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              تحويل بنكي آمن مع ضمان استرجاع 100% عند التعذر.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-sm text-slate-900">3. استلم وسدد 90%</h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              استلم السيارة من المطار أو المدينة وادفع الباقي للوكالة.
            </p>
          </div>
        </div>
      </section>

      {selectedCar && (
        <BookingModal
          car={selectedCar}
          initialPickupDate={searchPickupDate}
          initialDays={searchDays}
          onClose={() => setSelectedCar(null)}
          onBookingCompleted={onBookingCreated}
        />
      )}
    </div>
  );
};
