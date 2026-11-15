import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Navigation,
  Search,
  CarFront,
  ShieldCheck,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import {
  supabase,
  MOROCCAN_CITIES,
  findNearestMoroccanCity,
} from '../lib/supabase';
import { DEFAULT_CAR_IMAGE_URL, HERO_IMAGE_URL, STARTER_CARS } from '../data/starterData';
import { BookingModal } from './BookingModal';
import { Badge, CarCard, PrimaryButton, SecondaryButton, SelectField } from './ui';
import { useLanguage } from '../i18n';
import type { CarOffer, CreatedBooking } from '../types/karya';

interface CustomerPortalProps {
  onBookingCreated: (booking: CreatedBooking) => void;
  onGoToAgency: () => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  onBookingCreated,
  onGoToAgency,
}) => {
  const { lang, dir, t, getCityLabel } = useLanguage();

  const [selectedCity, setSelectedCity] = useState<string>('Casablanca');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsNotice, setGpsNotice] = useState<
    | { type: 'unsupported' | 'failed' }
    | { type: 'success'; cityAr: string; cityFr: string; distanceKm: number }
    | null
  >(null);
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
      setGpsNotice({ type: 'unsupported' });
      return;
    }

    setLocating(true);
    setGpsNotice(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const nearest = findNearestMoroccanCity(lat, lng);
        setGpsCoords({ lat, lng });
        setSelectedCity(nearest.city.nameFr);
        setGpsNotice({
          type: 'success',
          cityAr: nearest.city.nameAr,
          cityFr: nearest.city.nameFr,
          distanceKm: nearest.distanceKm,
        });
        loadCars(nearest.city.nameFr, { lat, lng });
        setLocating(false);
      },
      () => {
        setGpsNotice({ type: 'failed' });
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

  const gpsStatusMessage = (() => {
    if (!gpsNotice) return null;
    if (gpsNotice.type === 'success') {
      return t('search.gpsSuccess', {
        city: lang === 'ar' ? gpsNotice.cityAr : gpsNotice.cityFr,
        km: gpsNotice.distanceKm.toFixed(1),
      });
    }
    return gpsNotice.type === 'unsupported' ? t('search.gpsUnsupported') : t('search.gpsFailed');
  })();

  return (
    <div dir={dir}>
      {/* 1. Dramatic Hero Section + Floating Search Engine */}
      <section className="relative bg-navy overflow-hidden">
        <img
          src={HERO_IMAGE_URL}
          alt={t('hero.kicker')}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
        <div
          aria-hidden="true"
          className={`absolute inset-0 ${
            dir === 'rtl' ? 'bg-gradient-to-l' : 'bg-gradient-to-r'
          } from-navy via-navy/80 to-navy/45`}
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-24 sm:pt-20 sm:pb-28">
          <div className="max-w-2xl space-y-5">
            <p className="text-xs sm:text-sm font-semibold text-gold tracking-wide">
              {t('hero.kicker')}
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold text-white leading-[1.22] [text-wrap:balance]">
              {t('hero.titlePrefix')}{' '}
              <span className="text-gold">{t('hero.titleHighlight')}</span>{' '}
              {t('hero.titleSuffix')}
            </h1>
            <p className="text-sm sm:text-base text-[#D6DCE3] leading-relaxed max-w-xl">
              {t('hero.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Prominent Floating Search Engine */}
      <section
        aria-label={t('search.sectionAria')}
        className="relative z-10 -mt-12 sm:-mt-14 max-w-6xl mx-auto px-4 sm:px-6"
      >
        <div className="bg-white rounded-2xl border border-[#E5E0D5] shadow-lg shadow-navy/8 p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
            <div className="md:col-span-5">
              <SelectField
                label={t('search.cityLabel')}
                icon={<MapPin className="w-4 h-4 text-gold" />}
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                {MOROCCAN_CITIES.map((city) => (
                  <option key={city.slug} value={city.nameFr}>
                    {lang === 'ar' ? `${city.nameAr} (${city.nameFr})` : `${city.nameFr} (${city.nameAr})`}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="md:col-span-3">
              <SecondaryButton fullWidth loading={locating} onClick={handleDetectGps}>
                {!locating && <Navigation className="w-4 h-4 text-navy" />}
                <span>{locating ? t('search.locating') : t('search.gpsBtn')}</span>
              </SecondaryButton>
            </div>

            <div className="md:col-span-4">
              <PrimaryButton fullWidth size="md" onClick={handleDiscoverClick}>
                <Search className="w-4 h-4" />
                <span>{t('search.cta')}</span>
              </PrimaryButton>
            </div>
          </div>

          {gpsStatusMessage && (
            <div className="mt-3 pt-3 border-t border-[#F0ECE3] flex items-center justify-between gap-2 text-xs text-ink-muted">
              <span>{gpsStatusMessage}</span>
              {gpsCoords && (
                <Badge variant="success" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                  {t('search.gpsActivated')}
                </Badge>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 2. Featured Cars Section */}
      <section id="fleet-offers" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-bold text-ink">
              {t('fleet.titlePrefix')} {getCityLabel(selectedCity)}
            </h2>
            <p className="text-sm text-ink-muted">{t('fleet.subtitle')}</p>
          </div>

          {/* Interactive filter segmented buttons */}
          <div className="flex items-center gap-1 p-1 bg-white border border-[#E5E0D5] rounded-xl self-start">
            <button
              type="button"
              onClick={() => setTransmissionFilter('all')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                transmissionFilter === 'all'
                  ? 'bg-navy text-white'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {t('fleet.all')} ({cars.length})
            </button>
            <button
              type="button"
              onClick={() => setTransmissionFilter('automatic')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                transmissionFilter === 'automatic'
                  ? 'bg-navy text-white'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {t('fleet.automatic')}
            </button>
            <button
              type="button"
              onClick={() => setTransmissionFilter('manual')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                transmissionFilter === 'manual'
                  ? 'bg-navy text-white'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {t('fleet.manual')}
            </button>
          </div>
        </div>

        {!dbConnected && cars.length > 0 && (
          <div className="rounded-xl bg-white border border-[#E5E0D5] px-4 py-3 text-xs text-ink-muted flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Badge variant="warning">{t('fleet.demoBadge')}</Badge>
              <span>{t('fleet.demoNotice')}</span>
            </div>
            <button
              type="button"
              onClick={onGoToAgency}
              className="font-bold text-navy hover:text-gold-hover transition-colors whitespace-nowrap cursor-pointer"
            >
              {t('fleet.demoAction')}
            </button>
          </div>
        )}

        {loadingCars ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-white rounded-2xl border border-[#EAE6DD] overflow-hidden animate-pulse"
              >
                <div className="aspect-[4/3] bg-ivory-dark" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-ivory-dark rounded w-1/2" />
                  <div className="h-4 bg-ivory rounded w-2/3" />
                  <div className="h-11 bg-ivory-dark rounded-xl w-full mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCars.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#EAE6DD] p-12 text-center space-y-3">
            <CarFront className="w-10 h-10 text-ink-muted/50 mx-auto" />
            <h3 className="font-bold text-lg text-ink">{t('fleet.emptyTitle')}</h3>
            <p className="text-sm text-ink-muted">{t('fleet.emptySubtitle')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredCars.map((car) => (
              <CarCard key={car.id} car={car} onBook={setSelectedCar} />
            ))}
          </div>
        )}
      </section>

      {/* 3. Booking Steps & Deposit Protection Guarantee */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="bg-navy text-white rounded-2xl p-7 sm:p-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-semibold text-gold">{t('guarantee.kicker')}</p>
              <h2 className="text-2xl font-bold text-white [text-wrap:balance]">
                {t('guarantee.title')}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#D6DCE3] shrink-0">
              <ShieldCheck className="w-4 h-4 text-gold shrink-0" />
              <span>{t('guarantee.refundBadge')}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <div className="font-latin text-xs font-bold text-gold">01</div>
              <h3 className="font-bold text-base text-white">{t('guarantee.step1Title')}</h3>
              <p className="text-sm text-[#C7D0DA] leading-relaxed">
                {t('guarantee.step1Desc')}
              </p>
            </div>

            <div className="space-y-2">
              <div className="font-latin text-xs font-bold text-gold">02</div>
              <h3 className="font-bold text-base text-white">{t('guarantee.step2Title')}</h3>
              <p className="text-sm text-[#C7D0DA] leading-relaxed">
                {t('guarantee.step2Desc')}
              </p>
            </div>

            <div className="space-y-2">
              <div className="font-latin text-xs font-bold text-gold">03</div>
              <h3 className="font-bold text-base text-white">{t('guarantee.step3Title')}</h3>
              <p className="text-sm text-[#C7D0DA] leading-relaxed">
                {t('guarantee.step3Desc')}
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[#C7D0DA]">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gold shrink-0" />
              <span>{t('guarantee.partnerNote')}</span>
            </div>
            <button
              type="button"
              onClick={onGoToAgency}
              className="text-gold hover:text-white font-semibold transition-colors whitespace-nowrap self-start sm:self-auto cursor-pointer"
            >
              {t('guarantee.partnerCta')}
            </button>
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
