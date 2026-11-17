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
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { supabase, MOROCCAN_CITIES, getCityLabelAr } from '../lib/supabase';
import {
  HERO_IMAGE_URL,
  STARTER_CARS,
  resolveCatalogImage,
} from '../data/starterData';
import { BookingModal } from './BookingModal';
import type { CarOffer, CreatedBooking } from '../types/karya';

interface CustomerPortalProps {
  onBookingCreated: (booking: CreatedBooking) => void;
  onGoToAgency: () => void;
}

const POPULAR_CITIES = [
  { cityFr: 'Casablanca', cityAr: 'الدار البيضاء', subtitle: 'التسليم داخل المدينة' },
  { cityFr: 'Rabat', cityAr: 'الرباط', subtitle: 'التسليم داخل المدينة' },
  { cityFr: 'Marrakech', cityAr: 'مراكش', subtitle: 'التسليم داخل المدينة' },
  { cityFr: 'Tangier', cityAr: 'طنجة', subtitle: 'التسليم داخل المدينة' },
  { cityFr: 'Fès', cityAr: 'فاس', subtitle: 'التسليم داخل المدينة' },
  { cityFr: 'Agadir', cityAr: 'أكادير', subtitle: 'التسليم داخل المدينة' },
];

function getTodayLocalDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

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

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  onBookingCreated,
  onGoToAgency,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>('Casablanca');
  const [searchPickupDate, setSearchPickupDate] = useState<string>(getDefaultPickupDate);
  const [searchDays, setSearchDays] = useState<number>(3);

  const [cars, setCars] = useState<CarOffer[]>([]);
  const [loadingCars, setLoadingCars] = useState(true);
  const [dbConnected, setDbConnected] = useState(false);

  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [transmissionFilter, setTransmissionFilter] =
    useState<'all' | 'automatic' | 'manual'>('all');
  const [selectedCar, setSelectedCar] = useState<CarOffer | null>(null);

  const loadCars = async (
    cityToLoad: string,
    pickupDateStr: string = searchPickupDate,
    daysCount: number = searchDays,
  ) => {
    setLoadingCars(true);
    try {
      const pickupIso = pickupDateStr
        ? new Date(`${pickupDateStr}T10:00:00`).toISOString()
        : null;

      let rpcRes = await supabase.rpc('get_nearby_cars', {
        p_city: cityToLoad,
        p_lat: null,
        p_lng: null,
        p_radius_km: 80,
        p_pickup_at: pickupIso,
        p_days: daysCount,
      });

      if (
        rpcRes.error &&
        (rpcRes.error.message.includes('Could not find the function') ||
          rpcRes.error.message.includes('p_pickup_at'))
      ) {
        rpcRes = await supabase.rpc('get_nearby_cars', {
          p_city: cityToLoad,
          p_lat: null,
          p_lng: null,
          p_radius_km: 80,
        });
      }

      if (!rpcRes.error && Array.isArray(rpcRes.data)) {
        const mapped: CarOffer[] = rpcRes.data.map((row: Record<string, unknown>) => {
          const brand = String(row.brand);
          const model = String(row.model);
          const img = resolveCatalogImage(brand, model, String(row.primary_image_url || ''));
          return {
            id: String(row.car_id),
            agency_id: String(row.agency_id),
            agency_name: String(row.agency_name || 'وكالة معتمدة'),
            agency_rating: Number(row.agency_rating ?? 5),
            agency_rating_count: Number(row.agency_rating_count ?? 0),
            brand,
            model,
            model_year: row.model_year ? Number(row.model_year) : null,
            fuel_type: (row.fuel_type as CarOffer['fuel_type']) || 'diesel',
            transmission: (row.transmission as CarOffer['transmission']) || 'manual',
            seats: Number(row.seats ?? 5),
            primary_image_url: img,
            gallery_images:
              Array.isArray(row.gallery_images) && row.gallery_images.length > 0
                ? (row.gallery_images as string[])
                : [img],
            daily_price: Number(row.daily_price),
            deposit_amount: 0,
            city: String(row.city),
            status: 'available',
            distance_km: row.distance_km != null ? Number(row.distance_km) : null,
            is_booked: Boolean(row.is_booked),
            booked_until: row.booked_until ? String(row.booked_until) : null,
            is_demo: false,
          };
        });
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
        const mapped: CarOffer[] = tableData.map((row: Record<string, any>) => {
          const brand = String(row.brand || row.car_catalog?.brand || 'سيارة');
          const model = String(row.model || row.car_catalog?.model || '');
          const img = resolveCatalogImage(
            brand,
            model,
            row.primary_image_url || row.car_catalog?.image_url,
          );
          return {
            id: String(row.id),
            agency_id: String(row.agency_id),
            agency_name: String(row.agencies?.name || 'وكالة معتمدة'),
            agency_rating: Number(row.agencies?.rating_avg ?? 5),
            agency_rating_count: Number(row.agencies?.rating_count ?? 0),
            brand,
            model,
            model_year: row.model_year ? Number(row.model_year) : null,
            color: row.color ?? null,
            fuel_type: row.fuel_type || 'diesel',
            transmission: row.transmission || 'manual',
            seats: Number(row.seats ?? 5),
            primary_image_url: img,
            gallery_images: [img],
            daily_price: Number(row.daily_price),
            deposit_amount: 0,
            city: String(row.city),
            status: 'available',
            distance_km: null,
            is_booked: false,
            booked_until: null,
            is_demo: false,
          };
        });
        setCars(mapped);
        setDbConnected(true);
        setLoadingCars(false);
        return;
      }
    } catch {
      // fallback to starter fleet
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
  }, [selectedCity]);

  useEffect(() => {
    loadCars(selectedCity, searchPickupDate, searchDays);
  }, [selectedCity, searchPickupDate, searchDays]);

  const handleDiscoverClick = (e: React.FormEvent) => {
    e.preventDefault();
    loadCars(selectedCity, searchPickupDate, searchDays);
    document.getElementById('fleet-offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSelectQuickCity = (cityFr: string) => {
    setSelectedCity(cityFr);
    document.getElementById('fleet-offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const availableBrands = useMemo(
    () => Array.from(new Set(cars.map((c) => c.brand).filter(Boolean))),
    [cars],
  );

  const filteredCars = useMemo(() => {
    return cars.filter((car) => {
      const matchTransmission =
        transmissionFilter === 'all' || car.transmission === transmissionFilter;
      const matchBrand = brandFilter === 'all' || car.brand === brandFilter;
      return matchTransmission && matchBrand;
    });
  }, [cars, transmissionFilter, brandFilter]);

  const availableFilteredCount = useMemo(
    () => filteredCars.filter((c) => !c.is_booked).length,
    [filteredCars],
  );
  const bookedFilteredCount = filteredCars.length - availableFilteredCount;

  const inputBase =
    'w-full min-h-[48px] rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-lg ring-1 ring-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900';

  return (
    <div dir="rtl" className="bg-slate-50/50 min-h-screen">
      {/* ===================== HERO ===================== */}
      <section className="relative w-full overflow-hidden bg-slate-900 min-h-[420px] sm:min-h-[460px] flex flex-col justify-end">
        <img
          src={HERO_IMAGE_URL}
          alt="سيارة كراء اقتصادية في المغرب"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-slate-950/20"
          aria-hidden="true"
        />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
          <div className="max-w-xl space-y-2.5">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-[1.2] [text-wrap:balance] drop-shadow-sm">
              اكري سيارتك في مدينتك بدون ضمان
            </h1>
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
              سيارات اقتصادية من وكالات محلية ·{' '}
              <span className="font-semibold text-white">0 درهم كفالة</span> · حد أدنى 3 أيام و
              <span className="font-semibold text-white"> 10% تسبيق</span> فقط.
            </p>
          </div>

          {/* Floating search form */}
          <form
            onSubmit={handleDiscoverClick}
            className="grid grid-cols-2 sm:grid-cols-12 gap-3 items-end"
            aria-label="بحث عن سيارة للإيجار"
          >
            {/* City */}
            <div className="col-span-2 sm:col-span-5">
              <label
                htmlFor="hero-city-select"
                className="block text-[11px] sm:text-xs font-semibold text-white/90 mb-1.5"
              >
                اختر مدينتك
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[#2563EB] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  id="hero-city-select"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className={`${inputBase} appearance-none pr-9 pl-8`}
                >
                  {MOROCCAN_CITIES.map((city) => (
                    <option key={city.slug} value={city.nameFr}>
                      {city.nameAr} ({city.nameFr})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Date */}
            <div className="col-span-2 sm:col-span-3">
              <label
                htmlFor="hero-pickup-date"
                className="block text-[11px] sm:text-xs font-semibold text-white/90 mb-1.5"
              >
                تاريخ الاستلام
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block" />
                <input
                  id="hero-pickup-date"
                  type="date"
                  value={searchPickupDate}
                  min={getTodayLocalDate()}
                  onChange={(e) => setSearchPickupDate(e.target.value)}
                  className={`${inputBase} text-xs sm:text-sm font-mono-tabular sm:pr-9`}
                />
              </div>
            </div>

            {/* Days (Min 3 days) */}
            <div className="col-span-1 sm:col-span-2">
              <label
                htmlFor="hero-days"
                className="block text-[11px] sm:text-xs font-semibold text-white/90 mb-1.5"
              >
                المدة (3 أيام+)
              </label>
              <select
                id="hero-days"
                value={searchDays}
                onChange={(e) => setSearchDays(Number(e.target.value))}
                className={`${inputBase} appearance-none px-2`}
              >
                {[3, 4, 5, 7, 10, 14, 30].map((d) => (
                  <option key={d} value={d}>
                    {formatDays(d)}
                  </option>
                ))}
              </select>
            </div>

            {/* Search button */}
            <div className="col-span-1 sm:col-span-2">
              <button
                type="submit"
                className="w-full min-h-[48px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white px-4 py-2.5 font-bold text-sm shadow-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                aria-label="بحث عن السيارات"
              >
                <Search className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">بحث</span>
              </button>
            </div>
          </form>

          {/* Trust micro-copy */}
          <p className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-300/90">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
            بدون ضمان (0 درهم كفالة) · يشترط أقدمية رخصة السياقة سنتين على الأقل
          </p>
        </div>
      </section>

      {/* ===================== POPULAR LOCAL CITIES ===================== */}
      <section
        className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-2"
        aria-label="المدن المغربية الرئيسية"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {POPULAR_CITIES.map((item) => {
            const active = selectedCity.toLowerCase() === item.cityFr.toLowerCase();
            return (
              <button
                key={item.cityFr}
                type="button"
                onClick={() => handleSelectQuickCity(item.cityFr)}
                aria-pressed={active}
                className={`text-right rounded-xl border px-3 py-2.5 transition-all duration-150 flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${
                  active
                    ? 'bg-blue-50/80 border-[#2563EB] text-slate-900 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-[#2563EB]/40 hover:shadow-sm text-slate-800'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{item.cityAr}</div>
                  <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                </div>
                <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      {/* ===================== FLEET ===================== */}
      <section
        id="fleet-offers"
        className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 scroll-mt-4"
      >
        {/* Section header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              السيارات الاقتصادية المتاحة في {getCityLabelAr(selectedCity)}
            </h2>
            <p className="text-xs text-slate-500">
              {loadingCars ? (
                'جارٍ تحميل العروض...'
              ) : (
                <span aria-live="polite">
                  {availableFilteredCount} سيارة متاحة
                  {bookedFilteredCount > 0 ? ` · ${bookedFilteredCount} محجوزة` : ''} ·{' '}
                  {formatDays(searchDays)} · استلام{' '}
                  <span className="font-mono-tabular">{searchPickupDate}</span>
                </span>
              )}
              {!dbConnected && cars.length > 0 && (
                <>
                  {' '}·{' '}
                  <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                    عروض توضيحية
                  </span>{' '}
                  <button
                    type="button"
                    onClick={onGoToAgency}
                    className="font-semibold text-[#2563EB] hover:underline"
                  >
                    سجل وكالتك الآن
                  </button>
                </>
              )}
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
            {availableBrands.length > 1 && (
              <div
                className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl overflow-x-auto no-scrollbar"
                role="tablist"
                aria-label="تصفية حسب الماركة"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={brandFilter === 'all'}
                  onClick={() => setBrandFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                    brandFilter === 'all'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  كل الماركات
                </button>
                {availableBrands.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    role="tab"
                    aria-selected={brandFilter === brand}
                    onClick={() => setBrandFilter(brand)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                      brandFilter === brand
                        ? 'bg-[#2563EB] text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            )}

            <div
              className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl"
              role="tablist"
              aria-label="تصفية حسب ناقل الحركة"
            >
              {(
                [
                  { key: 'all', label: `الكل (${cars.length})` },
                  { key: 'automatic', label: 'أوتوماتيك' },
                  { key: 'manual', label: 'يدوي' },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={transmissionFilter === key}
                  onClick={() => setTransmissionFilter(key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                    transmissionFilter === key
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        {loadingCars ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-white rounded-2xl border border-slate-200/75 overflow-hidden animate-pulse"
                aria-hidden="true"
              >
                <div className="aspect-[4/3] bg-slate-200" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-slate-200 rounded w-1/2" />
                  <div className="h-4 bg-slate-100 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/3" />
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <div className="h-6 bg-slate-200 rounded w-1/3" />
                    <div className="h-9 bg-slate-200 rounded-xl w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredCars.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/75 p-12 text-center space-y-3">
            <CarFront className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
            <h3 className="font-bold text-lg text-slate-900">لا توجد سيارات مطابقة حالياً</h3>
            <p className="text-sm text-slate-500">
              جرّب إزالة أحد الفلاتر أو اختيار مدينة أخرى.
            </p>
            <button
              type="button"
              onClick={() => {
                setBrandFilter('all');
                setTransmissionFilter('all');
              }}
              className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              إعادة تعيين الفلاتر
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCars.map((car) => {
              const total = car.daily_price * searchDays;
              const isBooked = Boolean(car.is_booked);
              const bookedUntilText = formatBookedUntil(car.booked_until);

              return (
                <article
                  key={car.id}
                  className={`group bg-white rounded-2xl border overflow-hidden flex flex-col transition-all duration-200 ${
                    isBooked
                      ? 'border-slate-200/80 opacity-90'
                      : 'border-slate-200/80 hover:border-slate-300 hover:shadow-lg hover:-translate-y-0.5'
                  }`}
                >
                  {/* Image */}
                  <button
                    type="button"
                    disabled={isBooked}
                    onClick={() => {
                      if (!isBooked) setSelectedCar(car);
                    }}
                    className={`aspect-[4/3] bg-slate-100 overflow-hidden block w-full text-right relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB] ${
                      isBooked ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                    aria-label={
                      isBooked
                        ? `${car.brand} ${car.model} — محجوزة حالياً`
                        : `عرض تفاصيل ${car.brand} ${car.model}`
                    }
                  >
                    <img
                      src={car.primary_image_url}
                      alt={`${car.brand} ${car.model}`}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className={`w-full h-full object-cover transition-transform duration-500 ease-out ${
                        isBooked ? 'opacity-70 grayscale-[25%]' : 'group-hover:scale-[1.03]'
                      }`}
                    />
                    {car.model_year && (
                      <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-white/95 backdrop-blur-sm text-slate-800 text-[11px] font-bold px-2.5 py-1 shadow-sm">
                        {car.model_year}
                      </span>
                    )}
                    {isBooked && (
                      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1.5 p-3 text-center">
                        <span className="inline-flex items-center rounded-xl bg-red-600 text-white px-4 py-1.5 text-xs font-extrabold shadow-lg">
                          محجوزة حالياً
                        </span>
                        {bookedUntilText && (
                          <span className="rounded-lg bg-slate-900/90 text-white px-2.5 py-1 text-[11px] font-semibold">
                            تتوفر بعد {bookedUntilText}
                          </span>
                        )}
                      </div>
                    )}
                  </button>

                  {/* Content */}
                  <div className="p-5 flex-1 flex flex-col">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-base sm:text-lg text-slate-900 leading-snug truncate">
                          {car.brand} {car.model}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {car.agency_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-700 shrink-0 pt-1">
                        <Star
                          className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                          aria-hidden="true"
                        />
                        <span className="font-mono-tabular">
                          {car.agency_rating.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* Specs strip */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600 mt-3.5 pt-3.5 border-t border-slate-100">
                      <span className="inline-flex items-center gap-1.5">
                        <Fuel className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                        {getFuelLabel(car.fuel_type)}
                      </span>
                      <span className="w-px h-3 bg-slate-200" aria-hidden="true" />
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                        {car.seats} مقاعد
                      </span>
                      <span className="w-px h-3 bg-slate-200" aria-hidden="true" />
                      <span className="inline-flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                        {car.transmission === 'automatic' ? 'أوتوماتيك' : 'يدوي'}
                      </span>
                    </div>

                    <div className="text-[11px] font-semibold text-emerald-700 mt-2.5 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>بدون ضمان (0 DH كفالة)</span>
                    </div>

                    {/* Price + CTA */}
                    <div className="mt-auto pt-3 flex items-end justify-between gap-3">
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold text-slate-900 font-mono-tabular leading-none">
                            {car.daily_price}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            درهم / يوم
                          </span>
                        </div>
                        {total > 0 && (
                          <p className="text-[11px] text-slate-500 mt-1.5 font-mono-tabular">
                            ≈ <span className="font-bold text-slate-700">{total}</span> درهم
                            لـ {formatDays(searchDays)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={isBooked}
                        onClick={() => {
                          if (!isBooked) setSelectedCar(car);
                        }}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${
                          isBooked
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white shadow-sm'
                        }`}
                      >
                        {isBooked ? (
                          <span>محجوزة</span>
                        ) : (
                          <>
                            احجز
                            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Booking modal */}
      {selectedCar && (
        <BookingModal
          car={selectedCar}
          initialPickupDate={searchPickupDate}
          initialDays={searchDays}
          onClose={() => setSelectedCar(null)}
          onBookingCompleted={(booking) => {
            onBookingCreated(booking);
            setCars((prev) =>
              prev.map((item) =>
                item.id === selectedCar.id ? { ...item, is_booked: true } : item,
              ),
            );
            setSelectedCar(null);
            loadCars(selectedCity, searchPickupDate, searchDays);
          }}
        />
      )}
    </div>
  );
};