import React, { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Search,
  CarFront,
  Calendar,
  Clock,
  ShieldCheck,
  ChevronDown,
  Check,
  HelpCircle,
} from 'lucide-react';
import { supabase, MOROCCAN_CITIES, getCityLabelAr } from '../lib/supabase';
import {
  HERO_IMAGE_URL,
  KNOWN_ECONOMIC_BRANDS,
  STARTER_CARS,
  resolveCatalogImage,
} from '../data/starterData';
import { BookingModal } from './BookingModal';
import { CarOfferCard } from './CarOfferCard';
import { CitySelector } from './CitySelector';
import type { CarOffer, CreatedBooking } from '../types/karya';

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
    q: 'كيف أسترجع مبلغ التسبيق (10%) إذا اعتذرت الوكالة أو تعذر التسليم؟',
    a: 'إذا اعتذرت الوكالة أو لم تلتزم بموعد التسليم، يُفتح لك تلقائياً زر «طلب استرجاع التسبيق» في صفحة «حجوزاتي» لاسترجاع 100% من تسبيقك إلى رقم هاتفك أو حسابك البنكي خلال ساعات، كما تعمل الإدارة على توفير سيارة بديلة في مدينتك إذا رغبت.',
  },
  {
    q: 'متى أدفع المبلغ المتبقي (90%) وهل أعاين السيارة أولاً؟',
    a: 'تدفع عبر المنصة 10% فقط لتأكيد جدية الحجز وحماية حقك، أما 90% المتبقية فتدفعها مباشرة للوكالة عند معاينة السيارة وتوقيع عقد الكراء الرسمي واستلام المفاتيح.',
  },
  {
    q: 'ما هي الوثائق المطلوبة عند الاستلام وهل أحتاج إلى شيك ضمان؟',
    a: 'لا يُطلب منك لا شيك ضمان ولا بطاقة ائتمان دولية ولا تجميد أي كفالة (0 DH). يكفي إحضار البطاقة الوطنية (CIN) ورخصة سياقة سارية المفعول بأقدمية سنتين على الأقل.',
  },
  {
    q: 'كيف أتابع حالة حجزي بعد إرسال وصل التحويل؟',
    a: 'من صفحة «حجوزاتي» يمكنك متابعة حالة طلبك لحظة بلحظة عبر رمز الحجز (KRY-...) ورقم هاتفك المسجل فقط، دون الحاجة إلى إنشاء حساب أو كلمة مرور.',
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
  const [catalogBrands, setCatalogBrands] = useState<string[]>(KNOWN_ECONOMIC_BRANDS);
  const [loadingCars, setLoadingCars] = useState(true);
  const [dbConnected, setDbConnected] = useState(false);

  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [selectedCar, setSelectedCar] = useState<CarOffer | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

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
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase.from('car_catalog').select('brand');
        if (!active || error || !Array.isArray(data)) return;
        const dbBrands = data
          .map((r: { brand?: unknown }) => String(r.brand || '').trim())
          .filter(Boolean);
        if (dbBrands.length > 0) {
          setCatalogBrands((prev) => {
            const seen = new Set(prev.map((b) => b.toLowerCase()));
            const merged = [...prev];
            for (const b of dbBrands) {
              if (!seen.has(b.toLowerCase())) {
                seen.add(b.toLowerCase());
                merged.push(b);
              }
            }
            return merged;
          });
        }
      } catch {
        // Keep KNOWN_ECONOMIC_BRANDS fallback
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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

  const availableBrands = useMemo(() => {
    const counts = new Map<string, number>();
    const displayNames = new Map<string, string>();

    for (const brand of catalogBrands) {
      const key = brand.trim().toLowerCase();
      if (!key) continue;
      if (!displayNames.has(key)) displayNames.set(key, brand.trim());
      if (!counts.has(key)) counts.set(key, 0);
    }

    for (const car of cars) {
      const cleanBrand = car.brand?.trim();
      if (!cleanBrand) continue;
      const key = cleanBrand.toLowerCase();
      if (!displayNames.has(key)) displayNames.set(key, cleanBrand);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(displayNames.entries()).map(([key, brand]) => ({
      brand,
      count: counts.get(key) || 0,
    }));
  }, [cars, catalogBrands]);

  const filteredCars = useMemo(() => {
    return cars.filter(
      (car) => brandFilter === 'all' || car.brand.trim().toLowerCase() === brandFilter.trim().toLowerCase(),
    );
  }, [cars, brandFilter]);

  const fieldClasses =
    'w-full min-h-[50px] rounded-xl bg-[#F4F6F9] border border-slate-200 px-3.5 py-2.5 text-sm font-bold text-[#0F2942] transition-colors focus:bg-white focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20';

  return (
    <div dir="rtl" className="bg-[#F4F6F9] min-h-screen">
      {/* ===================== SCREEN 1: HERO ===================== */}
      <section className="relative w-full overflow-hidden bg-[#0F2942] min-h-[340px] sm:min-h-[410px] flex flex-col justify-end pb-24 sm:pb-28">
        <img
          src={HERO_IMAGE_URL}
          alt="سيارة كراء في الطريق الساحلي المغربي"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#0F2942]/95 via-[#0F2942]/65 to-[#0F2942]/30"
          aria-hidden="true"
        />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-10 space-y-3">
          <div className="max-w-2xl space-y-2.5">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-[1.25] [text-wrap:balance]">
              اكري سيارتك بالمغرب بدون ضمان وبأفضل سعر
            </h1>
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed font-normal">
              سيارات اقتصادية من وكالات محلية موثوقة ·{' '}
              <span className="font-bold text-white">0 درهم كفالة</span> · تثبيت فوري بـ{' '}
              <span className="font-bold text-white">10% تسبيق</span> فقط.
            </p>
          </div>

          <p className="flex items-center gap-2 text-xs text-slate-200">
            <ShieldCheck className="w-4 h-4 text-[#2DD4BF] shrink-0" aria-hidden="true" />
            <span>يشترط أقدمية رخصة السياقة سنتين على الأقل · الحد الأدنى للكراء 3 أيام</span>
          </p>
        </div>
      </section>

      {/* ===================== OVERLAPPING SEARCH CARD ===================== */}
      <div className="relative z-20 max-w-5xl mx-auto px-4 sm:px-6 -mt-16 sm:-mt-20">
        <form
          onSubmit={handleDiscoverClick}
          className="bg-white rounded-2xl shadow-xl shadow-[#0F2942]/10 border border-slate-100 p-4 sm:p-6 space-y-4"
          aria-label="بحث عن سيارة للإيجار"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label
                htmlFor="hero-city-select"
                className="block text-xs font-bold text-[#0F2942] mb-1.5"
              >
                مدينة الاستلام
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[#0D9488] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label
                htmlFor="hero-pickup-date"
                className="block text-xs font-bold text-[#0F2942] mb-1.5"
              >
                تاريخ الاستلام
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#0F2942]/60 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                className="block text-xs font-bold text-[#0F2942] mb-1.5"
              >
                مدة الكراء (الأيام)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-[#0F2942]/60 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[50px] rounded-xl bg-[#0D9488] hover:bg-[#0F766E] active:scale-[0.99] text-white px-6 py-3 font-extrabold text-sm sm:text-base shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            <span>ابحث عن السيارات</span>
          </button>
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
        className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-9 space-y-6 scroll-mt-4"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F2942]">
              السيارات المتاحة في {getCityLabelAr(selectedCity)}
            </h2>
            {!dbConnected && !loadingCars && cars.length > 0 && (
              <p className="text-xs sm:text-sm text-slate-600">
                <span className="text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5 text-xs">
                  عروض توضيحية
                </span>{' '}
                <button
                  type="button"
                  onClick={onGoToAgency}
                  className="font-bold text-[#0D9488] hover:underline"
                >
                  سجل وكالتك الآن
                </button>
              </p>
            )}
          </div>

          {availableBrands.length > 0 && (
            <div
              className="flex gap-2.5 overflow-x-auto no-scrollbar snap-x pb-1"
              role="group"
              aria-label="تصفية حسب الماركة"
            >
              {availableBrands.map(({ brand, count }) => {
                const isSelected = brandFilter.toLowerCase() === brand.toLowerCase();
                const subtitle =
                  count === 0
                    ? 'غير متوفرة حالياً'
                    : count === 1
                      ? 'سيارة واحدة'
                      : count === 2
                        ? 'سيارتان'
                        : count <= 10
                          ? `${count} سيارات`
                          : `${count} سيارة`;

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
                    className={`snap-start shrink-0 min-w-[152px] text-right rounded-2xl border p-3 transition-all duration-150 flex items-center justify-between gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                      isSelected
                        ? 'bg-teal-50/75 border-[#0D9488] ring-1 ring-[#0D9488]/25 shadow-sm'
                        : 'bg-white border-slate-200/90 hover:border-[#0F2942]/30 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-[#0D9488] text-white'
                            : 'bg-[#F4F6F9] text-[#0F2942]'
                        }`}
                        aria-hidden="true"
                      >
                        <CarFront className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-[#0F2942] truncate">
                          {brand}
                        </div>
                        <div className="text-[10px] font-medium text-slate-500 truncate">
                          {subtitle}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <span
                        className="w-5 h-5 rounded-full bg-[#0D9488] text-white flex items-center justify-center shrink-0"
                        aria-hidden="true"
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {loadingCars ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden animate-pulse shadow-sm"
                aria-hidden="true"
              >
                <div className="aspect-[4/3] bg-slate-200" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-slate-200 rounded w-1/2" />
                  <div className="h-4 bg-slate-100 rounded w-2/3" />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-8 bg-slate-100 rounded-xl" />
                    <div className="h-8 bg-slate-100 rounded-xl" />
                    <div className="h-8 bg-slate-100 rounded-xl" />
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <div className="h-6 bg-slate-200 rounded w-1/3" />
                    <div className="h-10 bg-slate-200 rounded-xl w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredCars.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center space-y-3">
            <CarFront className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
            <h3 className="font-bold text-lg text-[#0F2942]">لا توجد سيارات مطابقة حالياً</h3>
            <p className="text-sm text-slate-500">
              جرّب إزالة أحد الفلاتر أو اختيار مدينة أخرى.
            </p>
            <button
              type="button"
              onClick={() => {
                setBrandFilter('all');
              }}
              className="inline-flex items-center gap-1.5 mt-2 px-5 py-2.5 rounded-xl bg-[#0F2942] text-white text-sm font-bold hover:bg-[#173B5E] transition-colors"
            >
              إعادة تعيين الفلاتر
            </button>
          </div>
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
      <section
        aria-label="أسئلة شائعة تهمّ عملاء Karya"
        className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 pt-2"
      >
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Refined Header Band */}
          <div className="bg-gradient-to-l from-[#0F2942] to-[#173B5E] px-5 py-5 sm:px-7 sm:py-6 flex items-center gap-3.5 text-white">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 text-[#2DD4BF] flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                أسئلة شائعة تهمّ عملاء Karya
              </h2>
              <p className="text-xs text-slate-200">
                كل ما تحتاج معرفته لحجز سيارتك بدون ضمان وبأمان تام
              </p>
            </div>
          </div>

          {/* Interactive Numbered FAQ Cards */}
          <div className="p-4 sm:p-6 space-y-2.5">
            {CUSTOMER_FAQS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              const numLabel = String(idx + 1).padStart(2, '0');

              return (
                <div
                  key={item.q}
                  className={`rounded-xl border transition-all duration-150 ${
                    isOpen
                      ? 'border-[#0D9488]/60 bg-teal-50/40 shadow-xs'
                      : 'border-slate-200/80 bg-[#F8FAFC] hover:bg-white hover:border-[#0F2942]/25'
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqIndex((prev) => (prev === idx ? null : idx))}
                    className="w-full flex items-center justify-between gap-3 text-right p-3.5 sm:px-4 sm:py-3.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg font-mono-tabular text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
                          isOpen
                            ? 'bg-[#0D9488] text-white'
                            : 'bg-white text-[#0F2942] border border-slate-200'
                        }`}
                        aria-hidden="true"
                      >
                        {numLabel}
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#0F2942] leading-snug">
                        {item.q}
                      </span>
                    </div>

                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#0D9488]' : 'text-slate-400'
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-3.5 sm:pr-14 sm:pl-6">
                      <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                        {item.a}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
            setSelectedCar(null);
            loadCars(selectedCity, searchPickupDate, searchDays);
          }}
        />
      )}
    </div>
  );
};