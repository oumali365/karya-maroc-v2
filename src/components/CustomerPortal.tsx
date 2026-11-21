import React, { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Search,
  CarFront,
  Calendar,
  Clock,
  ShieldCheck,
  ChevronDown,
  Building2,
  ArrowLeft,
  LayoutGrid,
} from 'lucide-react';
import { supabase, MOROCCAN_CITIES, getCityLabelAr } from '../lib/supabase';
import {
  HERO_IMAGE_URL,
  STARTER_CARS,
  resolveCatalogImage,
} from '../data/starterData';
import {
  AgencyGroupList,
  formatAgenciesCountAr,
  formatCarsCountAr,
  groupCarsByAgency,
} from './AgencyGroupList';
import { filterCarOffers } from '../lib/agencyGrouping';
import { BookingModal } from './BookingModal';
import { CarOfferCard } from './CarOfferCard';
import { CitySelector } from './CitySelector';
import { FaqSection } from './FaqSection';
import type { CarOffer, CreatedBooking, TransmissionType } from '../types/karya';

interface CustomerPortalProps {
  onBookingCreated: (booking: CreatedBooking) => void;
  onGoToAgency: () => void;
}

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

function formatDays(d: number): string {
  if (d <= 10) return `${d} أيام`;
  return `${d} يومًا`;
}

