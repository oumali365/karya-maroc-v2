import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  CarFront,
  CalendarCheck2,
  Settings,
  LogOut,
  Plus,
  Navigation,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  Home,
  Pencil,
  Trash2,
  Check,
  X,
  Phone,
  Lock,
  ShieldCheck,
  AlertTriangle,
  KeyRound,
  Clock,
  Ban,
  RefreshCw,
  Menu,
  Bell,
  Calendar,
  MapPin,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Search,
} from 'lucide-react';
import { supabase, MOROCCAN_CITIES, formatDH, getCityLabelAr } from '../lib/supabase';
import {
  STARTER_CATALOG,
  mapCatalogRow,
  resolveCatalogImage,
} from '../data/starterData';
import type {
  AgencyBookingRecord,
  AgencyProfile,
  CarOffer,
  CatalogCar,
  FuelType,
  TransmissionType,
} from '../types/karya';

interface AgencyPortalProps {
  onGoToCustomer: () => void;
}

interface StoredAgencySession {
  agencyId: string;
  phone: string;
  pin: string;
}

const AGENCY_SESSION_KEY = 'karya_agency_phone_session_v1';

function loadAgencySession(): StoredAgencySession | null {
  try {
    const raw = window.localStorage.getItem(AGENCY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAgencySession;
    if (parsed?.agencyId && parsed?.pin) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveAgencySession(sess: StoredAgencySession | null) {
  try {
    if (!sess) {
      window.localStorage.removeItem(AGENCY_SESSION_KEY);
    } else {
      window.localStorage.setItem(AGENCY_SESSION_KEY, JSON.stringify(sess));
    }
  } catch {
    // Ignore storage errors
  }
}

export const AgencyPortal: React.FC<AgencyPortalProps> = ({ onGoToCustomer }) => {
  const [sessionCreds, setSessionCreds] = useState<StoredAgencySession | null>(() =>
    loadAgencySession(),
  );
  const [agency, setAgency] = useState<AgencyProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(loadAgencySession()));
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'dashboard' | 'cars' | 'bookings' | 'profile'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [cars, setCars] = useState<CarOffer[]>([]);
  const [bookings, setBookings] = useState<AgencyBookingRecord[]>([]);
  const [catalog, setCatalog] = useState<CatalogCar[]>(STARTER_CATALOG);

  const loadCatalog = async () => {
    try {
      const { data, error } = await supabase
        .from('car_catalog')
        .select('*')
        .order('brand', { ascending: true })
        .order('model', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        setCatalog(data.map((row) => mapCatalogRow(row as Record<string, any>)));
        return;
      }
    } catch {
      // Fallback to STARTER_CATALOG
    }
    setCatalog(STARTER_CATALOG);
  };

  const fetchCars = async (creds: StoredAgencySession, agencyName: string) => {
    const { data, error } = await supabase.rpc('agency_get_cars', {
      p_agency_id: creds.agencyId,
      p_pin: creds.pin,
    });

    if (!error && Array.isArray(data)) {
      const mapped: CarOffer[] = data.map((row: Record<string, any>) => {
        const brand = String(row.brand || 'سيارة');
        const model = String(row.model || '');
        const img = resolveCatalogImage(brand, model, row.primary_image_url);
        return {
          id: String(row.id),
          agency_id: String(row.agency_id),
          catalog_id: row.catalog_id ? String(row.catalog_id) : null,
          agency_name: agencyName,
          agency_rating: 5,
          agency_rating_count: 0,
          brand,
          model,
          model_year: row.model_year ? Number(row.model_year) : null,
          color: row.color ? String(row.color) : null,
          fuel_type: (row.fuel_type as FuelType) || 'diesel',
          transmission: (row.transmission as TransmissionType) || 'manual',
          seats: Number(row.seats ?? 5),
          primary_image_url: img,
          gallery_images: [img],
          daily_price: Number(row.daily_price),
          deposit_amount: 0,
          city: String(row.city),
          status: row.status === 'unavailable' ? 'unavailable' : 'available',
          distance_km: null,
        };
      });
      setCars(mapped);
    }
  };

  const fetchBookings = async (creds: StoredAgencySession) => {
    const { data, error } = await supabase.rpc('agency_get_bookings', {
      p_agency_id: creds.agencyId,
      p_pin: creds.pin,
    });

    if (!error && Array.isArray(data)) {
      const mapped: AgencyBookingRecord[] = data.map((row: Record<string, any>) => ({
        id: String(row.id),
        booking_code: String(row.booking_code || row.id.slice(0, 8)),
        customer_name: String(row.customer_name),
        customer_cin: String(row.customer_cin),
        customer_phone: String(row.customer_phone),
        customer_license_number: row.customer_license_number ?? null,
        customer_license_issue_date: row.customer_license_issue_date ?? null,
        pickup_location: row.pickup_location ?? null,
        days: Number(row.days),
        daily_price: Number(row.daily_price),
        total_amount: Number(row.total_amount),
        commission_amount: Number(row.commission_amount ?? Number(row.total_amount) * 0.1),
        agency_payout_amount: Number(row.agency_payout_amount ?? Number(row.total_amount) * 0.9),
        delivery_at: String(row.delivery_at),
        status: row.status,
        selected_bank_code: row.selected_bank_code,
        receipt_url: row.receipt_url,
        created_at: String(row.created_at),
        car_brand: row.car_brand,
        car_model: row.car_model,
        car_image: row.car_image,
        agency_ack_status: row.agency_ack_status || 'pending',
        agency_ack_at: row.agency_ack_at ?? null,
        agency_ack_note: row.agency_ack_note ?? null,
        reassigned_at: row.reassigned_at ?? null,
        dispute_flag: row.dispute_flag ?? null,
      }));
      setBookings(mapped);
    }
  };

  const hydrateAgencyFromCreds = async (creds: StoredAgencySession) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('login_agency_by_phone', {
        p_phone: creds.phone,
        p_pin: creds.pin,
      });

      if (error || !Array.isArray(data) || data.length === 0) {
        saveAgencySession(null);
        setSessionCreds(null);
        setAgency(null);
        setLoading(false);
        return;
      }

      const row = data[0] as AgencyProfile;
      setAgency(row);
      await Promise.all([
        loadCatalog(),
        fetchCars(creds, row.name),
        fetchBookings(creds),
      ]);
    } catch {
      saveAgencySession(null);
      setSessionCreds(null);
      setAgency(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshAgencyData = async (creds: StoredAgencySession) => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.rpc('login_agency_by_phone', {
        p_phone: creds.phone,
        p_pin: creds.pin,
      });
      if (!error && Array.isArray(data) && data[0]) {
        const latest = data[0] as AgencyProfile;
        setAgency(latest);
        await Promise.all([
          fetchCars(creds, latest.name),
          fetchBookings(creds),
        ]);
      } else {
        await Promise.all([
          fetchCars(creds, agency?.name || ''),
          fetchBookings(creds),
        ]);
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCatalog();
    if (sessionCreds) {
      hydrateAgencyFromCreds(sessionCreds);
    }
  }, []);

  useEffect(() => {
    if (sessionCreds && agency) {
      refreshAgencyData(sessionCreds);
    }
  }, [view]);

  const handleAuthSuccess = async (profile: AgencyProfile, creds: StoredAgencySession) => {
    saveAgencySession(creds);
    setSessionCreds(creds);
    setAgency(profile);
    setLoading(true);
    await Promise.all([
      loadCatalog(),
      fetchCars(creds, profile.name),
      fetchBookings(creds),
    ]);
    setLoading(false);
  };

  const handleLogout = () => {
    saveAgencySession(null);
    setSessionCreds(null);
    setAgency(null);
    setCars([]);
    setBookings([]);
    setView('dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-[65vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--karya-primary)]" />
      </div>
    );
  }

  if (!sessionCreds || !agency) {
    return (
      <AgencyPhoneAuthView
        onAuthenticated={handleAuthSuccess}
        onGoToCustomer={onGoToCustomer}
      />
    );
  }

  const isSameDay = (iso: string) => {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return false;
    const now = new Date();
    return (
      dt.getFullYear() === now.getFullYear() &&
      dt.getMonth() === now.getMonth() &&
      dt.getDate() === now.getDate()
    );
  };

  const preAlertBookings = bookings.filter((b) => b.status === 'payment_uploaded');
  const verifiedBookings = bookings.filter((b) => b.status === 'payment_verified');
  const actionRequiredBookings = bookings.filter(
    (b) => b.status === 'payment_uploaded' || b.status === 'payment_verified',
  );
  const todayConfirmedCount = bookings.filter(
    (b) =>
      ['payment_verified', 'car_delivered', 'completed'].includes(b.status) &&
      (isSameDay(b.delivery_at) || isSameDay(b.created_at)),
  ).length;
  const availableCarsCount = cars.filter((c) => c.status === 'available').length;
  const totalPayoutExpected = bookings
    .filter((b) => ['payment_verified', 'car_delivered', 'completed'].includes(b.status))
    .reduce((sum, b) => sum + b.agency_payout_amount, 0);

  const selectView = (nextView: 'dashboard' | 'cars' | 'bookings' | 'profile') => {
    setView(nextView);
    setMobileMenuOpen(false);
  };

  const navContent = (
    <>
      <div className="flex items-center gap-3 pb-3.5 border-b border-[var(--karya-border)]">
        <div className="w-10 h-10 rounded-xl bg-[var(--karya-primary)] text-white font-bold flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-[var(--karya-text-muted)]">بوابة الوكالات</p>
          <p className="font-extrabold text-[var(--karya-primary)] truncate">{agency.name}</p>
        </div>
      </div>

      <nav className="space-y-1">
        <button
          type="button"
          onClick={() => selectView('dashboard')}
          className={`w-full text-right px-3.5 min-h-[44px] py-2.5 rounded-xl text-sm font-bold flex items-center gap-2.5 transition-colors ${
            view === 'dashboard'
              ? 'bg-[var(--karya-primary)] text-white'
              : 'text-[var(--karya-text-muted)] hover:bg-[var(--karya-surface-muted)] hover:text-[var(--karya-primary)]'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>الرئيسية</span>
        </button>

        <button
          type="button"
          onClick={() => selectView('cars')}
          className={`w-full text-right px-3.5 min-h-[44px] py-2.5 rounded-xl text-sm font-bold flex items-center gap-2.5 transition-colors ${
            view === 'cars'
              ? 'bg-[var(--karya-primary)] text-white'
              : 'text-[var(--karya-text-muted)] hover:bg-[var(--karya-surface-muted)] hover:text-[var(--karya-primary)]'
          }`}
        >
          <CarFront className="w-4 h-4" />
          <span>أسطول السيارات ({cars.length})</span>
        </button>

        <button
          type="button"
          onClick={() => selectView('bookings')}
          className={`w-full text-right px-3.5 min-h-[44px] py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors ${
            view === 'bookings'
              ? 'bg-[var(--karya-primary)] text-white'
              : 'text-[var(--karya-text-muted)] hover:bg-[var(--karya-surface-muted)] hover:text-[var(--karya-primary)]'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <CalendarCheck2 className="w-4 h-4" />
            <span>الحجوزات ({bookings.length})</span>
          </span>
          {preAlertBookings.length > 0 && (
            <span
              className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${
                view === 'bookings'
                  ? 'bg-[var(--karya-accent)] text-white'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              {preAlertBookings.length} جديد
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => selectView('profile')}
          className={`w-full text-right px-3.5 min-h-[44px] py-2.5 rounded-xl text-sm font-bold flex items-center gap-2.5 transition-colors ${
            view === 'profile'
              ? 'bg-[var(--karya-primary)] text-white'
              : 'text-[var(--karya-text-muted)] hover:bg-[var(--karya-surface-muted)] hover:text-[var(--karya-primary)]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>معلومات الوكالة</span>
        </button>
      </nav>

      <div className="pt-3 border-t border-[var(--karya-border)] space-y-1">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full text-right px-3.5 min-h-[44px] py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </>
  );

  const unreadNotificationsCount = preAlertBookings.length + verifiedBookings.length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6" dir="rtl">
      <header className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-xs px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="فتح قائمة الوكالة"
            className="min-h-[44px] min-w-[44px] rounded-lg bg-[var(--karya-primary)] text-white flex items-center justify-center shrink-0 hover:bg-[var(--karya-primary-hover)] transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[var(--karya-text-muted)]">
              {view === 'dashboard' && 'بوابة الوكالات · الرئيسية'}
              {view === 'cars' && `أسطول السيارات (${cars.length})`}
              {view === 'bookings' && `الطلبات والحجوزات (${bookings.length})`}
              {view === 'profile' && 'إعدادات الوكالة'}
            </div>
            <div className="text-base font-extrabold text-[var(--karya-primary)] truncate">{agency.name}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => refreshAgencyData(sessionCreds)}
            aria-label="تحديث البيانات"
            className="min-h-[44px] min-w-[44px] rounded-lg border border-[var(--karya-border)] bg-[var(--karya-bg)] hover:bg-[var(--karya-surface-muted)] text-[var(--karya-primary)] flex items-center justify-center transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => selectView('bookings')}
            aria-label="تنبيهات الحجوزات"
            className="relative min-h-[44px] min-w-[44px] rounded-lg border border-[var(--karya-border)] bg-[var(--karya-bg)] hover:bg-[var(--karya-surface-muted)] text-[var(--karya-primary)] flex items-center justify-center transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1 rounded-full bg-[var(--karya-action)] text-white text-[10px] font-extrabold flex items-center justify-center font-mono-tabular shadow-xs">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#173B57]/55 backdrop-blur-xs flex"
          onClick={() => setMobileMenuOpen(false)}
          dir="rtl"
        >
          <aside
            className="w-76 max-w-[85vw] h-full bg-[var(--karya-surface)] shadow-xl p-5 flex flex-col gap-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--karya-text-muted)]">قائمة إدارة الوكالة</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="إغلاق القائمة"
                className="min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-[var(--karya-text-muted)] hover:bg-[var(--karya-surface-muted)] hover:text-[var(--karya-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {navContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="min-w-0 space-y-6">
        {agency.verification_status === 'pending' && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs sm:text-sm text-amber-900">
            حساب وكالتك قيد المراجعة والتوثيق من طرف مدير المنصة. يمكنك إضافة سياراتك الاقتصادية من الكتالوج وتعديل أسعارها الآن، وستظهر للعملاء فور التوثيق.
          </div>
        )}

        {agency.verification_status === 'suspended' && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-xs sm:text-sm text-red-800">
            تم إيقاف ظهور سيارات هذه الوكالة مؤقتاً من طرف الإدارة. تواصل مع إدارة المنصة لمزيد من التفاصيل.
          </div>
        )}

        {(agency.strike_count ?? 0) > 0 && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs sm:text-sm text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              مؤشر الالتزام: سُجّل على وكالتك <strong>{agency.strike_count}</strong> حالة عدم توفر/تحويل طلب. الالتزام بالحجوزات المؤكدة يحمي حسابك من الإيقاف المؤقت.
            </span>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="space-y-5">
            {/* Welcoming Hero Section */}
            <section className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--karya-primary)]">
                  مرحباً، {agency.name}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-[var(--karya-text-muted)]">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--karya-text)]">
                    <MapPin className="w-4 h-4 text-[var(--karya-text-muted)]" />
                    <span>{getCityLabelAr(agency.city)}</span>
                  </span>
                  <span className="text-[var(--karya-border)]" aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-[var(--karya-action)]">
                    <ShieldCheck className="w-4 h-4" />
                    <span>بدون ضمانة مالية</span>
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-[var(--karya-bg)] border border-[var(--karya-border)] px-4 py-3 shrink-0">
                <div className="text-[11px] font-semibold text-[var(--karya-text-muted)]">
                  يُستخلص عند التسليم (90%)
                </div>
                <div className="text-xl font-extrabold text-[var(--karya-primary)] font-mono-tabular mt-0.5">
                  {formatDH(totalPayoutExpected)}
                </div>
              </div>
            </section>

            {/* Dashboard Stats Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label="إحصائيات الوكالة">
              <div className="rounded-xl bg-[var(--karya-surface)] border border-[var(--karya-border)] p-5 shadow-xs flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-bold text-[var(--karya-text-muted)]">
                    الحجوزات المؤكدة اليوم
                  </p>
                  <p className="text-3xl sm:text-4xl font-extrabold text-[var(--karya-primary)] font-mono-tabular leading-none pt-1">
                    {todayConfirmedCount}
                  </p>
                  <p className="text-xs font-semibold text-[var(--karya-action)] pt-1">
                    جاهز للتسليم الآن: <span className="font-mono-tabular">{verifiedBookings.length}</span>
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[var(--karya-action-soft)] text-[var(--karya-action)] flex items-center justify-center shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
              </div>

              <div className="rounded-xl bg-[var(--karya-surface)] border border-[var(--karya-border)] p-5 shadow-xs flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-bold text-[var(--karya-text-muted)]">
                    السيارات المتاحة
                  </p>
                  <p className="text-3xl sm:text-4xl font-extrabold text-[var(--karya-primary)] font-mono-tabular leading-none pt-1" dir="ltr">
                    {availableCarsCount} / {cars.length}
                  </p>
                  <p className="text-xs font-semibold text-[var(--karya-text-muted)] pt-1">
                    نشطة وظاهرة للعملاء في {getCityLabelAr(agency.city)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[var(--karya-primary-soft)] text-[var(--karya-primary)] flex items-center justify-center shrink-0">
                  <CarFront className="w-6 h-6" />
                </div>
              </div>
            </section>

            {/* Fleet directly visible on the main workspace */}
            <AgencyFleetManager
              creds={sessionCreds}
              agency={agency}
              catalog={catalog}
              cars={cars}
              bookings={bookings}
              onRefresh={() => fetchCars(sessionCreds, agency.name)}
              sectionTitle="أسطولي الحالي"
              sectionSubtitle="تظهر سياراتك هنا مباشرة بمجرد إضافتها مع حالة الحجوزات النشطة"
            />

            <AgencyBookingsManager
              creds={sessionCreds}
              bookings={actionRequiredBookings.slice(0, 8)}
              onRefresh={() => fetchBookings(sessionCreds)}
              title="الطلبات والحجوزات الجارية"
            />
          </div>
        )}

        {view === 'cars' && (
          <AgencyFleetManager
            creds={sessionCreds}
            agency={agency}
            catalog={catalog}
            cars={cars}
            bookings={bookings}
            onRefresh={() => fetchCars(sessionCreds, agency.name)}
          />
        )}

        {view === 'bookings' && (
          <AgencyBookingsManager
            creds={sessionCreds}
            bookings={bookings}
            onRefresh={() => fetchBookings(sessionCreds)}
          />
        )}

        {view === 'profile' && (
          <AgencyProfileSettings
            creds={sessionCreds}
            agency={agency}
            onSaved={(updatedProfile, updatedPhone) => {
              const nextCreds = { ...sessionCreds, phone: updatedPhone };
              saveAgencySession(nextCreds);
              setSessionCreds(nextCreds);
              setAgency(updatedProfile);
              fetchCars(nextCreds, updatedProfile.name);
            }}
            onPinChanged={(nextPin) => {
              const nextCreds = { ...sessionCreds, pin: nextPin };
              saveAgencySession(nextCreds);
              setSessionCreds(nextCreds);
            }}
            onDeleted={handleLogout}
          />
        )}
      </main>
    </div>
  );
};

/* ============================================================================
   1. SINGLE-SCREEN PHONE + PIN AUTH & REGISTRATION (NO EMAIL, NO BANK RIB)
   ============================================================================ */
const AGENCY_FAQS = [
  {
    q: 'هل الكراء بدون ضمانة مالية يعني تسليم السيارة بدون عقد أو وثائق؟',
    a: 'لا. عدم طلب شيك ضمان أو ضمانة مالية من الزبون لا يعني التسليم بدون عقد أو وثائق. توقّع وكالتك عقد الكراء الرسمي المعتاد، وتتحقق من البطاقة الوطنية ورخصة سياقة سارية المفعول منذ 3 سنوات على الأقل قبل تسليم السيارة.',
  },
  {
    q: 'لماذا تشترط Karya رخصة سياقة منذ 3 سنوات على الأقل؟',
    a: 'تعتمد Karya هذا الشرط لتعزيز الثقة بين الزبائن والوكالات الشريكة. فأقدمية الرخصة، إلى جانب تسبيق 10% ومدة كراء لا تقل عن 3 أيام، تساعد على تقليل مخاطر الكراء وتعزيز ثقة الوكالات عند تسليم السيارات دون ضمانة مالية.',
  },
  {
    q: 'كيف يتم تأكيد الحجز ومتى تستلم الوكالة مستحقاتها؟',
    a: 'لتأكيد الحجز، يدفع الزبون 10% من إجمالي مبلغ الكراء عبر المنصة وتتم مراجعة الوصل قبل اعتماد الطلب (وهي عمولة المنصة). أما المبلغ المتبقي (90%) فتستلمه الوكالة مباشرة من الزبون عند معاينة السيارة وتسليمها. وأقل مدة للكراء هي 3 أيام.',
  },
  {
    q: 'ماذا يحدث إذا لم يحضر الزبون أو لم تستوفِ رخصته الشرط المطلوب؟',
    a: 'توفر لك المنصة إمكانية الإبلاغ عن عدم التزام الزبون من لوحة الوكالة، وذلك عند عدم الحضور أو إذا كانت رخصة السياقة لا تستوفي شرط الـ 3 سنوات على الأقل، مما يحفظ حق الوكالة في التعامل مع الطلب.',
  },
  {
    q: 'هل يمكن للوكالة تحديد السعر اليومي بحرية؟',
    a: 'نعم. للوكالة الحرية الكاملة في تحديد السعر اليومي وتعديله في أي وقت من لوحة التحكم، بما يتناسب مع نوع السيارة والتأمين ومصاريف التشغيل بدون ضمانة مالية. ويُنصح أن يكون السعر منطقياً مقارنة بالسوق المحلي لضمان استمرارية الطلبات.',
  },
  {
    q: 'ما هي المعلومات المطلوبة لتسجيل الوكالة في المنصة؟',
    a: 'يمكنك تسجيل وكالتك بسهولة في خطوة واحدة باستخدام اسم الوكالة، رقم الهاتف، المدينة، والرمز السري، دون الحاجة إلى بريد إلكتروني أو حساب بنكي عند التسجيل.',
  },
];

const AgencyPhoneAuthView: React.FC<{
  onAuthenticated: (profile: AgencyProfile, creds: StoredAgencySession) => void;
  onGoToCustomer: () => void;
}> = ({ onAuthenticated, onGoToCustomer }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Casablanca');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const captureGps = () => {
    if (!navigator.geolocation) {
      setGpsNote('المتصفح لا يدعم GPS — المدينة المختارة كافية.');
      return;
    }
    setGpsNote('جاري تحديد الموقع...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsNote('تم حفظ موقع الوكالة بنجاح.');
      },
      () => {
        setGpsNote('تعذر الوصول للموقع — يمكنك المتابعة باختيار المدينة.');
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = phone.trim();
    const cleanPin = pin.trim();

    if (!cleanPhone || !cleanPin) {
      setError('يرجى إدخال رقم الهاتف والرمز السري.');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setError('يرجى إدخال اسم الوكالة.');
        return;
      }
      if (cleanPin.length < 4) {
        setError('الرمز السري يجب أن يتكون من 4 أرقام أو رموز على الأقل.');
        return;
      }
      if (!termsAccepted) {
        setError('يجب الموافقة على شروط الانضمام إلى Karya لإتمام التسجيل.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { data, error: rpcErr } = await supabase.rpc('login_agency_by_phone', {
          p_phone: cleanPhone,
          p_pin: cleanPin,
        });

        if (rpcErr) {
          throw new Error(rpcErr.message);
        }
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('رقم الهاتف أو الرمز السري غير صحيح.');
        }

        const profile = data[0] as AgencyProfile;
        onAuthenticated(profile, {
          agencyId: profile.id,
          phone: profile.phone,
          pin: cleanPin,
        });
      } else {
        const { data, error: rpcErr } = await supabase.rpc('register_agency_by_phone', {
          p_name: name.trim(),
          p_phone: cleanPhone,
          p_city: city,
          p_pin: cleanPin,
          p_lat: coords?.lat ?? null,
          p_lng: coords?.lng ?? null,
          p_terms_accepted: termsAccepted,
        });

        if (rpcErr) {
          throw new Error(rpcErr.message);
        }
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('تعذر إتمام التسجيل، يرجى المحاولة مرة أخرى.');
        }

        const profile = data[0] as AgencyProfile;
        onAuthenticated(profile, {
          agencyId: profile.id,
          phone: profile.phone,
          pin: cleanPin,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8 sm:py-10 space-y-6" dir="rtl">
      <div className="bg-[var(--karya-surface)] p-6 sm:p-8 rounded-xl border border-[var(--karya-border)] shadow-xs space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-extrabold text-[var(--karya-primary)]">
            {mode === 'login' ? 'دخول وكالات كراء السيارات' : 'انضم إلى شبكة وكالات Karya'}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--karya-text-muted)]">
            {mode === 'login'
              ? 'ادخل برقم الهاتف والرمز السري لإدارة أسطولك والأسعار'
              : 'سجّل وكالتك في خطوة واحدة بدون بريد إلكتروني أو حساب بنكي'}
          </p>
        </div>

        {/* Mode switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--karya-bg)] border border-[var(--karya-border)] rounded-xl">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`min-h-[40px] py-2 text-xs font-bold rounded-lg transition-colors ${
              mode === 'login'
                ? 'bg-[var(--karya-surface)] text-[var(--karya-primary)] shadow-xs'
                : 'text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
              setShowForgotPin(false);
            }}
            className={`min-h-[40px] py-2 text-xs font-bold rounded-lg transition-colors ${
              mode === 'register'
                ? 'bg-[var(--karya-surface)] text-[var(--karya-primary)] shadow-xs'
                : 'text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
            }`}
          >
            تسجيل وكالة جديدة
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs sm:text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1.5">
                اسم الوكالة / الشركة
              </label>
              <input
                type="text"
                required
                placeholder="مثال: أطلس كار الدار البيضاء"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] px-3.5 py-2.5 text-sm text-[var(--karya-text)] focus:border-[var(--karya-action)] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1.5">
              رقم الهاتف
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-[var(--karya-text-muted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="tel"
                required
                dir="ltr"
                placeholder="0612345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] pr-9 pl-3.5 py-2.5 text-sm font-mono text-[var(--karya-text)] focus:border-[var(--karya-action)] focus:outline-none"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1.5">
                  المدينة
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] px-3 py-2.5 text-sm text-[var(--karya-text)] bg-[var(--karya-surface)] focus:border-[var(--karya-action)] focus:outline-none"
                >
                  {MOROCCAN_CITIES.map((c) => (
                    <option key={c.slug} value={c.nameFr}>
                      {c.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={captureGps}
                  className={`min-h-[44px] rounded-lg border px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    coords
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-[var(--karya-border)] bg-[var(--karya-surface-muted)] hover:bg-[var(--karya-bg)] text-[var(--karya-text)]'
                  }`}
                >
                  <Navigation className="w-4 h-4" />
                  <span>{coords ? 'تم حفظ موقع الوكالة' : 'تحديد موقع GPS (اختياري)'}</span>
                </button>
                {gpsNote && (
                  <p className="text-[11px] text-[var(--karya-text-muted)] mt-1 text-center">{gpsNote}</p>
                )}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[var(--karya-text)]">
                الرمز السري (PIN)
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setShowForgotPin((v) => !v)}
                  className="text-xs font-semibold text-[var(--karya-action)] hover:underline"
                >
                  نسيت الرمز السري؟
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--karya-text-muted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPin ? 'text' : 'password'}
                required
                minLength={4}
                dir="ltr"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] pr-9 pl-10 py-2.5 text-sm font-mono text-[var(--karya-text)] focus:border-[var(--karya-action)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)] p-1"
                aria-label={showPin ? 'إخفاء الرمز السري' : 'إظهار الرمز السري'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {mode === 'login' && showForgotPin && (
              <div className="mt-2.5 rounded-xl border border-[var(--karya-border)] bg-[var(--karya-action-soft)] p-3 text-xs text-[var(--karya-text)] space-y-1 leading-relaxed">
                <div className="font-bold text-[var(--karya-primary)] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[var(--karya-action)]" />
                  <span>استرجاع حساب الوكالة برقم الهاتف</span>
                </div>
                <p>
                  بما أن التسجيل يعتمد على رقم الهاتف دون بريد إلكتروني، تواصل مع إدارة المنصة عبر الرقم المسجل لتزويدك برمز سري مؤقت بعد التحقق من هويتك، ثم قم بتغييره من قسم «الإعدادات» فور دخولك.
                </p>
              </div>
            )}
          </div>

          {mode === 'register' && (
            <label className="flex items-start gap-3 rounded-xl border border-[var(--karya-border)] bg-[var(--karya-action-soft)] p-3.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-[var(--karya-border)] text-[var(--karya-action)] focus:ring-[var(--karya-action)] shrink-0"
              />
              <span className="text-xs text-[var(--karya-text)] leading-relaxed space-y-1.5 block">
                <span className="font-bold text-[var(--karya-primary)] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--karya-action)]" />
                  شروط الانضمام إلى Karya:
                </span>
                <span className="block">
                  <strong>1. شروط الكراء:</strong> ألتزم بتوفير السيارات المعروضة{' '}
                  <strong>بدون شيك ضمان أو ضمانة مالية</strong>، مع احترام مدة كراء لا تقل عن 3 أيام، ورخصة سياقة للزبون منذ 3 سنوات على الأقل، وتوقيع عقد الكراء الرسمي والتحقق من الوثائق عند التسليم.
                </span>
                <span className="block">
                  <strong>2. طريقة الأداء وعمولة المنصة:</strong> أوافق على أن يدفع الزبون <strong>10% من إجمالي مبلغ الكراء</strong> عبر المنصة لتأكيد الحجز (وهي عمولة المنصة)، وأن تستلم الوكالة <strong>المبلغ المتبقي (90%)</strong> مباشرة من الزبون عند تسليم السيارة.
                </span>
                <span className="block">
                  <strong>3. الالتزام بمعلومات الحجز:</strong> ألتزم بتحديث توفر السيارات والأسعار بدقة، والتعامل بمهنية مع الطلبات المؤكدة.
                </span>
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] rounded-xl bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] disabled:opacity-65 text-white py-3 font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{mode === 'login' ? 'تسجيل الدخول' : 'تسجيل الوكالة والدخول مباشرة'}</span>
          </button>
        </form>

        <div className="text-center pt-2 border-t border-[var(--karya-border)]">
          <button
            type="button"
            onClick={onGoToCustomer}
            className="text-xs font-medium text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)] transition-colors"
          >
            العودة لواجهة العملاء
          </button>
        </div>
      </div>

      {/* Agency Partner FAQ Section */}
      <section
        aria-label="الأسئلة الشائعة للوكالات"
        className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-xs overflow-hidden"
      >
        {/* Solid Deep Karya Blue Header Band */}
        <div className="bg-[var(--karya-primary)] px-5 py-4 sm:px-6 sm:py-5 flex items-center gap-3.5 text-white">
          <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/15 text-[var(--karya-accent)] flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-sm sm:text-base font-extrabold tracking-tight">
              الأسئلة الشائعة – الوكالات الشريكة
            </h3>
            <p className="text-xs text-slate-200">
              كل ما يضمن حقوق وكالتك ويزيد أرباحك عبر Karya
            </p>
          </div>
        </div>

        {/* Hairline-Separated FAQ Rows */}
        <div className="divide-y divide-[var(--karya-border)]">
          {AGENCY_FAQS.map((item, idx) => {
            const isOpen = openFaqIndex === idx;
            const numLabel = String(idx + 1).padStart(2, '0');

            return (
              <div
                key={item.q}
                className={`transition-colors ${
                  isOpen ? 'bg-[var(--karya-action-soft)]/50' : 'hover:bg-[var(--karya-surface-muted)]'
                }`}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaqIndex((prev) => (prev === idx ? null : idx))}
                  className="w-full min-h-[54px] flex items-center justify-between gap-3 text-right px-5 py-3.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg font-mono-tabular text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
                        isOpen
                          ? 'bg-[var(--karya-action)] text-white'
                          : 'bg-[var(--karya-surface-muted)] text-[var(--karya-primary)] border border-[var(--karya-border)]'
                      }`}
                      aria-hidden="true"
                    >
                      {numLabel}
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold text-[var(--karya-primary)] leading-snug">
                      {item.q}
                    </span>
                  </div>

                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[var(--karya-action)]' : 'text-[var(--karya-text-muted)]'
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 sm:pr-14 sm:pl-6">
                    <p className="text-xs text-[var(--karya-text-muted)] leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

/* ============================================================================
   2. FLEET MANAGER (CATALOG-ONLY PICKER + INLINE PRICE EDIT + DELETE)
   ============================================================================ */
const AgencyFleetManager: React.FC<{
  creds: StoredAgencySession;
  agency: AgencyProfile;
  catalog: CatalogCar[];
  cars: CarOffer[];
  bookings: AgencyBookingRecord[];
  onRefresh: () => void;
  sectionTitle?: string;
  sectionSubtitle?: string;
}> = ({
  creds,
  catalog,
  cars,
  bookings,
  onRefresh,
  sectionTitle = 'أسطول السيارات الاقتصادية',
  sectionSubtitle = 'اختر سياراتك من الكتالوج المركزي وحدد السعر اليومي بحرية (بدون ضمانة مالية)',
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStep, setAddStep] = useState<'select' | 'configure'>('select');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [fleetFilter, setFleetFilter] = useState<'all' | 'available' | 'booked' | 'unavailable'>('all');
  const modalBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showAddModal && modalBodyRef.current) {
      modalBodyRef.current.scrollTop = 0;
    }
  }, [addStep, showAddModal]);

  const brands = useMemo(
    () => Array.from(new Set(catalog.map((c) => c.brand))).sort(),
    [catalog],
  );
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<CatalogCar | null>(null);

  const [fuelType, setFuelType] = useState<FuelType>('diesel');
  const [transmission, setTransmission] = useState<TransmissionType>('manual');
  const [modelYear, setModelYear] = useState<number>(2025);
  const [color, setColor] = useState<string>('');
  const [dailyPrice, setDailyPrice] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Inline editing & delete state
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<number>(280);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyCarId, setBusyCarId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return catalog.filter((c) => {
      if (selectedBrand !== 'all' && c.brand !== selectedBrand) return false;
      if (q) {
        const hay = `${c.brand} ${c.model} ${c.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [catalog, selectedBrand, catalogSearch]);

  // Match active bookings (payment_uploaded / payment_verified / car_delivered) 1-to-1 to fleet cars
  const activeBookingByCarId = useMemo(() => {
    const map = new Map<string, AgencyBookingRecord>();
    const now = Date.now();
    const activeList = bookings.filter((b) => {
      if (!['payment_uploaded', 'payment_verified', 'car_delivered'].includes(b.status)) {
        return false;
      }
      if (b.agency_ack_status === 'unavailable' || b.dispute_flag) return false;
      if (b.status === 'car_delivered') return true;
      const startMs = new Date(b.delivery_at).getTime();
      if (Number.isNaN(startMs)) return true;
      const endMs = startMs + Math.max(1, b.days) * 24 * 60 * 60 * 1000;
      return endMs > now;
    });

    const usedBookingIds = new Set<string>();
    for (const car of cars) {
      const carKey = `${car.brand} ${car.model}`.trim().toLowerCase();
      const matched = activeList.find((b) => {
        if (usedBookingIds.has(b.id)) return false;
        const bKey = `${b.car_brand || ''} ${b.car_model || ''}`.trim().toLowerCase();
        return bKey && bKey === carKey;
      });
      if (matched) {
        usedBookingIds.add(matched.id);
        map.set(car.id, matched);
      }
    }
    return map;
  }, [cars, bookings]);

  const filteredCars = useMemo(() => {
    return cars.filter((car) => {
      const isBooked = activeBookingByCarId.has(car.id);
      if (fleetFilter === 'booked') return isBooked;
      if (fleetFilter === 'available') return car.status === 'available' && !isBooked;
      if (fleetFilter === 'unavailable') return car.status === 'unavailable';
      return true;
    });
  }, [cars, fleetFilter, activeBookingByCarId]);

  const openAddCarModal = () => {
    setErrMsg(null);
    setCatalogSearch('');
    setSelectedBrand('all');
    setSelectedModel(null);
    setDailyPrice('');
    setColor('');
    setAddStep('select');
    setShowAddModal(true);
  };

  const handleSelectCatalogModel = (item: CatalogCar) => {
    setSelectedModel(item);
    setFuelType(item.default_fuel);
    setTransmission(item.default_transmission);
    setErrMsg(null);
  };

  const handleAddCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModel) {
      setErrMsg('يرجى اختيار موديل من الكتالوج المركزي أولاً.');
      return;
    }
    const parsedPrice = Number(dailyPrice);
    if (!dailyPrice.trim() || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      setErrMsg('يرجى تحديد السعر اليومي بالدرهم.');
      return;
    }

    setSaving(true);
    setErrMsg(null);

    try {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          selectedModel.id,
        );

      const { error } = await supabase.rpc('agency_add_catalog_car', {
        p_agency_id: creds.agencyId,
        p_pin: creds.pin,
        p_catalog_id: isUuid ? selectedModel.id : null,
        p_brand: selectedModel.brand,
        p_model: selectedModel.model,
        p_image_url: selectedModel.image_url,
        p_fuel_type: fuelType,
        p_transmission: transmission,
        p_daily_price: parsedPrice,
        p_model_year: modelYear || 2025,
        p_seats: selectedModel.seats || 5,
        p_color: color.trim() || null,
      });

      if (error) throw new Error(error.message);

      setShowAddModal(false);
      setAddStep('select');
      setSelectedModel(null);
      setDailyPrice('');
      setColor('');
      onRefresh();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء إضافة السيارة.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (car: CarOffer) => {
    setBusyCarId(car.id);
    setActionError(null);
    const nextStatus = car.status === 'available' ? 'unavailable' : 'available';
    const { error } = await supabase.rpc('agency_update_car', {
      p_agency_id: creds.agencyId,
      p_pin: creds.pin,
      p_car_id: car.id,
      p_daily_price: null,
      p_status: nextStatus,
    });
    if (error) setActionError(error.message);
    setBusyCarId(null);
    onRefresh();
  };

  const handleSavePrice = async (carId: string) => {
    if (!priceDraft || priceDraft <= 0) {
      setActionError('يرجى إدخال سعر يومي أكبر من 0 درهم.');
      return;
    }
    setBusyCarId(carId);
    setActionError(null);
    const { error } = await supabase.rpc('agency_update_car', {
      p_agency_id: creds.agencyId,
      p_pin: creds.pin,
      p_car_id: carId,
      p_daily_price: priceDraft,
      p_status: null,
    });
    if (error) {
      setActionError(error.message);
    } else {
      setEditingPriceId(null);
      onRefresh();
    }
    setBusyCarId(null);
  };

  const handleDeleteCar = async (carId: string) => {
    setBusyCarId(carId);
    setActionError(null);
    const { error } = await supabase.rpc('agency_delete_car', {
      p_agency_id: creds.agencyId,
      p_pin: creds.pin,
      p_car_id: carId,
    });
    if (error) {
      setActionError(error.message);
    } else {
      setConfirmDeleteId(null);
      onRefresh();
    }
    setBusyCarId(null);
  };

  const bookedCount = activeBookingByCarId.size;
  const freeAvailableCount = cars.filter(
    (c) => c.status === 'available' && !activeBookingByCarId.has(c.id),
  ).length;
  const unavailableCount = cars.filter((c) => c.status === 'unavailable').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[var(--karya-primary)]">
            {sectionTitle}
          </h2>
          <p className="text-xs text-[var(--karya-text-muted)] mt-0.5">{sectionSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={openAddCarModal}
          className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] text-white px-4 py-2.5 text-sm font-extrabold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة سيارة من الكتالوج</span>
        </button>
      </div>

      {cars.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: 'all', label: `الكل (${cars.length})` },
              { key: 'available', label: `متاح الآن (${freeAvailableCount})` },
              { key: 'booked', label: `محجوز حالياً (${bookedCount})` },
              { key: 'unavailable', label: `غير متاح (${unavailableCount})` },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFleetFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                fleetFilter === f.key
                  ? 'bg-[var(--karya-primary)] text-white'
                  : 'bg-[var(--karya-surface)] border border-[var(--karya-border)] text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {actionError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs sm:text-sm text-red-700">
          {actionError}
        </div>
      )}

      {cars.length === 0 ? (
        <div className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-xs p-8 sm:p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--karya-action-soft)] text-[var(--karya-action)] flex items-center justify-center mx-auto">
            <CarFront className="w-6 h-6" />
          </div>
          <p className="font-extrabold text-base text-[var(--karya-primary)]">
            لم تقم بإضافة أي سيارة بعد
          </p>
          <p className="text-xs sm:text-sm text-[var(--karya-text-muted)] max-w-md mx-auto leading-relaxed">
            اختر موديل سياراتك من الكتالوج المركزي وحدد سعرك اليومي في أقل من دقيقة لتظهر فوراً للعملاء.
          </p>
          <button
            type="button"
            onClick={openAddCarModal}
            className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] text-white px-5 py-2.5 text-xs sm:text-sm font-extrabold transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة أول سيارة الآن</span>
          </button>
        </div>
      ) : filteredCars.length === 0 ? (
        <div className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-xs p-8 text-center text-xs sm:text-sm text-[var(--karya-text-muted)]">
          لا توجد سيارات مطابقة لهذا التصنيف حالياً.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCars.map((car) => {
            const isEditingPrice = editingPriceId === car.id;
            const isDeleting = confirmDeleteId === car.id;
            const isBusy = busyCarId === car.id;
            const activeBooking = activeBookingByCarId.get(car.id);

            const bookedUntilLabel = (() => {
              if (!activeBooking) return null;
              const startMs = new Date(activeBooking.delivery_at).getTime();
              if (Number.isNaN(startMs)) return null;
              const endDt = new Date(startMs + Math.max(1, activeBooking.days) * 24 * 60 * 60 * 1000);
              return endDt.toLocaleDateString('ar-MA', { month: 'short', day: 'numeric' });
            })();

            return (
              <div
                key={car.id}
                className={`bg-[var(--karya-surface)] rounded-xl shadow-xs overflow-hidden flex flex-col transition-colors ${
                  activeBooking
                    ? 'border border-[var(--karya-action)]/45'
                    : 'border border-[var(--karya-border)]'
                }`}
              >
                <div className="aspect-[16/10] bg-[var(--karya-surface-muted)] relative">
                  <img
                    src={car.primary_image_url}
                    alt={`${car.brand} ${car.model}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {activeBooking && (
                    <div
                      className={`absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-extrabold shadow-xs ${
                        activeBooking.status === 'payment_uploaded' &&
                        activeBooking.agency_ack_status === 'pending'
                          ? 'bg-amber-500 text-white'
                          : 'bg-[var(--karya-primary)] text-white'
                      }`}
                    >
                      <CalendarCheck2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {activeBooking.status === 'payment_uploaded' &&
                        activeBooking.agency_ack_status === 'pending'
                          ? `طلب جديد (${activeBooking.booking_code})`
                          : bookedUntilLabel
                            ? `محجوزة · إلى ${bookedUntilLabel}`
                            : 'محجوزة حالياً'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-extrabold text-[var(--karya-primary)] truncate">
                        {car.brand} {car.model} {car.model_year ? `(${car.model_year})` : ''}
                      </h3>
                      <span
                        className={`text-xs font-bold shrink-0 ${
                          car.status === 'available' ? 'text-emerald-700' : 'text-[var(--karya-text-muted)]'
                        }`}
                      >
                        {car.status === 'available' ? 'متاح' : 'غير متاح'}
                      </span>
                    </div>

                    {activeBooking && (
                      <div className="rounded-lg bg-[var(--karya-action-soft)] border border-[var(--karya-action)]/20 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--karya-primary)] flex items-center justify-between gap-2">
                        <span>
                          {activeBooking.status === 'car_delivered'
                            ? 'تم تسليمها للعميل'
                            : activeBooking.status === 'payment_verified'
                              ? 'حجز مؤكد'
                              : 'بانتظار التأكيد'}
                        </span>
                        <span className="font-mono-tabular font-extrabold text-[var(--karya-action)]">
                          {activeBooking.booking_code}
                        </span>
                      </div>
                    )}

                    {isEditingPrice ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            value={priceDraft}
                            onChange={(e) => setPriceDraft(Number(e.target.value))}
                            className="w-28 rounded-lg border border-[var(--karya-action)] px-2.5 py-1 text-sm font-mono-tabular text-[var(--karya-text)] focus:outline-none"
                          />
                          <span className="text-xs text-[var(--karya-text-muted)]">DH</span>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleSavePrice(car.id)}
                            className="p-1.5 rounded-lg bg-[var(--karya-action)] text-white hover:bg-[var(--karya-action-hover)]"
                            aria-label="حفظ السعر"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPriceId(null)}
                            className="p-1.5 rounded-lg bg-[var(--karya-bg)] text-[var(--karya-text-muted)] hover:bg-[var(--karya-border)]"
                            aria-label="إلغاء"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-[11px] font-semibold text-[var(--karya-action)] font-mono-tabular">
                          صافي التسليم (90%): {formatDH(Math.max(0, priceDraft || 0) * 0.9)} / يوم
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <div className="font-mono-tabular font-extrabold text-sm text-[var(--karya-primary)]">
                            {formatDH(car.daily_price)} / يوم
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPriceId(car.id);
                              setPriceDraft(car.daily_price);
                            }}
                            className="text-xs font-semibold text-[var(--karya-text-muted)] hover:text-[var(--karya-action)] inline-flex items-center gap-1 transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>تعديل السعر</span>
                          </button>
                        </div>
                        <div className="text-[11px] font-semibold text-[var(--karya-action)] font-mono-tabular">
                          صافي التسليم (90%): {formatDH(car.daily_price * 0.9)} / يوم
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[var(--karya-border)]">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => toggleStatus(car)}
                      className={`w-full min-h-[40px] rounded-lg py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors ${
                        car.status === 'available'
                          ? 'bg-[var(--karya-surface-muted)] border-[var(--karya-border)] text-[var(--karya-text)] hover:bg-[var(--karya-bg)]'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      {car.status === 'available' ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>تغيير إلى غير متاح</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>تفعيل كـ متاح</span>
                        </>
                      )}
                    </button>

                    {isDeleting ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDeleteCar(car.id)}
                          className="flex-1 min-h-[38px] rounded-lg bg-red-600 hover:bg-red-700 text-white py-1.5 text-xs font-bold"
                        >
                          تأكيد الحذف
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[38px] rounded-lg border border-[var(--karya-border)] px-3 py-1.5 text-xs font-semibold text-[var(--karya-text-muted)]"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(car.id)}
                        className="w-full min-h-[38px] rounded-lg py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center justify-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف من الأسطول</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Professional 2-Step Add Car From Catalog Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-[#173B57]/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-catalog-car-title"
          onClick={() => !saving && setShowAddModal(false)}
        >
          <form
            noValidate
            onSubmit={handleAddCar}
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--karya-surface)] w-full sm:max-w-3xl h-[92dvh] sm:h-auto sm:max-h-[90vh] rounded-t-2xl sm:rounded-xl shadow-2xl border border-[var(--karya-border)] flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-[var(--karya-border)] flex items-center justify-between gap-3 shrink-0 bg-[var(--karya-surface)]">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    id="add-catalog-car-title"
                    className="text-base sm:text-lg font-extrabold text-[var(--karya-primary)] truncate"
                  >
                    إضافة سيارة من الكتالوج المركزي
                  </h3>
                  <span className="inline-flex items-center rounded-md bg-[var(--karya-action-soft)] text-[var(--karya-action)] px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap">
                    {addStep === 'select' ? 'الخطوة 1 من 2' : 'الخطوة 2 من 2'}
                  </span>
                </div>
                <p className="text-xs text-[var(--karya-text-muted)] truncate">
                  {addStep === 'select'
                    ? 'اختر الموديل المناسب من الكتالوج ليتم تعبئة المواصفات والصور تلقائياً'
                    : 'حدد السعر اليومي ومواصفات السيارة لنشرها فوراً في أسطولك'}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowAddModal(false)}
                aria-label="إغلاق نافذة إضافة سيارة"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)] hover:bg-[var(--karya-bg)] shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div
              ref={modalBodyRef}
              className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4"
            >
              {addStep === 'select' ? (
                <>
                  {/* Search & Brand Filter */}
                  <div className="space-y-2.5">
                    <div className="relative">
                      <Search className="w-4 h-4 text-[var(--karya-text-muted)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="ابحث باسم الموديل أو الماركة (مثال: Logan, Clio, Duster...)"
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                        className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] bg-[var(--karya-bg)] pr-10 pl-3.5 py-2 text-sm text-[var(--karya-text)] focus:bg-white focus:border-[var(--karya-action)] focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={() => setSelectedBrand('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                          selectedBrand === 'all'
                            ? 'bg-[var(--karya-primary)] text-white'
                            : 'bg-[var(--karya-bg)] border border-[var(--karya-border)] text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
                        }`}
                      >
                        الكل ({catalog.length})
                      </button>
                      {brands.map((brand) => (
                        <button
                          key={brand}
                          type="button"
                          onClick={() => setSelectedBrand(brand)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                            selectedBrand === brand
                              ? 'bg-[var(--karya-primary)] text-white'
                              : 'bg-[var(--karya-bg)] border border-[var(--karya-border)] text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
                          }`}
                        >
                          {brand}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Catalog Models Grid */}
                  {filteredCatalog.length === 0 ? (
                    <div className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-bg)] p-8 text-center text-xs sm:text-sm text-[var(--karya-text-muted)]">
                      لا توجد سيارات مطابقة لبحثك. جرّب كلمة أخرى أو اختر «الكل».
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {filteredCatalog.map((item) => {
                        const active = selectedModel?.id === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectCatalogModel(item)}
                            className={`group text-right rounded-xl border overflow-hidden transition-all flex flex-col ${
                              active
                                ? 'border-[var(--karya-action)] ring-2 ring-[var(--karya-action)]/20 bg-[var(--karya-action-soft)]'
                                : 'border-[var(--karya-border)] bg-[var(--karya-surface)] hover:border-[var(--karya-action)]/50 hover:shadow-xs'
                            }`}
                          >
                            <div className="aspect-[16/10] bg-[var(--karya-surface-muted)] w-full overflow-hidden relative">
                              <img
                                src={item.image_url}
                                alt={`${item.brand} ${item.model}`}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              />
                              {active && (
                                <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-[var(--karya-action)] text-white flex items-center justify-center shadow-xs">
                                  <Check className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                            <div className="p-2.5 sm:p-3 space-y-0.5">
                              <div className="text-xs sm:text-sm font-extrabold text-[var(--karya-primary)] truncate">
                                {item.brand} {item.model}
                              </div>
                              <div className="text-[11px] text-[var(--karya-text-muted)] truncate">
                                {item.category} · {item.seats} مقاعد
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                selectedModel && (
                  <div className="space-y-4">
                    {/* Selected Model Preview Strip */}
                    <div className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-bg)] p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={selectedModel.image_url}
                          alt={`${selectedModel.brand} ${selectedModel.model}`}
                          className="w-20 h-14 rounded-lg object-cover border border-[var(--karya-border)] bg-white shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-extrabold text-[var(--karya-primary)] truncate">
                            {selectedModel.brand} {selectedModel.model}
                          </div>
                          <div className="text-xs text-[var(--karya-text-muted)]">
                            {selectedModel.category} · {selectedModel.seats} مقاعد · بدون ضمانة مالية
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAddStep('select')}
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-[var(--karya-border)] bg-white hover:bg-[var(--karya-surface-muted)] text-[var(--karya-primary)] px-3 py-1.5 text-xs font-bold transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                        <span>تغيير الموديل</span>
                      </button>
                    </div>

                    {/* Daily Price + Quick Chips */}
                    <div className="space-y-2.5">
                      <label
                        htmlFor="modal-daily-price"
                        className="block text-xs sm:text-sm font-extrabold text-[var(--karya-primary)]"
                      >
                        السعر اليومي للكراء (بالدرهم)
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[250, 300, 350, 400, 450, 500].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setDailyPrice(String(preset))}
                            className={`min-h-[40px] px-2.5 py-1.5 rounded-lg text-xs font-mono-tabular font-bold border transition-colors ${
                              Number(dailyPrice) === preset
                                ? 'border-[var(--karya-action)] bg-[var(--karya-action-soft)] text-[var(--karya-primary)] ring-1 ring-[var(--karya-action)]/30'
                                : 'border-[var(--karya-border)] bg-[var(--karya-bg)] text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
                            }`}
                          >
                            {preset} DH
                          </button>
                        ))}
                      </div>
                      <input
                        id="modal-daily-price"
                        required
                        type="number"
                        min={1}
                        placeholder="حدد سعراً آخر مناسباً لك (درهم/يوم)"
                        value={dailyPrice}
                        onChange={(e) => setDailyPrice(e.target.value)}
                        className="w-full min-h-[46px] rounded-lg border border-[var(--karya-border)] bg-white px-3.5 py-2 text-sm sm:text-base font-mono-tabular font-extrabold text-[var(--karya-primary)] placeholder:text-xs placeholder:font-sans placeholder:font-normal placeholder:text-[var(--karya-text-muted)] focus:border-[var(--karya-action)] focus:outline-none"
                      />
                    </div>

                    {/* Fuel & Transmission Segmented Controls + Year & Color */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <span className="block text-xs font-bold text-[var(--karya-primary)] mb-1.5">
                          نوع الوقود
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              { value: 'diesel', label: 'ديزل' },
                              { value: 'essence', label: 'بنزين' },
                              { value: 'hybrid', label: 'هجين' },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setFuelType(opt.value)}
                              className={`min-h-[42px] rounded-lg border text-xs font-bold transition-colors ${
                                fuelType === opt.value
                                  ? 'border-[var(--karya-action)] bg-[var(--karya-action-soft)] text-[var(--karya-primary)]'
                                  : 'border-[var(--karya-border)] bg-[var(--karya-bg)] text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="block text-xs font-bold text-[var(--karya-primary)] mb-1.5">
                          ناقل الحركة
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(
                            [
                              { value: 'manual', label: 'يدوي (Manuelle)' },
                              { value: 'automatic', label: 'أوتوماتيك (Auto)' },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setTransmission(opt.value)}
                              className={`min-h-[42px] rounded-lg border text-xs font-bold transition-colors ${
                                transmission === opt.value
                                  ? 'border-[var(--karya-action)] bg-[var(--karya-action-soft)] text-[var(--karya-primary)]'
                                  : 'border-[var(--karya-border)] bg-[var(--karya-bg)] text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="modal-model-year"
                          className="block text-xs font-bold text-[var(--karya-primary)] mb-1.5"
                        >
                          سنة الصنع
                        </label>
                        <input
                          id="modal-model-year"
                          type="number"
                          min={2015}
                          max={2027}
                          value={modelYear}
                          onChange={(e) => setModelYear(Number(e.target.value))}
                          className="w-full min-h-[42px] rounded-lg border border-[var(--karya-border)] bg-white px-3.5 py-2 text-sm font-mono-tabular text-[var(--karya-text)] focus:border-[var(--karya-action)] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="modal-car-color"
                          className="block text-xs font-bold text-[var(--karya-primary)] mb-1.5"
                        >
                          اللون (اختياري)
                        </label>
                        <input
                          id="modal-car-color"
                          type="text"
                          placeholder="أبيض، رمادي، أسود..."
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="w-full min-h-[42px] rounded-lg border border-[var(--karya-border)] bg-white px-3.5 py-2 text-sm text-[var(--karya-text)] focus:border-[var(--karya-action)] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Live 90% Net Handover Calculator */}
                    <div className="rounded-xl bg-[var(--karya-bg)] border border-[var(--karya-border)] p-3.5 sm:p-4 space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                        <div>
                          <div className="text-[11px] font-semibold text-[var(--karya-text-muted)]">
                            صافي ما تقبضه يومياً عند التسليم (90%)
                          </div>
                          <div className="text-base sm:text-lg font-extrabold text-[var(--karya-action)] font-mono-tabular mt-0.5">
                            {formatDH(Math.max(0, Number(dailyPrice) || 0) * 0.9)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-[var(--karya-text-muted)]">
                            صافي أقل حجز (3 أيام — 90%)
                          </div>
                          <div className="text-base sm:text-lg font-extrabold text-[var(--karya-primary)] font-mono-tabular mt-0.5">
                            {formatDH(Math.max(0, Number(dailyPrice) || 0) * 3 * 0.9)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-[var(--karya-text-muted)]">
                            مبلغ تأكيد الحجز للمنصة (3 أيام — 10%)
                          </div>
                          <div className="text-sm font-bold text-[var(--karya-text)] font-mono-tabular mt-0.5">
                            {formatDH(Math.max(0, Number(dailyPrice) || 0) * 3 * 0.1)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 pt-2 border-t border-[var(--karya-border)] text-xs text-[var(--karya-text-muted)] leading-relaxed">
                        <TrendingUp className="w-4 h-4 text-[var(--karya-accent)] shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-[var(--karya-text)]">نصيحة تسعير بدون ضمانة مالية:</strong>{' '}
                          حدد سعرك بحرية لتغطية التأمين ومصاريف التشغيل وتحصيل صافي الربح المناسب عند التسليم.
                        </span>
                      </div>
                    </div>

                    {errMsg && (
                      <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700 font-semibold">
                        {errMsg}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            {/* Modal Sticky Footer */}
            <div className="px-4 sm:px-6 py-3.5 border-t border-[var(--karya-border)] bg-[var(--karya-surface)] flex items-center justify-between gap-3 shrink-0">
              {addStep === 'select' ? (
                <>
                  <button
                    key="btn-step-select-cancel"
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]"
                  >
                    إلغاء
                  </button>
                  <button
                    key="btn-step-select-continue"
                    type="button"
                    disabled={!selectedModel}
                    onClick={(e) => {
                      e.preventDefault();
                      if (!selectedModel) return;
                      if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur();
                      }
                      setAddStep('configure');
                    }}
                    className="min-h-[44px] rounded-xl bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors"
                  >
                    <span>
                      {selectedModel
                        ? `متابعة مع ${selectedModel.brand} ${selectedModel.model}`
                        : 'اختر سيارة للمتابعة'}
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    key="btn-step-configure-back"
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur();
                      }
                      setAddStep('select');
                    }}
                    className="min-h-[44px] rounded-xl border border-[var(--karya-border)] bg-[var(--karya-surface)] hover:bg-[var(--karya-bg)] text-[var(--karya-primary)] px-4 py-2 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>رجوع</span>
                  </button>
                  <button
                    key="btn-step-configure-submit"
                    type="submit"
                    disabled={saving || !selectedModel}
                    className="min-h-[44px] rounded-xl bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] disabled:opacity-60 text-white px-5 py-2.5 text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>نشر السيارة في أسطولي</span>
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   3. BOOKINGS MANAGER (CLOUD SYNCED BY PHONE + PIN)
   ============================================================================ */
const AgencyBookingsManager: React.FC<{
  creds: StoredAgencySession;
  bookings: AgencyBookingRecord[];
  onRefresh: () => void;
  title?: string;
}> = ({ creds, bookings, onRefresh, title = 'الحجوزات والطلبات الواردة' }) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'prealert' | 'verified' | 'closed'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [disputeOpenId, setDisputeOpenId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const filteredBookings = useMemo(() => {
    if (statusFilter === 'prealert') {
      return bookings.filter((b) => b.status === 'payment_uploaded');
    }
    if (statusFilter === 'verified') {
      return bookings.filter((b) => b.status === 'payment_verified');
    }
    if (statusFilter === 'closed') {
      return bookings.filter((b) =>
        ['car_delivered', 'completed', 'refund_requested', 'refunded', 'cancelled'].includes(b.status),
      );
    }
    return bookings;
  }, [bookings, statusFilter]);

  const handlePrecheck = async (bookingId: string, ackStatus: 'available' | 'unavailable') => {
    setBusyId(bookingId);
    setActionErr(null);
    const { error } = await supabase.rpc('agency_respond_precheck', {
      p_agency_id: creds.agencyId,
      p_pin: creds.pin,
      p_booking_id: bookingId,
      p_ack_status: ackStatus,
      p_note: ackStatus === 'unavailable' ? 'الوكالة أبلغت عن عدم توفر السيارة' : null,
    });
    setBusyId(null);
    if (error) {
      setActionErr(error.message);
      return;
    }
    onRefresh();
  };

  const handleDeliverCar = async (bookingId: string) => {
    setBusyId(bookingId);
    setActionErr(null);
    const { error } = await supabase.rpc('agency_confirm_car_delivery', {
      p_agency_id: creds.agencyId,
      p_pin: creds.pin,
      p_booking_id: bookingId,
    });
    setBusyId(null);
    if (error) {
      setActionErr(error.message);
      return;
    }
    onRefresh();
  };

  const handleReportIssue = async (
    bookingId: string,
    issueType: 'invalid_license' | 'customer_no_show',
  ) => {
    setBusyId(bookingId);
    setActionErr(null);
    const note =
      issueType === 'invalid_license'
        ? 'رخصة سياقة أقل من 3 سنوات أو بيانات غير مطابقة عند التسليم'
        : 'تغيب العميل عن موعد استلام السيارة';
    const { error } = await supabase.rpc('agency_report_customer_issue', {
      p_agency_id: creds.agencyId,
      p_pin: creds.pin,
      p_booking_id: bookingId,
      p_issue_type: issueType,
      p_note: note,
    });
    setBusyId(null);
    if (error) {
      setActionErr(error.message);
      return;
    }
    setDisputeOpenId(null);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[var(--karya-primary)]">{title}</h2>
          <p className="text-xs text-[var(--karya-text-muted)] mt-0.5">
            تُحجب بيانات العميل أثناء مراجعة الوصل وتُكشف فور تأكيد الدفع · تستلم 90% عند التسليم (بدون ضمانة مالية)
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="self-start sm:self-auto min-h-[40px] rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface)] hover:bg-[var(--karya-surface-muted)] text-[var(--karya-primary)] px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تحديث الطلبات</span>
        </button>
      </div>

      {bookings.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: 'all', label: `الكل (${bookings.length})` },
              {
                key: 'prealert',
                label: `بانتظار التأكيد (${bookings.filter((b) => b.status === 'payment_uploaded').length})`,
              },
              {
                key: 'verified',
                label: `جاهز للتسليم (${bookings.filter((b) => b.status === 'payment_verified').length})`,
              },
              {
                key: 'closed',
                label: `مكتمل / ملغى (${bookings.filter((b) => ['car_delivered', 'completed', 'refund_requested', 'refunded', 'cancelled'].includes(b.status)).length})`,
              },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === f.key
                  ? 'bg-[var(--karya-primary)] text-white'
                  : 'bg-[var(--karya-surface)] border border-[var(--karya-border)] text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {actionErr && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs sm:text-sm text-red-700">
          {actionErr}
        </div>
      )}

      {filteredBookings.length === 0 ? (
        <div className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-xs p-10 text-center text-sm text-[var(--karya-text-muted)]">
          لا توجد طلبات أو حجوزات في هذه القائمة حالياً.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((b) => {
            const isMaskedPreAlert = b.status === 'payment_uploaded';
            const isMaskedClosed = ['refund_requested', 'refunded', 'cancelled'].includes(b.status);
            const hidePii = isMaskedPreAlert || isMaskedClosed;
            const hasUrgentAlert =
              Boolean(b.dispute_flag) || b.agency_ack_status === 'unavailable';
            const isMissedPickup = b.dispute_flag === 'customer_no_show';

            const formattedDelivery = (() => {
              const dt = new Date(b.delivery_at);
              return Number.isNaN(dt.getTime())
                ? b.delivery_at
                : dt.toLocaleDateString('ar-MA', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
            })();

            return (
              <article
                key={b.id}
                className={`bg-[var(--karya-surface)] rounded-xl overflow-hidden transition-all ${
                  hasUrgentAlert
                    ? 'border-2 border-red-500 shadow-xs'
                    : isMaskedPreAlert
                      ? 'border-2 border-amber-300 shadow-xs'
                      : 'border border-[var(--karya-border)] shadow-xs hover:border-[var(--karya-primary)]/30'
                }`}
              >
                {/* Striking Red Alert Banner for Missed Pickup / Urgent Disputes */}
                {hasUrgentAlert && (
                  <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between gap-2 text-xs font-extrabold">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        {isMissedPickup
                          ? 'تنبيه عاجل: تغيب العميل عن موعد استلام السيارة'
                          : b.dispute_flag === 'invalid_license'
                            ? 'تنبيه عاجل: رخصة العميل غير مطابقة (أقل من 3 سنوات)'
                            : 'تم الإبلاغ عن عدم توفر السيارة — بانتظار التحويل'}
                      </span>
                    </span>
                    <span className="font-mono-tabular text-[11px] bg-white/20 px-2 py-0.5 rounded">
                      {b.booking_code}
                    </span>
                  </div>
                )}

                <div className="p-4 sm:p-5 space-y-4">
                  {/* TOP CRITICAL INFO BAR: Car + Delivery Time + 90% Payout */}
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5 border-b border-[var(--karya-border)]">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base sm:text-lg font-extrabold text-[var(--karya-primary)]">
                          {b.car_brand} {b.car_model}
                        </h3>
                        <span className="font-mono-tabular text-xs font-bold text-[var(--karya-text-muted)] bg-[var(--karya-bg)] border border-[var(--karya-border)] px-2 py-0.5 rounded-md">
                          {b.booking_code}
                        </span>
                        {b.reassigned_at && (
                          <span className="rounded-md bg-[var(--karya-primary-soft)] text-[var(--karya-primary)] px-2 py-0.5 text-[11px] font-bold">
                            حجز محوّل إليكم
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 text-xs text-[var(--karya-text-muted)]">
                        <span className="font-bold text-[var(--karya-primary)]">{formattedDelivery}</span>
                        <span className="text-[var(--karya-border)]">·</span>
                        <span>{b.days} أيام</span>
                        <span className="text-[var(--karya-border)]">·</span>
                        {isMaskedPreAlert ? (
                          <span className="inline-flex items-center gap-1 text-amber-800 font-bold">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>بانتظار تأكيد التوفر</span>
                          </span>
                        ) : b.status === 'payment_verified' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>دفع مؤكد — جاهز للتسليم</span>
                          </span>
                        ) : b.status === 'car_delivered' || b.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 text-[var(--karya-primary)] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>تم تسليم السيارة</span>
                          </span>
                        ) : b.status === 'refund_requested' ? (
                          <span className="text-red-700 font-bold">طلب استرجاع</span>
                        ) : (
                          <span className="text-[var(--karya-text-muted)] font-semibold">ملغى / مسترجع</span>
                        )}
                      </div>
                    </div>

                    {/* Prominent Payout at Pickup */}
                    <div className="rounded-xl bg-[var(--karya-bg)] border border-[var(--karya-border)] px-3.5 py-2 text-right sm:text-left shrink-0">
                      <div className="text-[11px] font-semibold text-[var(--karya-text-muted)]">
                        يُحصّل عند التسليم (90%)
                      </div>
                      <div className="text-lg font-extrabold text-[var(--karya-primary)] font-mono-tabular">
                        {formatDH(b.agency_payout_amount)}
                      </div>
                    </div>
                  </div>

                  {/* Customer Info / PII Privacy Mask */}
                  {hidePii ? (
                    <div className="rounded-xl bg-amber-50/70 border border-amber-200 px-3.5 py-2.5 text-xs text-[var(--karya-text)] flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        {isMaskedPreAlert
                          ? 'بيانات العميل محجوبة مؤقتاً لحين تأكيد الإدارة لوصل تأكيد الحجز وتُكشف فور الاعتماد. يرجى تأكيد توفر السيارة الآن.'
                          : 'تم إغلاق أو إلغاء هذا الطلب ولا تظهر بيانات العميل الشخصية.'}
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[var(--karya-text-muted)] bg-[var(--karya-bg)] border border-[var(--karya-border)] rounded-xl p-3">
                      <div>
                        العميل:{' '}
                        <strong className="text-[var(--karya-primary)] text-sm">{b.customer_name}</strong>
                      </div>
                      <div>
                        الهاتف:{' '}
                        <a
                          href={`tel:${b.customer_phone}`}
                          dir="ltr"
                          className="font-mono font-extrabold text-[var(--karya-action)] hover:underline"
                        >
                          {b.customer_phone}
                        </a>
                      </div>
                      <div>
                        البطاقة الوطنية: <span className="font-mono font-semibold text-[var(--karya-primary)]">{b.customer_cin}</span>
                      </div>
                      {b.customer_license_number && (
                        <div>
                          رخصة السياقة:{' '}
                          <span className="font-mono font-semibold text-[var(--karya-primary)]">
                            {b.customer_license_number}
                          </span>
                        </div>
                      )}
                      {b.pickup_location && (
                        <div className="sm:col-span-2">
                          مكان التسليم:{' '}
                          <strong className="text-[var(--karya-primary)]">{b.pickup_location}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* DISTINCT ACTION AREA */}
                  {isMaskedPreAlert && (
                    <div className="pt-1">
                      {b.agency_ack_status === 'available' ? (
                        <div className="text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-center">
                          أكدتَ توفر السيارة — بانتظار اعتماد الإدارة لوصل العميل
                        </div>
                      ) : b.agency_ack_status === 'unavailable' ? (
                        <div className="text-xs font-extrabold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-center">
                          أبلغتَ بعدم التوفر — سيتم تحويل الطلب لوكالة أخرى
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() => handlePrecheck(b.id, 'available')}
                            className="flex-1 min-h-[46px] rounded-xl bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] disabled:opacity-60 text-white px-4 py-2.5 text-sm font-extrabold transition-colors flex items-center justify-center gap-2"
                          >
                            <Check className="w-4 h-4" />
                            <span>السيارة متوفرة</span>
                          </button>
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() => handlePrecheck(b.id, 'unavailable')}
                            className="min-h-[46px] rounded-xl border border-red-200 bg-white hover:bg-red-50 disabled:opacity-60 text-red-700 px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Ban className="w-4 h-4" />
                            <span>غير متوفرة</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {b.status === 'payment_verified' && (
                    <div className="space-y-2.5 pt-1">
                      {/* UNMISSABLE HANDOVER CAR BUTTON */}
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => handleDeliverCar(b.id)}
                        className="w-full min-h-[50px] rounded-xl bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] active:scale-[0.99] disabled:opacity-60 text-white px-5 py-3 text-sm sm:text-base font-extrabold transition-all flex items-center justify-center gap-2 shadow-xs"
                      >
                        {busyId === b.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <CarFront className="w-5 h-5" />
                        )}
                        <span>{busyId === b.id ? 'جاري التأكيد...' : 'تم تسليم السيارة'}</span>
                      </button>

                      {!b.dispute_flag && (
                        <div className="flex justify-center sm:justify-end">
                          {disputeOpenId === b.id ? (
                            <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-end w-full pt-1">
                              <button
                                type="button"
                                disabled={busyId === b.id}
                                onClick={() => handleReportIssue(b.id, 'customer_no_show')}
                                className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 text-xs font-extrabold transition-colors"
                              >
                                تغيب العميل
                              </button>
                              <button
                                type="button"
                                disabled={busyId === b.id}
                                onClick={() => handleReportIssue(b.id, 'invalid_license')}
                                className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3.5 py-2 text-xs font-bold hover:bg-red-100"
                              >
                                رخصة أقل من 3 سنوات
                              </button>
                              <button
                                type="button"
                                onClick={() => setDisputeOpenId(null)}
                                className="text-xs font-semibold text-[var(--karya-text-muted)] px-2 py-1"
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDisputeOpenId(b.id)}
                              className="text-xs font-semibold text-[var(--karya-text-muted)] hover:text-red-600 transition-colors"
                            >
                              مشكلة عند التسليم؟ (تغيب العميل / رخصة غير مطابقة)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {b.status === 'car_delivered' && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-extrabold text-emerald-800 flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>تم تسليم السيارة للعميل بنجاح</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   4. AGENCY PROFILE SETTINGS + DELETE AGENCY ACCOUNT (NO BANK FIELDS)
   ============================================================================ */
const AgencyProfileSettings: React.FC<{
  creds: StoredAgencySession;
  agency: AgencyProfile;
  onSaved: (updated: AgencyProfile, updatedPhone: string) => void;
  onPinChanged: (nextPin: string) => void;
  onDeleted: () => void;
}> = ({ creds, agency, onSaved, onPinChanged, onDeleted }) => {
  const [name, setName] = useState(agency.name);
  const [phone, setPhone] = useState(agency.phone);
  const [city, setCity] = useState(agency.city);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    agency.latitude != null && agency.longitude != null
      ? { lat: agency.latitude, lng: agency.longitude }
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [changingPin, setChangingPin] = useState(false);
  const [pinSavedMsg, setPinSavedMsg] = useState<string | null>(null);
  const [pinErrMsg, setPinErrMsg] = useState<string | null>(null);

  const [showDeleteBox, setShowDeleteBox] = useState(false);
  const [deletePin, setDeletePin] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [gpsFeedback, setGpsFeedback] = useState<string | null>(null);

  const captureGps = () => {
    if (!navigator.geolocation) {
      setGpsFeedback('المتصفح لا يدعم تحديد الموقع تلقائياً.');
      return;
    }
    setGpsFeedback('جاري تحديد الموقع...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsFeedback('تم التقاط الإحداثيات بنجاح — اضغط «حفظ التغييرات» لتأكيدها.');
      },
      () => {
        setGpsFeedback('تعذر الوصول للموقع الحالي، يمكنك الاعتماد على المدينة المختارة.');
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    setErrMsg(null);

    try {
      const { data, error } = await supabase.rpc('agency_update_profile', {
        p_agency_id: creds.agencyId,
        p_pin: creds.pin,
        p_name: name.trim(),
        p_phone: phone.trim(),
        p_city: city,
        p_lat: coords?.lat ?? null,
        p_lng: coords?.lng ?? null,
      });

      if (error) throw new Error(error.message);

      if (Array.isArray(data) && data[0]) {
        const updated = data[0] as AgencyProfile;
        setSavedMsg('تم تحديث بيانات الوكالة ومزامنتها مع السحابة بنجاح.');
        onSaved(updated, updated.phone);
      }
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'تعذر حفظ التغييرات.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteErr(null);

    if (!deletePin.trim()) {
      setDeleteErr('يرجى إدخال الرمز السري لتأكيد حذف الوكالة.');
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase.rpc('agency_delete_account', {
        p_agency_id: creds.agencyId,
        p_pin: deletePin.trim(),
      });

      if (error) throw new Error(error.message);

      onDeleted();
    } catch (err) {
      setDeleteErr(err instanceof Error ? err.message : 'تعذر حذف الوكالة.');
    } finally {
      setDeleting(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinErrMsg(null);
    setPinSavedMsg(null);

    const cleanCurrent = currentPin.trim();
    const cleanNew = newPin.trim();
    const cleanConfirm = confirmNewPin.trim();

    if (!cleanCurrent || !cleanNew) {
      setPinErrMsg('يرجى إدخال الرمز السري الحالي والجديد.');
      return;
    }
    if (cleanNew.length < 4) {
      setPinErrMsg('الرمز السري الجديد يجب أن يتكون من 4 أرقام أو رموز على الأقل.');
      return;
    }
    if (cleanNew !== cleanConfirm) {
      setPinErrMsg('تأكيد الرمز السري غير متطابق.');
      return;
    }

    setChangingPin(true);
    try {
      const { error } = await supabase.rpc('agency_change_pin', {
        p_agency_id: creds.agencyId,
        p_current_pin: cleanCurrent,
        p_new_pin: cleanNew,
      });

      if (error) throw new Error(error.message);

      onPinChanged(cleanNew);
      setCurrentPin('');
      setNewPin('');
      setConfirmNewPin('');
      setPinSavedMsg('تم تغيير الرمز السري وتحديث الجلسة بنجاح.');
    } catch (err) {
      setPinErrMsg(err instanceof Error ? err.message : 'تعذر تغيير الرمز السري.');
    } finally {
      setChangingPin(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <form
        onSubmit={handleSave}
        className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-xs p-6 space-y-4"
      >
        <h2 className="text-xl font-extrabold text-[var(--karya-primary)]">معلومات الوكالة</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1">اسم الوكالة</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] px-3.5 py-2.5 text-sm text-[var(--karya-text)] focus:border-[var(--karya-action)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1">رقم الهاتف</label>
            <input
              required
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] px-3.5 py-2.5 text-sm font-mono text-[var(--karya-text)] focus:border-[var(--karya-action)] focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1">المدينة</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] px-3 py-2.5 text-sm text-[var(--karya-text)] bg-[var(--karya-surface)] focus:border-[var(--karya-action)] focus:outline-none"
              >
                {MOROCCAN_CITIES.map((c) => (
                  <option key={c.slug} value={c.nameFr}>
                    {c.nameAr}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={captureGps}
                className="min-h-[44px] rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface-muted)] hover:bg-[var(--karya-bg)] text-[var(--karya-text)] px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Navigation className="w-4 h-4 text-[var(--karya-text-muted)]" />
                <span>{coords ? 'تحديث إحداثيات GPS' : 'تحديد موقع الوكالة GPS'}</span>
              </button>
              {gpsFeedback && (
                <p className="text-[11px] text-[var(--karya-text-muted)] mt-1">{gpsFeedback}</p>
              )}
            </div>
          </div>
        </div>

        {errMsg && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2 text-xs text-red-700">
            {errMsg}
          </div>
        )}
        {savedMsg && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs text-emerald-800">
            {savedMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] rounded-xl bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] text-white px-5 py-2.5 text-sm font-bold transition-colors"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </form>

      {/* Change Agency PIN */}
      <form
        onSubmit={handleChangePin}
        className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-xs p-6 space-y-4"
      >
        <div className="flex items-start gap-2.5">
          <KeyRound className="w-5 h-5 text-[var(--karya-primary)] shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-[var(--karya-primary)] text-base">تغيير الرمز السري (PIN)</h3>
            <p className="text-xs text-[var(--karya-text-muted)] mt-0.5">
              يمكنك تحديث الرمز السري في أي وقت، خصوصاً بعد استلام رمز مؤقت من الإدارة.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1">
              الرمز السري الحالي
            </label>
            <input
              type="password"
              required
              dir="ltr"
              placeholder="••••"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] px-3.5 py-2.5 text-sm font-mono text-[var(--karya-text)] focus:border-[var(--karya-action)] focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1">
                الرمز السري الجديد
              </label>
              <input
                type="password"
                required
                minLength={4}
                dir="ltr"
                placeholder="••••"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] px-3.5 py-2.5 text-sm font-mono text-[var(--karya-text)] focus:border-[var(--karya-action)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1">
                تأكيد الرمز الجديد
              </label>
              <input
                type="password"
                required
                minLength={4}
                dir="ltr"
                placeholder="••••"
                value={confirmNewPin}
                onChange={(e) => setConfirmNewPin(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] px-3.5 py-2.5 text-sm font-mono text-[var(--karya-text)] focus:border-[var(--karya-action)] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {pinErrMsg && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2 text-xs text-red-700">
            {pinErrMsg}
          </div>
        )}
        {pinSavedMsg && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs text-emerald-800">
            {pinSavedMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={changingPin}
          className="min-h-[44px] rounded-xl bg-[var(--karya-primary)] hover:bg-[var(--karya-primary-hover)] disabled:opacity-60 text-white px-5 py-2.5 text-sm font-bold inline-flex items-center gap-2 transition-colors"
        >
          {changingPin && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>تحديث الرمز السري</span>
        </button>
      </form>

      {/* Danger Zone: Delete Agency */}
      <div className="bg-[var(--karya-surface)] rounded-xl border border-red-200/90 p-6 space-y-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-[var(--karya-primary)] text-sm">حذف الوكالة من المنصة</h3>
            <p className="text-xs text-[var(--karya-text-muted)] mt-0.5 leading-relaxed">
              سيؤدي حذف الوكالة إلى إزالة حسابك وجميع السيارات المرتبطة به نهائياً من قاعدة البيانات السحابية. (لا يمكن الحذف إذا كانت هناك حجوزات نشطة قيد التنفيذ).
            </p>
          </div>
        </div>

        {!showDeleteBox ? (
          <button
            type="button"
            onClick={() => setShowDeleteBox(true)}
            className="min-h-[40px] rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 text-xs font-bold transition-colors inline-flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف الوكالة نهائياً</span>
          </button>
        ) : (
          <form onSubmit={handleDeleteAgency} className="space-y-3 pt-2 border-t border-red-100">
            <div>
              <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1">
                أدخل الرمز السري (PIN) لتأكيد الحذف النهائي
              </label>
              <input
                type="password"
                required
                dir="ltr"
                placeholder="••••"
                value={deletePin}
                onChange={(e) => setDeletePin(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-red-200 px-3.5 py-2 text-sm font-mono focus:border-red-500 focus:outline-none"
              />
            </div>
            {deleteErr && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {deleteErr}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={deleting}
                className="min-h-[40px] rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 text-xs font-bold flex items-center gap-1.5"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>تأكيد الحذف النهائي</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteBox(false);
                  setDeletePin('');
                  setDeleteErr(null);
                }}
                className="min-h-[40px] rounded-lg border border-[var(--karya-border)] px-4 py-2 text-xs font-semibold text-[var(--karya-text-muted)]"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
