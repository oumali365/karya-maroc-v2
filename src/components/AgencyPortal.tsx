import React, { useEffect, useMemo, useState } from 'react';
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
  HelpCircle,
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
        <Loader2 className="w-8 h-8 animate-spin text-[#0F2942]" />
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
      <div className="flex items-center gap-3 pb-3.5 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-[#0F2942] text-white font-bold flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-slate-500">بوابة الوكالات</p>
          <p className="font-extrabold text-[#0F2942] truncate">{agency.name}</p>
        </div>
      </div>

      <nav className="space-y-1">
        <button
          type="button"
          onClick={() => selectView('dashboard')}
          className={`w-full text-right px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2.5 transition-colors ${
            view === 'dashboard'
              ? 'bg-[#0F2942] text-white'
              : 'text-slate-600 hover:bg-slate-100/80 hover:text-[#0F2942]'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>الرئيسية</span>
        </button>

        <button
          type="button"
          onClick={() => selectView('cars')}
          className={`w-full text-right px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2.5 transition-colors ${
            view === 'cars'
              ? 'bg-[#0F2942] text-white'
              : 'text-slate-600 hover:bg-slate-100/80 hover:text-[#0F2942]'
          }`}
        >
          <CarFront className="w-4 h-4" />
          <span>أسطول السيارات ({cars.length})</span>
        </button>

        <button
          type="button"
          onClick={() => selectView('bookings')}
          className={`w-full text-right px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors ${
            view === 'bookings'
              ? 'bg-[#0F2942] text-white'
              : 'text-slate-600 hover:bg-slate-100/80 hover:text-[#0F2942]'
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
                  ? 'bg-[#0D9488] text-white'
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
          className={`w-full text-right px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2.5 transition-colors ${
            view === 'profile'
              ? 'bg-[#0F2942] text-white'
              : 'text-slate-600 hover:bg-slate-100/80 hover:text-[#0F2942]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>معلومات الوكالة</span>
        </button>
      </nav>

      <div className="pt-3 border-t border-slate-100 space-y-1">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full text-right px-3.5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2"
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
      {/* Screen 6: Clean Top Header with Hamburger Trigger, Agency Name & Notification Bell */}
      <header className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="فتح قائمة الوكالة"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#0F2942] text-white flex items-center justify-center shrink-0 hover:bg-[#173B5E] transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500">
              {view === 'dashboard' && 'بوابة الوكالات · الرئيسية'}
              {view === 'cars' && `أسطول السيارات (${cars.length})`}
              {view === 'bookings' && `الطلبات والحجوزات (${bookings.length})`}
              {view === 'profile' && 'إعدادات الوكالة'}
            </div>
            <div className="text-base font-extrabold text-[#0F2942] truncate">{agency.name}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => refreshAgencyData(sessionCreds)}
            aria-label="تحديث البيانات"
            className="min-h-[42px] min-w-[42px] rounded-xl border border-slate-200 bg-[#F4F6F9] hover:bg-slate-200/70 text-[#0F2942] flex items-center justify-center transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => selectView('bookings')}
            aria-label="تنبيهات الحجوزات"
            className="relative min-h-[42px] min-w-[42px] rounded-xl border border-slate-200 bg-[#F4F6F9] hover:bg-slate-200/70 text-[#0F2942] flex items-center justify-center transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1 rounded-full bg-[#0D9488] text-white text-[10px] font-extrabold flex items-center justify-center font-mono-tabular shadow-sm">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Collapsible Sidebar Drawer (all viewports, zero permanent wasted space) */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0F2942]/55 backdrop-blur-xs flex"
          onClick={() => setMobileMenuOpen(false)}
          dir="rtl"
        >
          <aside
            className="w-76 max-w-[85vw] h-full bg-white shadow-2xl p-5 flex flex-col gap-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">قائمة إدارة الوكالة</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="إغلاق القائمة"
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100"
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
            <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F2942]">
                  مرحباً، {agency.name}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1 font-semibold text-[#0F2942]">
                    <MapPin className="w-4 h-4 text-[#0D9488]" />
                    <span>{getCityLabelAr(agency.city)}</span>
                  </span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-bold text-[#0D9488]">
                    <ShieldCheck className="w-4 h-4" />
                    <span>ضمان 0 DH (بدون كفالة)</span>
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-[#F4F6F9] px-4 py-3 shrink-0">
                <div className="text-[11px] font-semibold text-slate-500">
                  يُستخلص عند التسليم (90%)
                </div>
                <div className="text-xl font-extrabold text-[#0F2942] font-mono-tabular">
                  {formatDH(totalPayoutExpected)}
                </div>
              </div>
            </section>

            {/* Dashboard Stats Grid (2 Modern Stat Cards) */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label="إحصائيات الوكالة">
              {/* Card 1: Confirmed Bookings Today (Soft Blue) */}
              <div className="rounded-2xl bg-blue-50/90 border border-blue-200/75 p-5 shadow-xs flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-bold text-[#0F2942]/80">
                    الحجوزات المؤكدة اليوم
                  </p>
                  <p className="text-3xl sm:text-4xl font-extrabold text-[#0F2942] font-mono-tabular leading-none pt-1">
                    {todayConfirmedCount}
                  </p>
                  <p className="text-xs font-semibold text-blue-800/80 pt-1">
                    جاهز للتسليم الآن: <span className="font-mono-tabular">{verifiedBookings.length}</span>
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white text-[#0F2942] shadow-xs flex items-center justify-center shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
              </div>

              {/* Card 2: Available Cars (Soft Green/Teal) */}
              <div className="rounded-2xl bg-teal-50/90 border border-teal-200/75 p-5 shadow-xs flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-bold text-[#0F2942]/80">
                    السيارات المتاحة
                  </p>
                  <p className="text-3xl sm:text-4xl font-extrabold text-[#0F766E] font-mono-tabular leading-none pt-1" dir="ltr">
                    {availableCarsCount} / {cars.length}
                  </p>
                  <p className="text-xs font-semibold text-[#0F766E]/80 pt-1">
                    نشطة وظاهرة للعملاء في {getCityLabelAr(agency.city)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white text-[#0D9488] shadow-xs flex items-center justify-center shrink-0">
                  <CarFront className="w-6 h-6" />
                </div>
              </div>
            </section>

            {/* Full-Width Primary Button for Manage Fleet */}
            <button
              type="button"
              onClick={() => selectView('cars')}
              className="w-full min-h-[52px] rounded-2xl bg-[#0D9488] hover:bg-[#0F766E] active:scale-[0.99] text-white px-6 py-3.5 text-sm sm:text-base font-extrabold transition-all flex items-center justify-center gap-2 shadow-md shadow-teal-600/20"
            >
              <CarFront className="w-5 h-5" />
              <span>إدارة الأسطول</span>
            </button>

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
    q: 'هل «بدون ضمان (0 DH)» تعني تسليم السيارة بدون عقد أو وثائق؟',
    a: 'لا، «بدون ضمان» تعني فقط عدم تجميد شيك أو مبلغ كفالة مالي، بينما توقّع وكالتك عقد الكراء الرسمي المعتاد وتتحقق من البطاقة الوطنية ورخصة السياقة ذات أقدمية سنتين على الأقل قبل تسليم المفاتيح.',
  },
  {
    q: 'كيف أضمن جدية الزبون ومتى أستلم مستحقاتي؟',
    a: 'كل طلب يصلك يكون الزبون قد دفع عنه 10% تسبيق جدية وتم التحقق من وصله البنكي، والحد الأدنى لأي كراء هو 3 أيام. كما تقبض 90% المتبقية مباشرة من الزبون عند التسليم دون انتظار أي تحويلات مؤجلة.',
  },
  {
    q: 'ماذا يحدث إذا تخلف الزبون عن الحضور أو كانت رخصته أقل من سنتين؟',
    a: 'تحميك المنصة عبر زر «تسجيل مخالفة» في لوحة الحجوزات؛ وعند تسجيل عدم التزام الزبون بشروط الرخصة أو عدم الحضور، يتم حفظ حق وكالتك ومنع الاسترجاع التلقائي غير المستحق.',
  },
  {
    q: 'هل يمكنني تعديل السعر اليومي لتغطية التأمين الشامل وتعويض غياب الكفالة؟',
    a: 'نعم، لديك حرية كاملة في التسعير دون سقف وفي أي وقت. وننصح الوكالات بإضافة هامش 15% إلى 20% لتغطية التأمين، حيث يفضّل الزبون دفع فرق يومي بسيط على تجميد مبلغ كفالة كبير.',
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
        setError(
          'يجب الموافقة على الإقرار الإلزامي (بدون ضمان + عمولة 10% للمنصة) لإتمام تسجيل الوكالة.',
        );
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
    <div className="max-w-lg mx-auto px-4 py-10 space-y-6" dir="rtl">
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/90 shadow-sm space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-slate-900">
            {mode === 'login' ? 'دخول وكالات كراء السيارات' : 'تسجيل وكالة جديدة'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {mode === 'login'
              ? 'ادخل برقم الهاتف والرمز السري لإدارة أسطولك والأسعار'
              : 'سجّل وكالتك في خطوة واحدة بدون بريد إلكتروني أو حساب بنكي'}
          </p>
        </div>

        {/* Mode switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 text-xs font-bold rounded-lg transition-colors ${
              mode === 'login' ? 'bg-white text-[#0F2942] shadow-sm' : 'text-slate-600'
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
            className={`py-2 text-xs font-bold rounded-lg transition-colors ${
              mode === 'register' ? 'bg-white text-[#0F2942] shadow-sm' : 'text-slate-600'
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
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                اسم الوكالة / الشركة
              </label>
              <input
                type="text"
                required
                placeholder="مثال: أطلس كار الدار البيضاء"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-[#0D9488] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              رقم الهاتف
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="tel"
                required
                dir="ltr"
                placeholder="0612345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 pr-9 pl-3.5 py-2.5 text-sm font-mono focus:border-[#0D9488] focus:outline-none"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  المدينة
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:border-[#0D9488] focus:outline-none"
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
                  className={`min-h-[44px] rounded-xl border px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    coords
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <Navigation className="w-4 h-4" />
                  <span>{coords ? 'تم حفظ موقع الوكالة' : 'تحديد موقع GPS (اختياري)'}</span>
                </button>
                {gpsNote && (
                  <p className="text-[11px] text-slate-500 mt-1 text-center">{gpsNote}</p>
                )}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                الرمز السري (PIN)
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setShowForgotPin((v) => !v)}
                  className="text-xs font-semibold text-[#0F2942] hover:underline"
                >
                  نسيت الرمز السري؟
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPin ? 'text' : 'password'}
                required
                minLength={4}
                dir="ltr"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 pr-9 pl-10 py-2.5 text-sm font-mono focus:border-[#0D9488] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                aria-label={showPin ? 'إخفاء الرمز السري' : 'إظهار الرمز السري'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {mode === 'login' && showForgotPin && (
              <div className="mt-2.5 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-slate-700 space-y-1 leading-relaxed">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#0F2942]" />
                  <span>استرجاع حساب الوكالة برقم الهاتف</span>
                </div>
                <p>
                  بما أن التسجيل يعتمد على رقم الهاتف دون بريد إلكتروني، تواصل مع إدارة المنصة عبر الرقم المسجل لتزويدك برمز سري مؤقت بعد التحقق من هويتك، ثم قم بتغييره من قسم «الإعدادات» فور دخولك.
                </p>
              </div>
            )}
          </div>

          {mode === 'register' && (
            <label className="flex items-start gap-3 rounded-xl border border-blue-200/80 bg-blue-50/50 p-3.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-slate-300 text-[#0F2942] focus:ring-[#0D9488] shrink-0"
              />
              <span className="text-xs text-slate-800 leading-relaxed space-y-1 block">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0F2942]" />
                  الإقرار الإلزامي للانضمام إلى المنصة:
                </span>
                <span className="block">
                  1. أتعهد بتسليم سياراتي المسجلة في المنصة <strong>بدون أي ضمان أو كفالة مالية (0 DH)</strong> مع احترام الحد الأدنى للكراء (3 أيام) وأقدمية الرخصة (سنتان).
                </span>
                <span className="block">
                  2. أوافق على احتساب <strong>عمولة المنصة بنسبة 10%</strong> من إجمالي مبلغ الحجز تُدفع كتسبيق عبر المنصة، واستلام <strong>90% المتبقية مباشرة من العميل</strong> عند التسليم.
                </span>
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] rounded-xl bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-65 text-white py-3 font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{mode === 'login' ? 'تسجيل الدخول' : 'تسجيل الوكالة والدخول مباشرة'}</span>
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onGoToCustomer}
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            العودة لواجهة العملاء
          </button>
        </div>
      </div>

      {/* Agency Partner FAQ Section */}
      <section
        aria-label="الأسئلة الشائعة للوكالات"
        className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
      >
        {/* Refined Header Band */}
        <div className="bg-gradient-to-l from-[#0F2942] to-[#173B5E] px-5 py-4 sm:px-6 sm:py-5 flex items-center gap-3.5 text-white">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 text-[#2DD4BF] flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-sm sm:text-base font-extrabold tracking-tight">
              أسئلة شائعة تهمّ الوكالات الشريكة
            </h3>
            <p className="text-xs text-slate-200">
              كل ما يضمن حقوق وكالتك ويزيد أرباحك عبر Karya
            </p>
          </div>
        </div>

        {/* Interactive Numbered FAQ Cards */}
        <div className="p-4 sm:p-5 space-y-2.5">
          {AGENCY_FAQS.map((item, idx) => {
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
                  className="w-full flex items-center justify-between gap-3 text-right p-3.5"
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
                  <div className="px-4 pb-3.5 sm:pr-14 sm:pl-5">
                    <p className="text-xs text-slate-600 leading-relaxed">
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
  onRefresh: () => void;
}> = ({ creds, catalog, cars, onRefresh }) => {
  const [showAddForm, setShowAddForm] = useState(false);

  const brands = useMemo(
    () => Array.from(new Set(catalog.map((c) => c.brand))).sort(),
    [catalog],
  );
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<CatalogCar | null>(
    () => catalog[0] || null,
  );

  const [fuelType, setFuelType] = useState<FuelType>(catalog[0]?.default_fuel || 'diesel');
  const [transmission, setTransmission] = useState<TransmissionType>(
    catalog[0]?.default_transmission || 'manual',
  );
  const [modelYear, setModelYear] = useState<number>(2025);
  const [color, setColor] = useState<string>('');
  const [dailyPrice, setDailyPrice] = useState<number>(280);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Inline editing & delete state
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<number>(280);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyCarId, setBusyCarId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredCatalog = useMemo(() => {
    if (selectedBrand === 'all') return catalog;
    return catalog.filter((c) => c.brand === selectedBrand);
  }, [catalog, selectedBrand]);

  const handleSelectCatalogModel = (item: CatalogCar) => {
    setSelectedModel(item);
    setFuelType(item.default_fuel);
    setTransmission(item.default_transmission);
  };

  const handleAddCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModel) {
      setErrMsg('يرجى اختيار موديل من الكتالوج المركزي أولاً.');
      return;
    }
    if (!dailyPrice || dailyPrice <= 0) {
      setErrMsg('يرجى إدخال السعر اليومي بالدرهم.');
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
        p_daily_price: dailyPrice,
        p_model_year: modelYear || 2025,
        p_seats: selectedModel.seats || 5,
        p_color: color.trim() || null,
      });

      if (error) throw new Error(error.message);

      setShowAddForm(false);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">أسطول السيارات الاقتصادية</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            اختر سياراتك من الكتالوج المركزي وحدد السعر اليومي بحرية (بدون ضمان · 0 DH كفالة)
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!selectedModel && catalog.length > 0) handleSelectCatalogModel(catalog[0]);
            setShowAddForm(!showAddForm);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white px-4 py-2.5 text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة سيارة من الكتالوج</span>
        </button>
      </div>

      {actionError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs sm:text-sm text-red-700">
          {actionError}
        </div>
      )}

      {showAddForm && (
        <form
          onSubmit={handleAddCar}
          className="bg-white rounded-2xl border border-blue-200 p-5 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900">1. اختر الموديل من الكتالوج المركزي</h3>
              <p className="text-xs text-slate-500">
                تظهر صور موحدة وعالية الجودة لجميع السيارات الاقتصادية
              </p>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1">
              <button
                type="button"
                onClick={() => setSelectedBrand('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                  selectedBrand === 'all'
                    ? 'bg-[#0F2942] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                الكل
              </button>
              {brands.map((brand) => (
                <button
                  key={brand}
                  type="button"
                  onClick={() => setSelectedBrand(brand)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                    selectedBrand === brand
                      ? 'bg-[#0F2942] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-72 overflow-y-auto p-1">
            {filteredCatalog.map((item) => {
              const active = selectedModel?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectCatalogModel(item)}
                  className={`text-right rounded-xl border overflow-hidden transition-all flex flex-col ${
                    active
                      ? 'border-[#0D9488] ring-2 ring-[#0D9488]/25 bg-teal-50/40'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="aspect-[16/10] bg-slate-100 w-full overflow-hidden">
                    <img
                      src={item.image_url}
                      alt={`${item.brand} ${item.model}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2.5">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {item.brand} {item.model}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{item.category}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedModel && (
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-900">
                  2. مواصفات وسعر: {selectedModel.brand} {selectedModel.model}
                </h4>
                <span className="text-xs font-bold text-emerald-700">
                  الضمان: 0 DH (بدون كفالة)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    السعر اليومي (DH)
                  </label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={dailyPrice}
                    onChange={(e) => setDailyPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    سنة الصنع
                  </label>
                  <input
                    type="number"
                    min={2015}
                    max={2027}
                    value={modelYear}
                    onChange={(e) => setModelYear(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    الوقود
                  </label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value as FuelType)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  >
                    <option value="diesel">ديزل (Diesel)</option>
                    <option value="essence">بنزين (Essence)</option>
                    <option value="hybrid">هجين (Hybrid)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ناقل الحركة
                  </label>
                  <select
                    value={transmission}
                    onChange={(e) => setTransmission(e.target.value as TransmissionType)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  >
                    <option value="manual">يدوي (Manuelle)</option>
                    <option value="automatic">أوتوماتيك (Auto)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    اللون (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="أبيض، رمادي..."
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Smart Pricing Hint & Live 90% Net Handover Calculator */}
              <div className="rounded-xl bg-[#F4F6F9] border border-slate-200/80 p-3.5 sm:p-4 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      صافي ما تقبضه يومياً عند التسليم (90%)
                    </div>
                    <div className="text-base sm:text-lg font-extrabold text-[#0D9488] font-mono-tabular mt-0.5">
                      {formatDH(Math.max(0, dailyPrice || 0) * 0.9)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      صافي أقل حجز (3 أيام — 90%)
                    </div>
                    <div className="text-base sm:text-lg font-extrabold text-[#0F2942] font-mono-tabular mt-0.5">
                      {formatDH(Math.max(0, dailyPrice || 0) * 3 * 0.9)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      تسبيق الجدية للمنصة (3 أيام — 10%)
                    </div>
                    <div className="text-sm font-bold text-slate-700 font-mono-tabular mt-0.5">
                      {formatDH(Math.max(0, dailyPrice || 0) * 3 * 0.1)}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2 pt-2 border-t border-slate-200/70 text-xs text-slate-600 leading-relaxed">
                  <TrendingUp className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
                  <span>
                    <strong>نصيحة تسعير بدون ضمان:</strong> العملاء المعفيون من تجميد الكفالة يتقبلون زيادة{' '}
                    <strong className="text-[#0F2942]">15% إلى 20%</strong> في السعر اليومي لتغطية التأمين — حدد سعرك بحرية لتحصيل صافي الربح المناسب لك عند التسليم.
                  </span>
                </div>
              </div>
            </div>
          )}

          {errMsg && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {errMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving || !selectedModel}
              className="rounded-xl bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-60 text-white px-5 py-2.5 text-sm font-bold flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>نشر السيارة في أسطولي</span>
            </button>
          </div>
        </form>
      )}

      {cars.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center space-y-3">
          <CarFront className="w-9 h-9 text-slate-400 mx-auto" />
          <p className="font-bold text-slate-800">لم تقم بإضافة أي سيارة بعد</p>
          <p className="text-xs text-slate-500">
            اختر موديل سياراتك من الكتالوج المركزي وحدد سعرك اليومي لتظهر للعملاء.
          </p>
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white px-4 py-2 text-xs font-bold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة سيارة الآن</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cars.map((car) => {
            const isEditingPrice = editingPriceId === car.id;
            const isDeleting = confirmDeleteId === car.id;
            const isBusy = busyCarId === car.id;

            return (
              <div
                key={car.id}
                className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden flex flex-col"
              >
                <div className="aspect-[4/3] bg-slate-100 relative">
                  <img
                    src={car.primary_image_url}
                    alt={`${car.brand} ${car.model}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-900 truncate">
                        {car.brand} {car.model} {car.model_year ? `(${car.model_year})` : ''}
                      </h3>
                      <span
                        className={`text-xs font-bold shrink-0 ${
                          car.status === 'available' ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {car.status === 'available' ? 'متاح' : 'غير متاح'}
                      </span>
                    </div>

                    {isEditingPrice ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            value={priceDraft}
                            onChange={(e) => setPriceDraft(Number(e.target.value))}
                            className="w-28 rounded-lg border border-[#0D9488] px-2.5 py-1 text-sm font-mono-tabular focus:outline-none"
                          />
                          <span className="text-xs text-slate-500">DH</span>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleSavePrice(car.id)}
                            className="p-1.5 rounded-lg bg-[#0D9488] text-white hover:bg-[#0F766E]"
                            aria-label="حفظ السعر"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPriceId(null)}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                            aria-label="إلغاء"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-[11px] font-semibold text-[#0D9488] font-mono-tabular">
                          صافي التسليم (90%): {formatDH(Math.max(0, priceDraft || 0) * 0.9)} / يوم
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <div className="font-mono-tabular font-bold text-sm text-[#0F2942]">
                            {formatDH(car.daily_price)} / يوم
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPriceId(car.id);
                              setPriceDraft(car.daily_price);
                            }}
                            className="text-xs font-semibold text-slate-600 hover:text-[#0F2942] inline-flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>تعديل السعر</span>
                          </button>
                        </div>
                        <div className="text-[11px] font-semibold text-[#0D9488] font-mono-tabular">
                          صافي التسليم (90%): {formatDH(car.daily_price * 0.9)} / يوم
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => toggleStatus(car)}
                      className={`w-full rounded-xl py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors ${
                        car.status === 'available'
                          ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
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
                          className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white py-1.5 text-xs font-bold"
                        >
                          تأكيد الحذف
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(car.id)}
                        className="w-full rounded-xl py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center justify-center gap-1 transition-colors"
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
        ? 'رخصة سياقة أقل من سنتين أو بيانات غير مطابقة عند التسليم'
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
          <h2 className="text-lg sm:text-xl font-extrabold text-[#0F2942]">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تُحجب بيانات العميل أثناء مراجعة الوصل وتُكشف فور تأكيد الدفع · تحصّل 90% عند التسليم (بدون ضمان)
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="self-start sm:self-auto rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#0F2942] px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
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
                  ? 'bg-[#0F2942] text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-[#0F2942]'
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
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-10 text-center text-sm text-slate-500">
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
                className={`bg-white rounded-2xl overflow-hidden transition-all ${
                  hasUrgentAlert
                    ? 'border-2 border-red-500 shadow-md shadow-red-500/10'
                    : isMaskedPreAlert
                      ? 'border-2 border-amber-300 shadow-sm'
                      : 'border border-slate-200/90 shadow-sm hover:border-[#0F2942]/30'
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
                            ? 'تنبيه عاجل: رخصة العميل غير مطابقة (أقل من سنتين)'
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
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base sm:text-lg font-extrabold text-[#0F2942]">
                          {b.car_brand} {b.car_model}
                        </h3>
                        <span className="font-mono-tabular text-xs font-bold text-slate-500 bg-[#F4F6F9] px-2 py-0.5 rounded-md">
                          {b.booking_code}
                        </span>
                        {b.reassigned_at && (
                          <span className="rounded-md bg-[#0F2942]/10 text-[#0F2942] px-2 py-0.5 text-[11px] font-bold">
                            حجز محوّل إليكم
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
                        <span className="font-bold text-[#0F2942]">{formattedDelivery}</span>
                        <span className="text-slate-300">·</span>
                        <span>{b.days} أيام</span>
                        <span className="text-slate-300">·</span>
                        {isMaskedPreAlert ? (
                          <span className="inline-flex items-center gap-1 text-amber-800 font-bold">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>بانتظار تأكيد التوفر</span>
                          </span>
                        ) : b.status === 'payment_verified' ? (
                          <span className="inline-flex items-center gap-1 text-[#0D9488] font-extrabold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>دفع مؤكد — جاهز للتسليم</span>
                          </span>
                        ) : b.status === 'car_delivered' || b.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 text-[#0F2942] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#0D9488]" />
                            <span>تم تسليم السيارة</span>
                          </span>
                        ) : b.status === 'refund_requested' ? (
                          <span className="text-red-700 font-bold">طلب استرجاع</span>
                        ) : (
                          <span className="text-slate-500 font-semibold">ملغى / مسترجع</span>
                        )}
                      </div>
                    </div>

                    {/* Prominent Payout at Pickup */}
                    <div className="rounded-xl bg-[#F4F6F9] px-3.5 py-2 text-right sm:text-left shrink-0">
                      <div className="text-[11px] font-semibold text-slate-500">
                        يُحصّل عند التسليم (90%)
                      </div>
                      <div className="text-lg font-extrabold text-[#0F2942] font-mono-tabular">
                        {formatDH(b.agency_payout_amount)}
                      </div>
                    </div>
                  </div>

                  {/* Customer Info / PII Privacy Mask */}
                  {hidePii ? (
                    <div className="rounded-xl bg-amber-50/60 border border-amber-200/80 px-3.5 py-2.5 text-xs text-slate-700 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        {isMaskedPreAlert
                          ? 'بيانات العميل محجوبة مؤقتاً لحماية العمولة وتُكشف فور تأكيد الإدارة لوصل التسبيق. يرجى تأكيد توفر السيارة الآن.'
                          : 'تم إغلاق أو إلغاء هذا الطلب ولا تظهر بيانات العميل الشخصية.'}
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 bg-[#F4F6F9] rounded-xl p-3">
                      <div>
                        العميل:{' '}
                        <strong className="text-[#0F2942] text-sm">{b.customer_name}</strong>
                      </div>
                      <div>
                        الهاتف:{' '}
                        <a
                          href={`tel:${b.customer_phone}`}
                          dir="ltr"
                          className="font-mono font-extrabold text-[#0D9488] hover:underline"
                        >
                          {b.customer_phone}
                        </a>
                      </div>
                      <div>
                        البطاقة الوطنية: <span className="font-mono font-semibold text-[#0F2942]">{b.customer_cin}</span>
                      </div>
                      {b.customer_license_number && (
                        <div>
                          رخصة السياقة:{' '}
                          <span className="font-mono font-semibold text-[#0F2942]">
                            {b.customer_license_number}
                          </span>
                        </div>
                      )}
                      {b.pickup_location && (
                        <div className="sm:col-span-2">
                          مكان التسليم:{' '}
                          <strong className="text-[#0F2942]">{b.pickup_location}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* DISTINCT ACTION AREA */}
                  {isMaskedPreAlert && (
                    <div className="pt-1">
                      {b.agency_ack_status === 'available' ? (
                        <div className="text-xs font-extrabold text-[#0F766E] bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 text-center">
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
                            className="flex-1 min-h-[46px] rounded-xl bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-60 text-white px-4 py-2.5 text-sm font-extrabold transition-colors flex items-center justify-center gap-2 shadow-sm shadow-teal-600/20"
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
                        className="w-full min-h-[50px] rounded-xl bg-[#0D9488] hover:bg-[#0F766E] active:scale-[0.99] disabled:opacity-60 text-white px-5 py-3 text-sm sm:text-base font-extrabold transition-all flex items-center justify-center gap-2 shadow-md shadow-teal-600/25"
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
                                className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 text-xs font-extrabold transition-colors"
                              >
                                تغيب العميل
                              </button>
                              <button
                                type="button"
                                disabled={busyId === b.id}
                                onClick={() => handleReportIssue(b.id, 'invalid_license')}
                                className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-3.5 py-2 text-xs font-bold hover:bg-red-100"
                              >
                                رخصة أقل من سنتين
                              </button>
                              <button
                                type="button"
                                onClick={() => setDisputeOpenId(null)}
                                className="text-xs font-semibold text-slate-500 px-2 py-1"
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDisputeOpenId(b.id)}
                              className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors"
                            >
                              مشكلة عند التسليم؟ (تغيب العميل / رخصة غير مطابقة)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {b.status === 'car_delivered' && (
                    <div className="rounded-xl bg-teal-50/70 border border-teal-200 px-4 py-2.5 text-xs font-extrabold text-[#0F766E] flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#0D9488]" />
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
        className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-4"
      >
        <h2 className="text-xl font-bold text-slate-900">معلومات الوكالة</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">اسم الوكالة</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">رقم الهاتف</label>
            <input
              required
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">المدينة</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white"
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
                className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Navigation className="w-4 h-4" />
                <span>{coords ? 'تحديث إحداثيات GPS' : 'تحديد موقع الوكالة GPS'}</span>
              </button>
              {gpsFeedback && (
                <p className="text-[11px] text-slate-500 mt-1">{gpsFeedback}</p>
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
          className="rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white px-5 py-2.5 text-sm font-bold"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </form>

      {/* Change Agency PIN */}
      <form
        onSubmit={handleChangePin}
        className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-4"
      >
        <div className="flex items-start gap-2.5">
          <KeyRound className="w-5 h-5 text-[#0F2942] shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-slate-900 text-base">تغيير الرمز السري (PIN)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              يمكنك تحديث الرمز السري في أي وقت، خصوصاً بعد استلام رمز مؤقت من الإدارة.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              الرمز السري الحالي
            </label>
            <input
              type="password"
              required
              dir="ltr"
              placeholder="••••"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono focus:border-[#0D9488] focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono focus:border-[#0D9488] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono focus:border-[#0D9488] focus:outline-none"
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
          className="rounded-xl border border-slate-200 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white px-5 py-2.5 text-sm font-bold inline-flex items-center gap-2"
        >
          {changingPin && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>تحديث الرمز السري</span>
        </button>
      </form>

      {/* Danger Zone: Delete Agency */}
      <div className="bg-white rounded-2xl border border-red-200/90 p-6 space-y-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-slate-900 text-sm">حذف الوكالة من المنصة</h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              سيؤدي حذف الوكالة إلى إزالة حسابك وجميع السيارات المرتبطة به نهائياً من قاعدة البيانات السحابية. (لا يمكن الحذف إذا كانت هناك حجوزات نشطة قيد التنفيذ).
            </p>
          </div>
        </div>

        {!showDeleteBox ? (
          <button
            type="button"
            onClick={() => setShowDeleteBox(true)}
            className="rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 text-xs font-bold transition-colors inline-flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف الوكالة نهائياً</span>
          </button>
        ) : (
          <form onSubmit={handleDeleteAgency} className="space-y-3 pt-2 border-t border-red-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                أدخل الرمز السري (PIN) لتأكيد الحذف النهائي
              </label>
              <input
                type="password"
                required
                dir="ltr"
                placeholder="••••"
                value={deletePin}
                onChange={(e) => setDeletePin(e.target.value)}
                className="w-full rounded-xl border border-red-200 px-3.5 py-2 text-sm font-mono focus:border-red-500 focus:outline-none"
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
                className="rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 text-xs font-bold flex items-center gap-1.5"
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
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
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