const CUSTOMER_FAQS = [
  {
    q: 'كيف أسترجع المبلغ الذي دفعته في حالة لم تتمكن الوكالة من تسليم السيارة؟',
    a: 'إذا اعتذرت الوكالة عن توفير السيارة أو لم تتمكن من تسليمها في الموعد المتفق عليه، يمكنك طلب استرجاع المبلغ الذي دفعته لتأكيد الحجز (10%) من صفحة «حجوزاتي». سيتم مراجعة طلبك وإرجاع المبلغ كاملاً وفق إجراءات الاسترجاع المعتمدة، إلى رقم هاتفك أو حسابك البنكي. ويمكن لفريق Karya مساعدتك في إيجاد سيارة بديلة في نفس المدينة إذا رغبت في ذلك.',
  },
  {
    q: 'متى أدفع المبلغ المتبقي؟ وهل يمكنني معاينة السيارة قبل الدفع؟',
    a: 'تدفع 10% فقط عبر Karya لتأكيد الحجز، وهي جزء من السعر الإجمالي للكراء وليست رسماً إضافياً. أما المبلغ المتبقي (90%) فتدفعه مباشرة للوكالة عند استلام السيارة، بعد معاينتها والتأكد من حالتها وتوقيع عقد الكراء.',
  },
  {
    q: 'هل أحتاج إلى شيك ضمان أو ترك مبلغ مالي لدى الوكالة؟',
    a: 'لا. في عروض Karya التي تعتمد هذه الخدمة، لا تحتاج إلى تقديم شيك ضمان أو ترك مبلغ مالي كضمانة لدى الوكالة، كما لا يتم حجز مبلغ مالي من بطاقتك البنكية كضمان. تحتاج فقط إلى: البطاقة الوطنية، ورخصة سياقة سارية المفعول، ويجب أن تكون لديك منذ 3 سنوات على الأقل.',
  },
  {
    q: 'ما هي شروط الكراء عبر المنصة؟',
    a: 'لإتمام الحجز، يجب توفر: البطاقة الوطنية، رخصة سياقة منذ 3 سنوات على الأقل، ومدة كراء لا تقل عن 3 أيام، مع مطابقة الوثائق عند الاستلام للبيانات المسجلة.',
  },
  {
    q: 'هل أوقّع عقد الكراء مع الوكالة؟',
    a: 'نعم. عند استلام السيارة، توقّع عقد الكراء الرسمي مع الوكالة وتقدّم الوثائق المطلوبة بشكل عادي. عدم طلب شيك ضمان أو ضمانة مالية لا يعني الاستغناء عن العقد الرسمي أو الالتزام القانوني بشروط الكراء.',
  },
  {
    q: 'كيف أتابع حالة حجزي بعد إرسال وصل الدفع؟',
    a: 'يمكنك متابعة حالة حجزك من صفحة «حجوزاتي» باستخدام رمز الحجز ورقم الهاتف المسجل، دون الحاجة إلى إنشاء حساب أو كلمة مرور.',
  },
  {
    q: 'ماذا لو وصلت إلى الوكالة وكانت السيارة غير مطابقة أو غير جاهزة؟',
    a: 'يمكنك التواصل فوراً مع دعم Karya عبر زر المساعدة أو الواتساب، وسنساعدك في متابعة الطلب مع الوكالة، أو البحث عن بديل مناسب، أو معالجة طلب استرجاع المبلغ الذي دفعته لتأكيد الحجز وفق شروط المنصة.',
  },
  {
    q: 'ماذا يحدث إذا لم أحضر في الموعد أو لم تستوفِ رخصتي الشرط المطلوب؟',
    a: 'إذا لم تحضر في الموعد المتفق عليه أو تبيّن عند الاستلام أن رخصة السياقة لا تستوفي شرط الـ 3 سنوات على الأقل، قد يحق للوكالة رفض تسليم السيارة وتسجيل عدم التزام الزبون دون استرجاع مبلغ تأكيد الحجز (10%).',
  },
];

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
  const [transmissionFilter, setTransmissionFilter] = useState<'all' | TransmissionType>('all');
  const [viewMode, setViewMode] = useState<'agencies' | 'cars'>('agencies');
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
            agency_verified: true,
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
        .select('*, car_catalog(*), agencies(name, rating_avg, rating_count, verification_status)')
        .eq('city', cityToLoad)
        .eq('status', 'available');

      if (!tableErr && Array.isArray(tableData)) {
        const mapped: CarOffer[] = tableData
          .filter((row: Record<string, any>) => row.agencies?.verification_status === 'verified')
          .map((row: Record<string, any>) => {
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
              agency_verified: row.agencies?.verification_status === 'verified',
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
    ).map((c) => ({ ...c, agency_verified: false }));
    setCars(
      demoCityCars.length > 0
        ? demoCityCars
        : STARTER_CARS.slice(0, 3).map((c) => ({ ...c, agency_verified: false })),
    );
    setDbConnected(false);
    setLoadingCars(false);
  };

  useEffect(() => {
    setBrandFilter('all');
    setTransmissionFilter('all');
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

  const availableBrands = useMemo(() => {
    const counts = new Map<string, number>();
    const displayNames = new Map<string, string>();

    for (const car of cars) {
      const cleanBrand = car.brand?.trim();
      if (!cleanBrand) continue;
      const key = cleanBrand.toLowerCase();
      if (!displayNames.has(key)) displayNames.set(key, cleanBrand);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(displayNames.entries())
      .map(([key, brand]) => ({
        brand,
        count: counts.get(key) || 0,
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand, 'en'));
  }, [cars]);

  const filteredCars = useMemo(
    () => filterCarOffers(cars, { brandFilter, transmissionFilter }),
    [cars, brandFilter, transmissionFilter],
  );

  const agencyGroups = useMemo(
    () => groupCarsByAgency(filteredCars),
    [filteredCars],
  );

  const fieldClasses =
    'w-full min-h-[50px] rounded-lg bg-[var(--karya-bg)] border border-[var(--karya-border)] px-3.5 py-2.5 text-sm font-bold text-[var(--karya-text)] transition-colors focus:bg-white focus:border-[var(--karya-action)] focus:outline-none focus:ring-2 focus:ring-[var(--karya-action)]/15';

  return (
    <div dir="rtl" className="bg-[var(--karya-bg)] min-h-screen">
      {/* ===================== SCREEN 1: HERO ===================== */}
      <section className="relative w-full overflow-hidden bg-[var(--karya-primary)] min-h-[350px] sm:min-h-[420px] flex flex-col justify-end pb-24 sm:pb-28">
        <img
          src={HERO_IMAGE_URL}
          alt="سيارة كراء في الطريق الساحلي المغربي"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#173B57]/95 via-[#173B57]/60 to-[#173B57]/20"
          aria-hidden="true"
        />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-10 space-y-3">
          <div className="max-w-2xl space-y-2.5">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-[1.28] [text-wrap:balance]">
              اكري سيارتك في المغرب بسهولة، بدون ضمانة مالية وبأسعار مناسبة.
            </h1>
            <p className="text-slate-100/90 text-sm sm:text-base leading-relaxed font-normal">
              اعثر على سيارة للكراء لدى وكالات محلية. ادفع{' '}
              <span className="font-bold text-white">10% فقط لتأكيد الحجز</span>، والباقي عند استلام السيارة.
            </p>
          </div>

          <p className="flex items-center gap-2 text-xs text-slate-100">
            <ShieldCheck className="w-4 h-4 text-[var(--karya-accent)] shrink-0" aria-hidden="true" />
            <span>رخصة سياقة منذ 3 سنوات على الأقل · كراء ابتداءً من 3 أيام</span>
          </p>
        </div>
      </section>

      {/* ===================== OVERLAPPING SEARCH CARD ===================== */}
      <div className="relative z-20 max-w-5xl mx-auto px-4 sm:px-6 -mt-16 sm:-mt-20">
        <form
          onSubmit={handleDiscoverClick}
          className="bg-[var(--karya-surface)] rounded-xl shadow-[0_12px_32px_-8px_rgba(23,59,87,0.14)] border border-[var(--karya-border)] p-4 sm:p-6 space-y-4"
          aria-label="بحث عن سيارة للإيجار"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label
                htmlFor="hero-city-select"
                className="block text-xs font-bold text-[var(--karya-primary)] mb-1.5"
              >
                مدينة استلام السيارة
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[var(--karya-action)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  id="hero-city-select"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className={`${fieldClasses} appearance-none pr-10 pl-8`}
                >
                  {MOROCCAN_CITIES.map((city) => (
                    <option key={city.slug} value={city.nameFr}>
                      {city.nameAr} ({city.nameFr})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[var(--karya-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label
                htmlFor="hero-pickup-date"
                className="block text-xs font-bold text-[var(--karya-primary)] mb-1.5"
              >
                تاريخ استلام السيارة
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[var(--karya-text-muted)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="hero-pickup-date"
                  type="date"
                  value={searchPickupDate}
                  min={getTodayLocalDate()}
                  onChange={(e) => setSearchPickupDate(e.target.value)}
                  className={`${fieldClasses} font-mono-tabular pr-10`}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="hero-days"
                className="block text-xs font-bold text-[var(--karya-primary)] mb-1.5"
              >
                مدة الكراء
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-[var(--karya-text-muted)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  id="hero-days"
                  value={searchDays}
                  onChange={(e) => setSearchDays(Number(e.target.value))}
                  className={`${fieldClasses} appearance-none pr-10 pl-8`}
                >
                  {[3, 4, 5, 7, 10, 14, 30].map((d) => (
                    <option key={d} value={d}>
                      {formatDays(d)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[var(--karya-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[50px] rounded-lg bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] active:scale-[0.99] text-white px-6 py-3 font-extrabold text-sm sm:text-base shadow-sm transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--karya-action)] focus-visible:ring-offset-2"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            <span>ابحث عن سيارة</span>
          </button>

          <p className="text-[11px] sm:text-xs text-[var(--karya-text-muted)] text-center leading-relaxed">
            جميع السيارات متاحة بدون ضمانة مالية، مع احترام شروط الكراء الخاصة بكل عرض.
          </p>
        </form>
      </div>

      {/* ===================== SCREEN 7: CITY SELECTION COMPONENT ===================== */}
      <CitySelector
        selectedCity={selectedCity}
        onSelectCity={handleSelectQuickCity}
      />

      {/* ===================== SCREEN 5: FLEET LISTING ===================== */}
      <section
        id="fleet-offers"
        className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-10 space-y-6 scroll-mt-16"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--karya-primary)]">
                  {viewMode === 'agencies'
                    ? `الوكالات المتاحة في ${getCityLabelAr(selectedCity)}`
                    : `السيارات المتاحة في ${getCityLabelAr(selectedCity)}`}
                </h2>
                {!dbConnected && !loadingCars && cars.length > 0 && (
                  <span className="inline-flex items-center gap-2 text-xs">
                    <span className="text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5 font-semibold">
                      عروض توضيحية
                    </span>
                    <button
                      type="button"
                      onClick={onGoToAgency}
                      className="font-bold text-[var(--karya-action)] hover:underline"
                    >
                      سجل وكالتك الآن
                    </button>
                  </span>
                )}
              </div>

              {!loadingCars && filteredCars.length > 0 && (
                <p className="text-xs sm:text-sm text-[var(--karya-text-muted)]">
                  تم العثور على{' '}
                  <strong className="text-[var(--karya-primary)]">
                    {formatAgenciesCountAr(agencyGroups.length)}
                  </strong>{' '}
                  توفر{' '}
                  <strong className="text-[var(--karya-primary)]">
                    {formatCarsCountAr(filteredCars.length)}
                  </strong>{' '}
                  للحجز
                </p>
              )}
            </div>

            {/* View Switcher: Agencies (default) vs All Cars */}
            <div
              role="group"
              aria-label="طريقة عرض النتائج"
              className="self-start sm:self-auto inline-flex items-center p-1 rounded-xl bg-[var(--karya-surface)] border border-[var(--karya-border)] shadow-xs shrink-0"
            >
              <button
                type="button"
                aria-pressed={viewMode === 'agencies'}
                onClick={() => setViewMode('agencies')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-extrabold transition-colors min-h-[38px] ${
                  viewMode === 'agencies'
                    ? 'bg-[var(--karya-primary)] text-white shadow-xs'
                    : 'text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>حسب الوكالات</span>
              </button>
              <button
                type="button"
                aria-pressed={viewMode === 'cars'}
                onClick={() => setViewMode('cars')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-extrabold transition-colors min-h-[38px] ${
                  viewMode === 'cars'
                    ? 'bg-[var(--karya-primary)] text-white shadow-xs'
                    : 'text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                <span>جميع السيارات</span>
              </button>
            </div>
          </div>

          {!loadingCars && cars.length > 0 && (
            <div className="flex flex-col gap-2.5 pt-1">
              {availableBrands.length > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-xs font-bold text-[var(--karya-text-muted)] shrink-0">
                    تصفية حسب الماركة:
                  </span>
                  <div
                    className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
                    role="group"
                    aria-label="تصفية حسب الماركة"
                  >
                    <button
                      type="button"
                      aria-pressed={brandFilter === 'all'}
                      onClick={() => setBrandFilter('all')}
                      className={`shrink-0 rounded-lg border px-3 py-1.5 min-h-[36px] text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--karya-action)] ${
                        brandFilter === 'all'
                          ? 'bg-[var(--karya-action)] border-[var(--karya-action)] text-white'
                          : 'bg-[var(--karya-surface)] border-[var(--karya-border)] text-[var(--karya-text)] hover:border-[var(--karya-action)]/45'
                      }`}
                    >
                      الكل ({cars.length})
                    </button>

                    {availableBrands.map(({ brand, count }) => {
                      const isSelected = brandFilter.toLowerCase() === brand.toLowerCase();
                      return (
                        <button
                          key={brand}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() =>
                            setBrandFilter((prev) =>
                              prev.toLowerCase() === brand.toLowerCase() ? 'all' : brand,
                            )
                          }
                          className={`shrink-0 rounded-lg border px-3 py-1.5 min-h-[36px] text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--karya-action)] ${
                            isSelected
                              ? 'bg-[var(--karya-action)] border-[var(--karya-action)] text-white'
                              : 'bg-[var(--karya-surface)] border-[var(--karya-border)] text-[var(--karya-text)] hover:border-[var(--karya-action)]/45'
                          }`}
                        >
                          {brand}{' '}
                          <span
                            className={`font-mono-tabular text-[11px] ${
                              isSelected ? 'text-white/90' : 'text-[var(--karya-text-muted)]'
                            }`}
                          >
                            ({count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[var(--karya-text-muted)] shrink-0">
                  ناقل الحركة:
                </span>
                <div
                  className="inline-flex items-center gap-1.5"
                  role="group"
                  aria-label="تصفية حسب ناقل الحركة"
                >
                  {(
                    [
                      { value: 'all', label: 'الكل' },
                      { value: 'automatic', label: 'أوتوماتيك' },
                      { value: 'manual', label: 'يدوي' },
                    ] as const
                  ).map((opt) => {
                    const isSelected = transmissionFilter === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setTransmissionFilter(opt.value)}
                        className={`shrink-0 rounded-lg border px-3 py-1.5 min-h-[34px] text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--karya-action)] ${
                          isSelected
                            ? 'bg-[var(--karya-primary)] border-[var(--karya-primary)] text-white'
                            : 'bg-[var(--karya-surface)] border-[var(--karya-border)] text-[var(--karya-text)] hover:border-[var(--karya-primary)]/45'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {loadingCars ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] p-4 sm:p-5 animate-pulse"
                aria-hidden="true"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-slate-200 shrink-0" />
                    <div className="space-y-2 flex-1 max-w-xs">
                      <div className="h-4 bg-slate-200 rounded w-2/3" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-8 bg-slate-200 rounded-lg w-24 shrink-0" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCars.length === 0 ? (
          <div className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] p-12 text-center space-y-3">
            <CarFront className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
            <h3 className="font-bold text-lg text-[var(--karya-primary)]">
              لا توجد سيارات مطابقة حالياً
            </h3>
            <p className="text-sm text-[var(--karya-text-muted)]">
              جرّب إزالة أحد الفلاتر أو اختيار مدينة أخرى.
            </p>
            <button
              type="button"
              onClick={() => {
                setBrandFilter('all');
                setTransmissionFilter('all');
              }}
              className="inline-flex items-center gap-1.5 mt-2 px-5 py-2.5 rounded-lg bg-[var(--karya-primary)] text-white text-sm font-bold hover:bg-[var(--karya-primary-hover)] transition-colors"
            >
              إعادة تعيين الفلاتر
            </button>
          </div>
        ) : viewMode === 'agencies' ? (
          <AgencyGroupList
            groups={agencyGroups}
            searchDays={searchDays}
            resetKey={`${selectedCity}::${brandFilter}::${transmissionFilter}::${searchPickupDate}::${searchDays}`}
            onSelectCar={setSelectedCar}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCars.map((car) => (
              <CarOfferCard
                key={car.id}
                car={car}
                searchDays={searchDays}
                onSelect={setSelectedCar}
              />
            ))}
          </div>
        )}
      </section>

      {/* ===================== CUSTOMER CARE FAQ SECTION ===================== */}
      <FaqSection
        title="الأسئلة الشائعة – الزبائن"
        subtitle="كل ما تحتاج معرفته للكراء بدون ضمانة مالية، وبشروط واضحة"
        ariaLabel="أسئلة شائعة تهمّ عملاء Karya"
        items={CUSTOMER_FAQS}
        className="max-w-6xl mx-auto px-4 sm:px-6 pb-8 pt-2"
      />

      {/* ===================== PARTNER AGENCY CTA ===================== */}
      <section
        aria-label="انضمام الوكالات الشريكة"
        className="max-w-6xl mx-auto px-4 sm:px-6 pb-12"
      >
        <div className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-primary-soft)] p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 text-xs sm:text-sm text-[var(--karya-text)]">
            <span className="w-8 h-8 rounded-lg bg-[var(--karya-primary)] text-[var(--karya-accent)] flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" aria-hidden="true" />
            </span>
            <span>
              <strong className="text-[var(--karya-primary)]">هل تملك وكالة لكراء السيارات؟</strong> انضم إلى شبكة Karya، واعرض سياراتك لزبائن في مدن المغرب، مع نظام واضح لتأكيد الحجز وحفظ حقوق الطرفين.
            </span>
          </div>
          <button
            type="button"
            onClick={onGoToAgency}
            className="self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--karya-primary)] hover:bg-[var(--karya-primary-hover)] text-white px-4 py-2.5 min-h-[42px] text-xs font-extrabold transition-colors"
          >
            <span>سجّل وكالتك الآن</span>
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </section>

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
            loadCars(selectedCity, searchPickupDate, searchDays);
          }}
        />
      )}
    </div>
  );
};