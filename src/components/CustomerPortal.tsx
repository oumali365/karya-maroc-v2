import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, Search, CarFront, Loader2, ArrowDownLeft } from 'lucide-react';
import {
  supabase,
  MOROCCAN_CITIES,
  findNearestMoroccanCity,
  getCityLabelAr,
} from '../lib/supabase';
import { HERO_IMAGE_URL, STARTER_CARS } from '../data/starterData';
import { BookingModal } from './BookingModal';
import type { CarOffer, CreatedBooking } from '../types/karya';

interface CustomerPortalProps {
  onBookingCreated: (booking: CreatedBooking) => void;
  onGoToAgency: () => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  onBookingCreated,
  onGoToAgency,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>('Casablanca');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatusText, setGpsStatusText] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const [cars, setCars] = useState<CarOffer[]>([]);
  const [loadingCars, setLoadingCars] = useState(true);
  const [dbConnected, setDbConnected] = useState(false);

  const [transmissionFilter, setTransmissionFilter] = useState<'all' | 'automatic' | 'manual'>('all');
  const [selectedCar, setSelectedCar] = useState<CarOffer | null>(null);

  const loadCars = async (cityToLoad: string, coords: { lat: number; lng: number } | null) => {
    setLoadingCars(true);
    try {
      const { data, error } = await supabase.rpc('get_nearby_cars', {
        p_city: cityToLoad,
        p_lat: coords?.lat ?? null,
        p_lng: coords?.lng ?? null,
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
              '/src/assets/images/car_renault_clio_1794682738372.jpg',
          ),
          gallery_images: [
            String(
              row.primary_image_url ||
                row.car_catalog?.image_url ||
                '/src/assets/images/car_renault_clio_1794682738372.jpg',
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
      // Smoothly fall through to starter fleet if schema hasn't been created
    }

    const demoCityCars = STARTER_CARS.filter(
      (c) => c.city.toLowerCase() === cityToLoad.toLowerCase(),
    );
    setCars(demoCityCars.length > 0 ? demoCityCars : STARTER_CARS.slice(0, 3));
    setDbConnected(false);
    setLoadingCars(false);
  };

  useEffect(() => {
    loadCars(selectedCity, gpsCoords);
  }, [selectedCity]);

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      setGpsStatusText('متصفحك لا يدعم تحديد الموقع، يرجى اختيار المدينة يدوياً.');
      return;
    }

    setLocating(true);
    setGpsStatusText(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const nearest = findNearestMoroccanCity(lat, lng);
        setGpsCoords({ lat, lng });
        setSelectedCity(nearest.city.nameFr);
        setGpsStatusText(
          `موقعك الحالي قرب ${nearest.city.nameAr} (${nearest.distanceKm.toFixed(1)} كم)`,
        );
        loadCars(nearest.city.nameFr, { lat, lng });
        setLocating(false);
      },
      () => {
        setGpsStatusText('تعذر تحديد الموقع، اختر مدينتك من القائمة.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleDiscoverClick = () => {
    loadCars(selectedCity, gpsCoords);
    document.getElementById('fleet-offers')?.scrollIntoView({ behavior: 'smooth' });
  };

  const filteredCars = cars.filter((car) => {
    if (transmissionFilter === 'all') return true;
    return car.transmission === transmissionFilter;
  });

  return (
    <div dir="rtl">
      {/* 1. Clean Hero & Smart City + GPS Discovery */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-7">
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight [text-wrap:balance]">
                اكتشف السيارات المتاحة في مدينتك واحجز في دقائق
              </h1>
              <p className="text-slate-600 text-base leading-relaxed max-w-lg">
                صور حقيقية لأسطول الوكالات المعتمدة في المغرب مع حجز مباشر واستلام ميسّر.
              </p>
            </div>

            {/* Smart City + GPS Box */}
            <div className="rounded-2xl bg-[#F6F8F6] p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    المدينة
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="w-full min-h-[44px] appearance-none rounded-xl bg-white pr-9 pl-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/25"
                    >
                      {MOROCCAN_CITIES.map((city) => (
                        <option key={city.slug} value={city.nameFr}>
                          {city.nameAr} ({city.nameFr})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    تحديد الموقع
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectGps}
                    disabled={locating}
                    className="w-full min-h-[44px] rounded-xl bg-white hover:bg-slate-50 text-slate-800 px-4 py-2.5 text-sm font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {locating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Navigation className="w-4 h-4 text-slate-600" />
                    )}
                    <span>{locating ? 'جاري التحديد...' : 'موقعي الحالي GPS'}</span>
                  </button>
                </div>
              </div>

              {gpsStatusText && (
                <div className="text-xs font-medium text-slate-700 px-1">{gpsStatusText}</div>
              )}

              <button
                type="button"
                onClick={handleDiscoverClick}
                className="w-full min-h-[48px] rounded-xl bg-[#1B5E20] hover:bg-[#144718] text-white py-3.5 px-6 font-bold text-base transition-colors flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                <span>اكتشف العروض في منطقتك</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-64 sm:h-80 lg:h-full min-h-[300px] rounded-2xl overflow-hidden bg-slate-100">
              <img
                src={HERO_IMAGE_URL}
                alt="سيارة كراء حديثة في المغرب"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Fleet Visual Discovery Grid */}
      <section id="fleet-offers" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              السيارات المتاحة في {getCityLabelAr(selectedCity)}
            </h2>
            <p className="text-sm text-slate-500 mt-1">اختر السيارة المناسبة لإتمام الحجز</p>
          </div>

          {/* Interactive filter segmented buttons */}
          <div className="flex items-center gap-1 p-1 bg-white rounded-xl shadow-xs self-start">
            <button
              type="button"
              onClick={() => setTransmissionFilter('all')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
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
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
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
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                transmissionFilter === 'manual'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              يدوي
            </button>
          </div>
        </div>

        {!dbConnected && cars.length > 0 && (
          <div className="rounded-xl bg-white px-4 py-3 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
            <span>نماذج توضيحية ريثما تضيف الوكالات سياراتها في هذه المدينة.</span>
            <button
              type="button"
              onClick={onGoToAgency}
              className="font-bold text-slate-900 hover:underline whitespace-nowrap"
            >
              أضف سيارتك من بوابة الوكالات ←
            </button>
          </div>
        )}

        {loadingCars ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl overflow-hidden animate-pulse">
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
          <div className="bg-white rounded-2xl p-12 text-center space-y-3">
            <CarFront className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-lg text-slate-900">
              لا توجد سيارات مطابقة في هذه المدينة حالياً
            </h3>
            <p className="text-sm text-slate-500">جرّب اختيار "الكل" أو مدينة قريبة.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredCars.map((car) => (
              <article
                key={car.id}
                className="group bg-white rounded-2xl shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col"
              >
                <div
                  onClick={() => setSelectedCar(car)}
                  className="aspect-[4/3] bg-slate-100 overflow-hidden cursor-pointer"
                >
                  <img
                    src={car.primary_image_url}
                    alt={`${car.brand} ${car.model}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg text-slate-900">
                      {car.brand} {car.model}
                    </h3>
                    <div className="text-left shrink-0">
                      <span className="font-mono-tabular font-extrabold text-base text-slate-900">
                        {car.daily_price} DH
                      </span>
                      <span className="text-xs text-slate-500 block">/ يوم</span>
                    </div>
                  </div>

                  {/* Clean zero-pill metadata */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1.5">
                    <span>{car.fuel_type === 'diesel' ? 'ديزل' : 'بنزين'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{car.transmission === 'automatic' ? 'أوتوماتيك' : 'يدوي'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{car.seats} مقاعد</span>
                    {car.distance_km != null && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">
                          {car.distance_km.toFixed(1)} كم
                        </span>
                      </>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                    {car.agency_name}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedCar(car)}
                    className="mt-4 w-full min-h-[44px] rounded-xl bg-[#1B5E20] hover:bg-[#144718] text-white py-2.5 px-4 text-sm font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <span>احجز هذه السيارة</span>
                    <ArrowDownLeft className="w-4 h-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 3. Concise Numbered Steps */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-2xl bg-white p-6 sm:p-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-1.5">
            <h3 className="font-bold text-slate-900">1. اختر السيارة</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              تصفح السيارات المتاحة في مدينتك أو الأقرب إلى موقعك.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-bold text-slate-900">2. ادفع العربون</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              املأ استمارة الحجز وحوّل مبلغ التأكيد عبر البنك مع إرفاق الوصل.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-bold text-slate-900">3. استلم السيارة</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              استلم سيارتك من النقطة والوقت المحددين وسدد الباقي للوكالة.
            </p>
          </div>
        </div>
      </section>

      {selectedCar && (
        <BookingModal
          car={selectedCar}
          onClose={() => setSelectedCar(null)}
          onBookingCompleted={onBookingCreated}
        />
      )}
    </div>
  );
};
