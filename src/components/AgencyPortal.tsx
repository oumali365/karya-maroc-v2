import React, { useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  Building2,
  CarFront,
  CalendarCheck2,
  Landmark,
  LogOut,
  Plus,
  Upload,
  Navigation,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  Home,
} from 'lucide-react';
import { supabase, MOROCCAN_CITIES, formatDH, getCityLabelAr } from '../lib/supabase';
import { compressImageFile, formatFileSize } from '../lib/imageCompression';
import { DEFAULT_CAR_IMAGE_URL, STARTER_IMAGE_TEMPLATES } from '../data/starterData';
import type {
  AgencyBookingRecord,
  AgencyProfile,
  CarOffer,
  FuelType,
  TransmissionType,
} from '../types/karya';

interface AgencyPortalProps {
  onGoToCustomer: () => void;
}

export const AgencyPortal: React.FC<AgencyPortalProps> = ({ onGoToCustomer }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [agency, setAgency] = useState<AgencyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'cars' | 'bookings' | 'profile'>('dashboard');

  const [cars, setCars] = useState<CarOffer[]>([]);
  const [bookings, setBookings] = useState<AgencyBookingRecord[]>([]);
  const [schemaWarning, setSchemaWarning] = useState<string | null>(null);

  const loadAgencyData = async (userId: string) => {
    setLoading(true);
    setSchemaWarning(null);
    try {
      const { data: agencyRow, error } = await supabase
        .from('agencies')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle();

      if (error) {
        if (error.message.includes('relation') || error.message.includes('schema cache')) {
          setSchemaWarning(
            'لم يتم إنشاء جداول قاعدة البيانات في Supabase بعد. يرجى تشغيل ملف supabase/schema.sql في SQL Editor أولاً.',
          );
        }
        setAgency(null);
        setLoading(false);
        return;
      }

      if (agencyRow) {
        setAgency(agencyRow as AgencyProfile);
        await Promise.all([fetchCars(agencyRow.id), fetchBookings(agencyRow.id)]);
      } else {
        setAgency(null);
      }
    } catch {
      setAgency(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchCars = async (agencyId: string) => {
    const { data, error } = await supabase
      .from('agency_cars')
      .select('*, car_catalog(*)')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mapped: CarOffer[] = data.map((row: Record<string, any>) => ({
        id: String(row.id),
        agency_id: String(row.agency_id),
        agency_name: agency?.name || '',
        agency_rating: 5,
        agency_rating_count: 0,
        brand: String(row.brand || row.car_catalog?.brand || 'سيارة'),
        model: String(row.model || row.car_catalog?.model || ''),
        model_year: row.model_year ? Number(row.model_year) : null,
        fuel_type: (row.fuel_type as FuelType) || 'diesel',
        transmission: (row.transmission as TransmissionType) || 'manual',
        seats: Number(row.seats ?? 5),
        primary_image_url: String(
          row.primary_image_url ||
            row.car_catalog?.image_url ||
            DEFAULT_CAR_IMAGE_URL,
        ),
        gallery_images: Array.isArray(row.gallery_images) ? row.gallery_images : [],
        daily_price: Number(row.daily_price),
        deposit_amount: Number(row.deposit_amount ?? 0),
        city: String(row.city),
        status: row.status === 'unavailable' ? 'unavailable' : 'available',
        distance_km: null,
      }));
      setCars(mapped);
    }
  };

  const fetchBookings = async (agencyId: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, agency_cars(brand, model, primary_image_url)')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (!error && data) {
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
        car_brand: row.agency_cars?.brand,
        car_model: row.agency_cars?.model,
        car_image: row.agency_cars?.primary_image_url,
      }));
      setBookings(mapped);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession) {
        loadAgencyData(currentSession.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        loadAgencyData(nextSession.user.id);
      } else {
        setAgency(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[65vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (!session) {
    return <AgencyAuthView onGoToCustomer={onGoToCustomer} />;
  }

  if (!agency) {
    return (
      <AgencyOnboardingView
        user={session.user}
        schemaWarning={schemaWarning}
        onComplete={() => loadAgencyData(session.user.id)}
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

  const verifiedBookings = bookings.filter((b) => b.status === 'payment_verified');
  const todayConfirmedCount = bookings.filter(
    (b) =>
      ['payment_verified', 'car_delivered', 'completed'].includes(b.status) &&
      (isSameDay(b.delivery_at) || isSameDay(b.created_at)),
  ).length;
  const availableCarsCount = cars.filter((c) => c.status === 'available').length;
  const totalPayoutExpected = bookings
    .filter((b) => ['payment_verified', 'car_delivered', 'completed'].includes(b.status))
    .reduce((sum, b) => sum + b.agency_payout_amount, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-6" dir="rtl">
      {/* Sidebar matching sent HTML layout & colors */}
      <aside className="w-full lg:w-64 shrink-0 bg-white rounded-2xl border border-slate-200/90 p-4 flex flex-col gap-4 self-start">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white font-bold flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">بوابة الوكالات</p>
            <p className="font-bold text-slate-900 truncate">{agency.name}</p>
          </div>
        </div>

        <nav className="space-y-1">
          <button
            type="button"
            onClick={() => setView('dashboard')}
            className={`w-full text-right px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 transition-colors ${
              view === 'dashboard'
                ? 'bg-blue-50 text-[#2563EB]'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>الرئيسية</span>
          </button>

          <button
            type="button"
            onClick={() => setView('cars')}
            className={`w-full text-right px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 transition-colors ${
              view === 'cars'
                ? 'bg-blue-50 text-[#2563EB]'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <CarFront className="w-4 h-4" />
            <span>أسطول السيارات ({cars.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setView('bookings')}
            className={`w-full text-right px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 transition-colors ${
              view === 'bookings'
                ? 'bg-blue-50 text-[#2563EB]'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <CalendarCheck2 className="w-4 h-4" />
            <span>الحجوزات ({bookings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setView('profile')}
            className={`w-full text-right px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 transition-colors ${
              view === 'profile'
                ? 'bg-blue-50 text-[#2563EB]'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Landmark className="w-4 h-4" />
            <span>معلومات الشركة والبنك</span>
          </button>
        </nav>

        <div className="pt-3 border-t border-slate-100 space-y-1">
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="w-full text-right px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 space-y-6">
        {agency.verification_status === 'pending' && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            حساب وكالتك قيد المراجعة من طرف الإدارة. يمكنك إضافة سياراتك الآن، وستظهر للعملاء فور التفعيل.
          </div>
        )}

        {view === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-slate-400 mb-0.5">بوابة الوكالات / الرئيسية</div>
                <h1 className="text-2xl font-bold text-slate-900">مرحباً، {agency.name}</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {getCityLabelAr(agency.city)} · {agency.bank_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setView('cars')}
                className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>إدارة الأسطول</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80">
                <p className="text-xs text-slate-500 font-medium">الحجوزات المؤكدة لليوم</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 font-mono-tabular">
                  {todayConfirmedCount}
                </p>
                <p className="text-xs text-slate-400 mt-1 font-mono-tabular">
                  جاهز للتسليم: {verifiedBookings.length}
                </p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80">
                <p className="text-xs text-slate-500 font-medium">السيارات المتاحة</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 font-mono-tabular">
                  {availableCarsCount} / {cars.length}
                </p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80">
                <p className="text-xs text-slate-500 font-medium">العائدات المتوقعة (90%)</p>
                <p className="text-2xl sm:text-3xl font-bold text-[#2563EB] mt-1 font-mono-tabular">
                  {formatDH(totalPayoutExpected)}
                </p>
              </div>
            </div>

            <AgencyBookingsManager
              bookings={verifiedBookings.slice(0, 5)}
              onRefresh={() => fetchBookings(agency.id)}
              title="حجوزات جاهزة للتسليم"
            />
          </div>
        )}

        {view === 'cars' && (
          <AgencyFleetManager
            agency={agency}
            cars={cars}
            onRefresh={() => fetchCars(agency.id)}
          />
        )}

        {view === 'bookings' && (
          <AgencyBookingsManager
            bookings={bookings}
            onRefresh={() => fetchBookings(agency.id)}
          />
        )}

        {view === 'profile' && (
          <AgencyProfileSettings
            agency={agency}
            onSaved={() => loadAgencyData(session.user.id)}
          />
        )}
      </main>
    </div>
  );
};

const AgencyAuthView: React.FC<{ onGoToCustomer: () => void }> = ({ onGoToCustomer }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const { data, error: authErr } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (authErr) {
      setError(authErr.message);
    } else if (!isLogin && !data.session) {
      setInfo('تم إنشاء الحساب! تحقق من بريدك الإلكتروني لتفعيل الدخول ثم سجل الدخول.');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12" dir="rtl">
      <div className="bg-white p-7 rounded-2xl border border-slate-200/90 shadow-sm space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-slate-900">
            {isLogin ? 'دخول شركات كراء السيارات' : 'تسجيل وكالة جديدة'}
          </h2>
          <p className="text-sm text-slate-500">
            أضف صور أسطولك الحقيقي واستقبل الحجوزات المؤكدة
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
            {info}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              required
              dir="ltr"
              placeholder="agency@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">كلمة المرور</label>
            <input
              type="password"
              required
              minLength={6}
              dir="ltr"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-3 font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{isLogin ? 'تسجيل الدخول' : 'إنشاء حساب وكالة'}</span>
          </button>
        </form>

        <div className="text-center space-y-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-semibold text-emerald-700 hover:underline"
          >
            {isLogin ? 'ليس لديك حساب؟ سجل شركتك الآن' : 'لديك حساب بالفعل؟ سجل الدخول'}
          </button>
          <div>
            <button
              type="button"
              onClick={onGoToCustomer}
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              العودة لواجهة العملاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AgencyOnboardingView: React.FC<{
  user: User;
  schemaWarning: string | null;
  onComplete: () => void;
  onGoToCustomer: () => void;
}> = ({ user, schemaWarning, onComplete, onGoToCustomer }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Casablanca');
  const [bankName, setBankName] = useState('CIH Bank');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [bankRib, setBankRib] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const captureGps = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: insertErr } = await supabase.from('agencies').insert({
      owner_id: user.id,
      name: name.trim(),
      phone: phone.trim(),
      city,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      bank_name: bankName.trim(),
      bank_account_holder: bankAccountHolder.trim() || name.trim(),
      bank_rib: bankRib.trim(),
      verification_status: 'pending',
    });

    if (insertErr) {
      setError(insertErr.message);
    } else {
      onComplete();
    }
    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-10" dir="rtl">
      <div className="bg-white p-7 rounded-2xl border border-slate-200/90 shadow-sm space-y-5">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900">معلومات الشركة والحساب البنكي</h2>
          <p className="text-sm text-slate-500 mt-1">
            يؤكد العميل الحجز بدفع 10% للمنصة، وتستلم أنت الـ 90% المتبقية مباشرة عند تسليم السيارة
          </p>
        </div>

        {schemaWarning && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            {schemaWarning}
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            required
            placeholder="اسم الشركة / الوكالة"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
          />
          <input
            required
            type="tel"
            dir="ltr"
            placeholder="رقم الهاتف (مثال: 0612345678)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
            >
              {MOROCCAN_CITIES.map((c) => (
                <option key={c.slug} value={c.nameFr}>
                  {c.nameAr}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={captureGps}
              className="rounded-xl border border-emerald-700/25 bg-emerald-50 text-emerald-900 px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Navigation className="w-4 h-4" />
              <span>{coords ? 'تم حفظ إحداثيات GPS' : 'تحديد موقع الوكالة GPS'}</span>
            </button>
          </div>
          <input
            required
            placeholder="اسم البنك (CIH، التجاري، الشعبي، البريد...)"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
          />
          <input
            placeholder="اسم صاحب الحساب البنكي"
            value={bankAccountHolder}
            onChange={(e) => setBankAccountHolder(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
          />
          <input
            required
            dir="ltr"
            placeholder="RIB الحساب البنكي (24 رقماً)"
            value={bankRib}
            onChange={(e) => setBankRib(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-3 font-bold text-sm"
          >
            {loading ? 'جاري الحفظ...' : 'حفظ ملف الشركة والمتابعة'}
          </button>
        </form>

        <button
          type="button"
          onClick={onGoToCustomer}
          className="w-full text-center text-xs text-slate-500 hover:text-slate-900"
        >
          العودة للموقع
        </button>
      </div>
    </div>
  );
};

const AgencyFleetManager: React.FC<{
  agency: AgencyProfile;
  cars: CarOffer[];
  onRefresh: () => void;
}> = ({ agency, cars, onRefresh }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [brand, setBrand] = useState('Dacia');
  const [model, setModel] = useState('Duster');
  const [fuelType, setFuelType] = useState<FuelType>('diesel');
  const [transmission, setTransmission] = useState<TransmissionType>('manual');
  const [dailyPrice, setDailyPrice] = useState(350);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(STARTER_IMAGE_TEMPLATES[0].url);
  const [compressing, setCompressing] = useState(false);
  const [compressionSummary, setCompressionSummary] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setErrMsg(null);
    setCompressing(true);
    setCompressionSummary(null);

    try {
      const result = await compressImageFile(rawFile, {
        maxWidth: 1280,
        maxHeight: 960,
        quality: 0.78,
      });
      setImageFile(result.file);
      setImagePreview(URL.createObjectURL(result.file));
      if (result.wasCompressed) {
        setCompressionSummary(
          `تم ضغط الصورة تلقائياً: ${formatFileSize(result.originalBytes)} ← ${formatFileSize(result.compressedBytes)}`,
        );
      } else {
        setCompressionSummary(`حجم الصورة: ${formatFileSize(result.compressedBytes)}`);
      }
    } finally {
      setCompressing(false);
    }
  };

  const handleAddCar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrMsg(null);

    try {
      let finalPhotoUrl = imagePreview;

      if (imageFile) {
        const ext = imageFile.name.split('.').pop() || 'jpg';
        const filePath = `${agency.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('car-photos')
          .upload(filePath, imageFile, { upsert: true });

        if (uploadErr) {
          throw new Error(`تعذر رفع صورة السيارة: ${uploadErr.message}`);
        }

        const { data: pubData } = supabase.storage.from('car-photos').getPublicUrl(filePath);
        finalPhotoUrl = pubData.publicUrl;
      }

      const { error: insertErr } = await supabase.from('agency_cars').insert({
        agency_id: agency.id,
        brand: brand.trim(),
        model: model.trim(),
        fuel_type: fuelType,
        transmission,
        daily_price: dailyPrice,
        primary_image_url: finalPhotoUrl,
        gallery_images: [finalPhotoUrl],
        city: agency.city,
        latitude: agency.latitude,
        longitude: agency.longitude,
        status: 'available',
      });

      if (insertErr) throw new Error(insertErr.message);

      setShowAddForm(false);
      setImageFile(null);
      setCompressionSummary(null);
      onRefresh();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء إضافة السيارة.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (car: CarOffer) => {
    const nextStatus = car.status === 'available' ? 'unavailable' : 'available';
    await supabase.from('agency_cars').update({ status: nextStatus }).eq('id', car.id);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">أسطول السيارات</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ارفع صور سياراتك الحقيقية وحدد حالتها (متاح / غير متاح) بضغطة زر
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2.5 text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة سيارة لأسطولي</span>
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddCar}
          className="bg-white rounded-2xl border border-blue-200 p-5 space-y-4"
        >
          <h3 className="font-bold text-slate-900">إضافة سيارة جديدة بصورتها الحقيقية</h3>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div className="md:col-span-5 space-y-2.5">
              <div className="aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src={imagePreview}
                  alt="معاينة السيارة"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <button
                type="button"
                disabled={compressing}
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-2"
              >
                {compressing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>{compressing ? 'جاري ضغط الصورة...' : 'رفع صورة السيارة (تُضغط تلقائياً)'}</span>
              </button>
              {compressionSummary && (
                <div className="text-[11px] font-medium text-emerald-700 font-mono-tabular">
                  {compressionSummary}
                </div>
              )}
              <div className="flex items-center gap-1.5 flex-wrap">
                {STARTER_IMAGE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(tpl.url);
                    }}
                    className="text-[11px] px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الماركة</label>
                <input
                  required
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Dacia, Renault, Peugeot..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الموديل</label>
                <input
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Duster, Clio 5, 208..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الوقود</label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value as FuelType)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="diesel">ديزل (Diesel)</option>
                  <option value="essence">بنزين (Essence)</option>
                  <option value="hybrid">هجين (Hybrid)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ناقل الحركة</label>
                <select
                  value={transmission}
                  onChange={(e) => setTransmission(e.target.value as TransmissionType)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="manual">يدوي (Manuelle)</option>
                  <option value="automatic">أوتوماتيك (Automatique)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  الثمن اليومي بالدرهم (DH)
                </label>
                <input
                  required
                  type="number"
                  min={100}
                  value={dailyPrice}
                  onChange={(e) => setDailyPrice(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
            </div>
          </div>

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
              disabled={saving || compressing}
              className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white px-5 py-2.5 text-sm font-bold flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>حفظ ونشر السيارة</span>
            </button>
          </div>
        </form>
      )}

      {cars.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center space-y-3">
          <CarFront className="w-9 h-9 text-slate-400 mx-auto" />
          <p className="font-bold text-slate-800">لم تقم بإضافة أي سيارة بعد</p>
          <p className="text-xs text-slate-500">أضف سيارتك الأولى بصورتها الحقيقية لتظهر للعملاء.</p>
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 text-xs font-bold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة سيارة الآن</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cars.map((car) => (
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
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-900">
                      {car.brand} {car.model}
                    </h3>
                    <span
                      className={`text-xs font-bold ${
                        car.status === 'available' ? 'text-emerald-700' : 'text-slate-500'
                      }`}
                    >
                      {car.status === 'available' ? 'متاح' : 'غير متاح'}
                    </span>
                  </div>
                  <div className="font-mono-tabular font-bold text-sm text-[#2563EB] mt-1">
                    {formatDH(car.daily_price)} / يوم
                  </div>
                </div>

                <button
                  type="button"
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AgencyBookingsManager: React.FC<{
  bookings: AgencyBookingRecord[];
  onRefresh: () => void;
  title?: string;
}> = ({ bookings, onRefresh, title = 'الحجوزات المؤكدة' }) => {
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleDeliverCar = async (bookingId: string) => {
    setBusyId(bookingId);
    await supabase.rpc('confirm_car_delivery', { p_booking_id: bookingId });
    setBusyId(null);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          تحصّل النسبة المتبقية (90%) مباشرة من العميل عند التسليم
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center text-sm text-slate-500">
          لا توجد حجوزات مؤكدة في هذه القائمة حالياً.
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300/80 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular text-xs font-bold text-slate-500">
                    {b.booking_code}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="font-bold text-slate-900">
                    {b.car_brand} {b.car_model}
                  </span>
                </div>
                <div className="text-xs text-slate-600">
                  العميل: <span className="font-semibold">{b.customer_name}</span> · الهاتف:{' '}
                  <span dir="ltr" className="font-mono">
                    {b.customer_phone}
                  </span>{' '}
                  · CIN: <span className="font-mono">{b.customer_cin}</span>
                  {b.customer_license_number && (
                    <>
                      {' '}
                      · الرخصة: <span className="font-mono">{b.customer_license_number}</span>
                    </>
                  )}
                </div>
                {b.pickup_location && (
                  <div className="text-xs text-slate-600">
                    مكان الاستلام: <span className="font-semibold text-slate-800">{b.pickup_location}</span>
                  </div>
                )}
                <div className="text-xs text-slate-500">
                  المدة: {b.days} أيام · المبلغ المستحق عند التسليم (90%):{' '}
                  <span className="font-mono-tabular font-bold text-slate-900">
                    {formatDH(b.agency_payout_amount)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {b.status === 'payment_verified' && (
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => handleDeliverCar(b.id)}
                    className="min-h-[40px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white px-4 py-2 text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    {busyId === b.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{busyId === b.id ? 'جاري التأكيد...' : 'تم تسليم السيارة للعميل'}</span>
                  </button>
                )}
                {b.status === 'car_delivered' && (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تم تسليم السيارة</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AgencyProfileSettings: React.FC<{
  agency: AgencyProfile;
  onSaved: () => void;
}> = ({ agency, onSaved }) => {
  const [name, setName] = useState(agency.name);
  const [phone, setPhone] = useState(agency.phone);
  const [bankName, setBankName] = useState(agency.bank_name);
  const [bankRib, setBankRib] = useState(agency.bank_rib);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    const { error } = await supabase
      .from('agencies')
      .update({
        name: name.trim(),
        phone: phone.trim(),
        bank_name: bankName.trim(),
        bank_rib: bankRib.trim(),
      })
      .eq('id', agency.id);

    if (!error) {
      setSavedMsg('تم تحديث بيانات الشركة والحساب البنكي بنجاح.');
      onSaved();
    }
    setSaving(false);
  };

  return (
    <form
      onSubmit={handleSave}
      className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-4 max-w-xl"
    >
      <h2 className="text-xl font-bold text-slate-900">معلومات الشركة والحساب البنكي</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">اسم الشركة</label>
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
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">اسم البنك</label>
          <input
            required
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            رقم الحساب البنكي (RIB) لاستلام الأرباح
          </label>
          <input
            required
            dir="ltr"
            value={bankRib}
            onChange={(e) => setBankRib(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono"
          />
        </div>
      </div>

      {savedMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs text-emerald-800">
          {savedMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-5 py-2.5 text-sm font-bold"
      >
        {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
      </button>
    </form>
  );
};
