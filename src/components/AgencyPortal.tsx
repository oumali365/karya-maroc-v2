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
  Pencil,
  Check,
  X,
  Phone,
  MapPin,
} from 'lucide-react';
import { supabase, MOROCCAN_CITIES } from '../lib/supabase';
import { compressImageFile, formatFileSize } from '../lib/imageCompression';
import { DEFAULT_CAR_IMAGE_URL, STARTER_IMAGE_TEMPLATES } from '../data/starterData';
import { Badge, InputField, PrimaryButton, SecondaryButton, SelectField } from './ui';
import { useLanguage } from '../i18n';
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
  const { dir, lang, formatPrice, getCityLabel } = useLanguage();
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
        <Loader2 className="w-8 h-8 animate-spin text-navy" />
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
  const activeBookingsCount = bookings.filter((b) =>
    ['payment_verified', 'car_delivered'].includes(b.status),
  ).length;
  const todayConfirmedCount = bookings.filter(
    (b) =>
      ['payment_verified', 'car_delivered', 'completed'].includes(b.status) &&
      (isSameDay(b.delivery_at) || isSameDay(b.created_at)),
  ).length;
  const availableCarsCount = cars.filter((c) => c.status === 'available').length;
  const totalPayoutExpected = bookings
    .filter((b) => ['payment_verified', 'car_delivered', 'completed'].includes(b.status))
    .reduce((sum, b) => sum + b.agency_payout_amount, 0);

  const navItems: Array<{
    id: 'dashboard' | 'cars' | 'bookings' | 'profile';
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'dashboard',
      label: lang === 'fr' ? 'Tableau de bord' : 'الرئيسية',
      icon: <Home className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'cars',
      label: lang === 'fr' ? `Flotte (${cars.length})` : `أسطول السيارات (${cars.length})`,
      icon: <CarFront className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'bookings',
      label: lang === 'fr' ? `Réservations (${bookings.length})` : `الحجوزات (${bookings.length})`,
      icon: <CalendarCheck2 className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'profile',
      label: lang === 'fr' ? 'Agence & Banque' : 'معلومات الشركة والبنك',
      icon: <Landmark className="w-4 h-4 shrink-0" />,
    },
  ];

  return (
    <div
      className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-6"
      dir={dir}
    >
      {/* SaaS Sidebar Navigation (Navy + Ivory) */}
      <aside className="w-full lg:w-64 shrink-0 bg-white rounded-2xl border border-[#E5E0D5] p-4 flex flex-col gap-4 self-start">
        <div className="rounded-xl bg-navy text-white p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/40 text-gold flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-[#C7D0DA]">
              {lang === 'fr' ? 'Portail Agence' : 'بوابة الوكالات'}
            </p>
            <p className="font-bold text-sm text-white truncate">{agency.name}</p>
          </div>
        </div>

        <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
          {navItems.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`w-auto lg:w-full text-start px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-navy text-white'
                    : 'text-ink-muted hover:bg-ivory hover:text-navy'
                }`}
              >
                <span className={active ? 'text-gold' : ''}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="pt-3 border-t border-[#EFECE5]">
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="w-full text-start px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-rose-700 hover:bg-rose-50 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>{lang === 'fr' ? 'Déconnexion' : 'تسجيل الخروج'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 space-y-6">
        {agency.verification_status === 'pending' && (
          <div className="rounded-xl bg-gold-soft border border-gold/40 px-4 py-3 text-xs sm:text-sm text-[#7A5920] flex items-center justify-between gap-3">
            <span>
              {lang === 'fr'
                ? 'Votre agence est en cours de vérification. Ajoutez vos véhicules dès maintenant, ils seront publiés dès validation.'
                : 'حساب وكالتك قيد المراجعة من طرف الإدارة. يمكنك إضافة سياراتك الآن، وستظهر للعملاء فور التفعيل.'}
            </span>
            <Badge variant="warning">{lang === 'fr' ? 'En attente' : 'قيد المراجعة'}</Badge>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-navy">
                  {lang === 'fr' ? `Bonjour, ${agency.name}` : `مرحباً، ${agency.name}`}
                </h1>
                <p className="text-sm text-ink-muted mt-0.5">
                  {getCityLabel(agency.city)} · {agency.bank_name}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                {agency.verification_status === 'verified' && (
                  <Badge variant="success" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                    {lang === 'fr' ? 'Agence vérifiée' : 'وكالة موثقة'}
                  </Badge>
                )}
                <PrimaryButton size="sm" onClick={() => setView('cars')}>
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'fr' ? 'Gérer la flotte' : 'إدارة الأسطول'}</span>
                </PrimaryButton>
              </div>
            </div>

            {/* 3 Quick KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-[#E5E0D5] p-5 rounded-2xl">
                <p className="text-xs text-ink-muted font-semibold">
                  {lang === 'fr' ? 'Réservations actives' : 'الحجوزات النشطة'}
                </p>
                <p className="text-3xl font-extrabold text-navy mt-1.5 font-latin tabular-nums">
                  {activeBookingsCount}
                </p>
                <p className="text-xs text-ink-muted mt-1.5 tabular-nums">
                  {lang === 'fr'
                    ? `Prêtes à livrer : ${verifiedBookings.length} · Aujourd’hui : ${todayConfirmedCount}`
                    : `جاهز للتسليم: ${verifiedBookings.length} · اليوم: ${todayConfirmedCount}`}
                </p>
              </div>

              <div className="bg-navy text-white border border-navy p-5 rounded-2xl">
                <p className="text-xs text-[#C7D0DA] font-semibold">
                  {lang === 'fr' ? 'Revenus attendus (90 %)' : 'الأرباح المتوقعة (نسبة 90%)'}
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold text-gold mt-1.5 font-latin tabular-nums">
                  {formatPrice(totalPayoutExpected)}
                </p>
                <p className="text-xs text-[#C7D0DA] mt-1.5">
                  {lang === 'fr' ? 'Encaissés à la remise du véhicule' : 'تُحصّل عند تسليم السيارة'}
                </p>
              </div>

              <div className="bg-white border border-[#E5E0D5] p-5 rounded-2xl">
                <p className="text-xs text-ink-muted font-semibold">
                  {lang === 'fr' ? 'Nombre de véhicules' : 'عدد السيارات'}
                </p>
                <p className="text-3xl font-extrabold text-navy mt-1.5 font-latin tabular-nums">
                  {availableCarsCount}{' '}
                  <span className="text-base font-semibold text-ink-muted">/ {cars.length}</span>
                </p>
                <p className="text-xs text-ink-muted mt-1.5">
                  {lang === 'fr' ? 'Véhicules actifs en ligne' : 'سيارة متاحة للحجز حالياً'}
                </p>
              </div>
            </div>

            <AgencyBookingsManager
              bookings={verifiedBookings.slice(0, 6)}
              onRefresh={() => fetchBookings(agency.id)}
              title={lang === 'fr' ? 'Réservations prêtes pour remise' : 'حجوزات جاهزة للتسليم'}
              compact
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
  const { dir, lang } = useLanguage();
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
      setInfo(
        lang === 'fr'
          ? 'Compte créé ! Vérifiez votre boîte e-mail pour activer votre accès.'
          : 'تم إنشاء الحساب! تحقق من بريدك الإلكتروني لتفعيل الدخول ثم سجل الدخول.',
      );
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12" dir={dir}>
      <div className="bg-white p-7 rounded-2xl border border-[#E5E0D5] shadow-xs space-y-6">
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-2xl bg-navy text-gold mx-auto flex items-center justify-center mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-navy">
            {isLogin
              ? lang === 'fr'
                ? 'Connexion Agences'
                : 'دخول شركات كراء السيارات'
              : lang === 'fr'
                ? 'Créer un compte agence'
                : 'تسجيل وكالة جديدة'}
          </h2>
          <p className="text-sm text-ink-muted">
            {lang === 'fr'
              ? 'Publiez votre flotte réelle et gérez vos réservations confirmées'
              : 'أضف صور أسطولك الحقيقي واستقبل الحجوزات المؤكدة'}
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
            {info}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField
            type="email"
            required
            dir="ltr"
            label={lang === 'fr' ? 'Adresse e-mail' : 'البريد الإلكتروني'}
            placeholder="agency@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <InputField
            type="password"
            required
            minLength={6}
            dir="ltr"
            label={lang === 'fr' ? 'Mot de passe' : 'كلمة المرور'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <PrimaryButton type="submit" fullWidth size="lg" loading={loading}>
            <span>
              {isLogin
                ? lang === 'fr'
                  ? 'Se connecter'
                  : 'تسجيل الدخول'
                : lang === 'fr'
                  ? 'Créer mon compte'
                  : 'إنشاء حساب وكالة'}
            </span>
          </PrimaryButton>
        </form>

        <div className="text-center space-y-2.5 pt-3 border-t border-[#EFECE5]">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-bold text-navy hover:text-gold-hover transition-colors cursor-pointer"
          >
            {isLogin
              ? lang === 'fr'
                ? 'Pas encore de compte ? Inscrivez votre agence'
                : 'ليس لديك حساب؟ سجل شركتك الآن'
              : lang === 'fr'
                ? 'Déjà inscrit ? Connectez-vous'
                : 'لديك حساب بالفعل؟ سجل الدخول'}
          </button>
          <div>
            <button
              type="button"
              onClick={onGoToCustomer}
              className="text-xs text-ink-muted hover:text-navy cursor-pointer"
            >
              {lang === 'fr' ? 'Retour à l’accueil client' : 'العودة لواجهة العملاء'}
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
  const { dir, lang } = useLanguage();
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
    <div className="max-w-lg mx-auto px-4 py-10" dir={dir}>
      <div className="bg-white p-7 rounded-2xl border border-[#E5E0D5] shadow-xs space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-navy">
            {lang === 'fr' ? 'Profil de l’agence & RIB' : 'معلومات الشركة والحساب البنكي'}
          </h2>
          <p className="text-sm text-ink-muted">
            {lang === 'fr'
              ? 'Le client règle 10 % d’acompte sur Karya et vous encaissez les 90 % à la livraison.'
              : 'يؤكد العميل الحجز بدفع 10% للمنصة، وتستلم أنت الـ 90% المتبقية مباشرة عند تسليم السيارة'}
          </p>
        </div>

        {schemaWarning && (
          <div className="rounded-xl bg-gold-soft border border-gold/40 p-3 text-xs text-[#7A5920]">
            {schemaWarning}
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField
            required
            label={lang === 'fr' ? 'Nom de l’agence' : 'اسم الشركة / الوكالة'}
            placeholder={lang === 'fr' ? 'Ex : Atlas Car Casablanca' : 'اسم الشركة / الوكالة'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <InputField
            required
            type="tel"
            dir="ltr"
            label={lang === 'fr' ? 'Téléphone' : 'رقم الهاتف'}
            placeholder="0612345678"
            className="font-mono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <SelectField
              label={lang === 'fr' ? 'Ville' : 'المدينة'}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              {MOROCCAN_CITIES.map((c) => (
                <option key={c.slug} value={c.nameFr}>
                  {lang === 'fr' ? c.nameFr : c.nameAr}
                </option>
              ))}
            </SelectField>
            <SecondaryButton fullWidth onClick={captureGps}>
              <Navigation className="w-4 h-4 text-navy" />
              <span>
                {coords
                  ? lang === 'fr'
                    ? 'GPS enregistré'
                    : 'تم حفظ GPS'
                  : lang === 'fr'
                    ? 'Localisation GPS'
                    : 'تحديد موقع الوكالة GPS'}
              </span>
            </SecondaryButton>
          </div>
          <InputField
            required
            label={lang === 'fr' ? 'Banque' : 'اسم البنك'}
            placeholder="CIH Bank, Attijariwafa, Banque Populaire..."
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
          <InputField
            label={lang === 'fr' ? 'Titulaire du compte' : 'اسم صاحب الحساب البنكي'}
            placeholder={lang === 'fr' ? 'Nom du titulaire' : 'اسم صاحب الحساب البنكي'}
            value={bankAccountHolder}
            onChange={(e) => setBankAccountHolder(e.target.value)}
          />
          <InputField
            required
            dir="ltr"
            label="RIB (24 chiffres)"
            placeholder="230 780 ..."
            className="font-mono"
            value={bankRib}
            onChange={(e) => setBankRib(e.target.value)}
          />

          <PrimaryButton type="submit" fullWidth size="lg" loading={loading}>
            <span>
              {loading
                ? lang === 'fr'
                  ? 'Enregistrement...'
                  : 'جاري الحفظ...'
                : lang === 'fr'
                  ? 'Enregistrer et continuer'
                  : 'حفظ ملف الشركة والمتابعة'}
            </span>
          </PrimaryButton>
        </form>

        <button
          type="button"
          onClick={onGoToCustomer}
          className="w-full text-center text-xs text-ink-muted hover:text-navy cursor-pointer"
        >
          {lang === 'fr' ? 'Retour au site' : 'العودة للموقع'}
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
  const { lang, formatPrice, t, getCityLabel } = useLanguage();
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

  // Quick inline edit state for fleet table rows
  const [editingCarId, setEditingCarId] = useState<string | null>(null);
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editPrice, setEditPrice] = useState<number>(300);
  const [editSaving, setEditSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
    setTogglingId(car.id);
    const nextStatus = car.status === 'available' ? 'unavailable' : 'available';
    await supabase.from('agency_cars').update({ status: nextStatus }).eq('id', car.id);
    setTogglingId(null);
    onRefresh();
  };

  const startEdit = (car: CarOffer) => {
    setEditingCarId(car.id);
    setEditBrand(car.brand);
    setEditModel(car.model);
    setEditPrice(car.daily_price);
  };

  const saveEdit = async (carId: string) => {
    if (!editBrand.trim() || !editModel.trim() || editPrice <= 0) return;
    setEditSaving(true);
    await supabase
      .from('agency_cars')
      .update({
        brand: editBrand.trim(),
        model: editModel.trim(),
        daily_price: editPrice,
      })
      .eq('id', carId);
    setEditSaving(false);
    setEditingCarId(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">
            {lang === 'fr' ? 'Gestion de la flotte' : 'إدارة أسطول السيارات'}
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            {lang === 'fr'
              ? 'Modifiez les tarifs ou activez/désactivez la disponibilité en un clic'
              : 'عدّل الأسعار أو فعّل وعطّل توفر سياراتك بضغطة زر'}
          </p>
        </div>
        <PrimaryButton onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="w-4 h-4" />
          <span>{lang === 'fr' ? 'Ajouter un véhicule' : 'إضافة سيارة لأسطولي'}</span>
        </PrimaryButton>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddCar}
          className="bg-white rounded-2xl border border-[#E5E0D5] p-5 sm:p-6 space-y-5 shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-[#EFECE5] pb-3">
            <h3 className="font-bold text-navy">
              {lang === 'fr' ? 'Nouveau véhicule' : 'إضافة سيارة جديدة بصورتها الحقيقية'}
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs font-semibold text-ink-muted hover:text-navy cursor-pointer"
            >
              {lang === 'fr' ? 'Fermer' : 'إغلاق'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            <div className="md:col-span-5 space-y-2.5">
              <div className="aspect-[4/3] rounded-xl overflow-hidden border border-[#E5E0D5] bg-ivory">
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
              <SecondaryButton
                fullWidth
                size="sm"
                loading={compressing}
                onClick={() => fileRef.current?.click()}
              >
                {!compressing && <Upload className="w-4 h-4" />}
                <span>
                  {compressing
                    ? lang === 'fr'
                      ? 'Compression...'
                      : 'جاري ضغط الصورة...'
                    : lang === 'fr'
                      ? 'Importer une photo réelle'
                      : 'رفع صورة السيارة (تُضغط تلقائياً)'}
                </span>
              </SecondaryButton>
              {compressionSummary && (
                <div className="text-[11px] font-medium text-emerald-800 font-mono-tabular">
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
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-[#E5E0D5] text-ink-muted hover:border-gold hover:text-navy cursor-pointer"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <InputField
                required
                label={lang === 'fr' ? 'Marque' : 'الماركة'}
                placeholder="Dacia, Renault, Peugeot..."
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
              <InputField
                required
                label={lang === 'fr' ? 'Modèle' : 'الموديل'}
                placeholder="Duster, Clio 5, 208..."
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
              <SelectField
                label={lang === 'fr' ? 'Carburant' : 'الوقود'}
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value as FuelType)}
              >
                <option value="diesel">ديزل (Diesel)</option>
                <option value="essence">بنزين (Essence)</option>
                <option value="hybrid">هجين (Hybrid)</option>
              </SelectField>
              <SelectField
                label={lang === 'fr' ? 'Boîte' : 'ناقل الحركة'}
                value={transmission}
                onChange={(e) => setTransmission(e.target.value as TransmissionType)}
              >
                <option value="manual">يدوي (Manuelle)</option>
                <option value="automatic">أوتوماتيك (Automatique)</option>
              </SelectField>
              <InputField
                containerClassName="sm:col-span-2"
                required
                type="number"
                min={100}
                label={lang === 'fr' ? 'Tarif journalier (MAD)' : 'الثمن اليومي بالدرهم'}
                className="font-mono-tabular"
                value={dailyPrice}
                onChange={(e) => setDailyPrice(Number(e.target.value))}
              />
            </div>
          </div>

          {errMsg && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-800">
              {errMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#EFECE5]">
            <SecondaryButton size="sm" onClick={() => setShowAddForm(false)}>
              {lang === 'fr' ? 'Annuler' : 'إلغاء'}
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={compressing} loading={saving}>
              <span>{lang === 'fr' ? 'Enregistrer et publier' : 'حفظ ونشر السيارة'}</span>
            </PrimaryButton>
          </div>
        </form>
      )}

      {/* Fleet Management Table (Desktop) & Cards (Mobile) */}
      {cars.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E0D5] p-10 text-center space-y-2">
          <CarFront className="w-9 h-9 text-ink-muted/50 mx-auto" />
          <p className="font-bold text-navy">
            {lang === 'fr' ? 'Aucun véhicule enregistré' : 'لم تقم بإضافة أي سيارة بعد'}
          </p>
          <p className="text-xs text-ink-muted">
            {lang === 'fr'
              ? 'Cliquez sur « Ajouter un véhicule » pour publier votre flotte.'
              : 'اضغط على "إضافة سيارة لأسطولي" لرفع صور سياراتك.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E0D5] overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-ivory/70 border-b border-[#E5E0D5] text-xs font-bold text-ink-muted">
                  <th className="py-3.5 px-4 text-start">
                    {lang === 'fr' ? 'Véhicule' : 'السيارة'}
                  </th>
                  <th className="py-3.5 px-4 text-start">
                    {lang === 'fr' ? 'Spécifications' : 'المواصفات'}
                  </th>
                  <th className="py-3.5 px-4 text-start">
                    {lang === 'fr' ? 'Tarif / jour' : 'السعر اليومي'}
                  </th>
                  <th className="py-3.5 px-4 text-start">
                    {lang === 'fr' ? 'Statut' : 'الحالة'}
                  </th>
                  <th className="py-3.5 px-4 text-end">
                    {lang === 'fr' ? 'Actions rapides' : 'إجراءات سريعة'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0ECE3] text-sm">
                {cars.map((car) => {
                  const isEditing = editingCarId === car.id;
                  return (
                    <tr key={car.id} className="hover:bg-ivory/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={car.primary_image_url}
                            alt={`${car.brand} ${car.model}`}
                            referrerPolicy="no-referrer"
                            className="w-16 h-12 rounded-lg object-cover bg-ivory border border-[#E5E0D5] shrink-0"
                          />
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                value={editBrand}
                                onChange={(e) => setEditBrand(e.target.value)}
                                className="w-24 rounded-lg border border-[#E2DDD3] px-2 py-1 text-xs font-semibold"
                              />
                              <input
                                value={editModel}
                                onChange={(e) => setEditModel(e.target.value)}
                                className="w-24 rounded-lg border border-[#E2DDD3] px-2 py-1 text-xs font-semibold"
                              />
                            </div>
                          ) : (
                            <div>
                              <div className="font-bold text-navy font-latin">
                                {car.brand} {car.model}
                              </div>
                              <div className="text-xs text-ink-muted">
                                {getCityLabel(car.city)}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-xs text-ink-muted">
                        <span>{t(`car.fuel.${car.fuel_type}`)}</span>
                        <span className="mx-1.5">·</span>
                        <span>{t(`car.transmission.${car.transmission}`)}</span>
                        <span className="mx-1.5">·</span>
                        <span className="tabular-nums">
                          {car.seats} {t('car.seats')}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="number"
                            min={100}
                            value={editPrice}
                            onChange={(e) => setEditPrice(Number(e.target.value))}
                            className="w-24 rounded-lg border border-gold px-2.5 py-1 text-xs font-mono-tabular font-bold"
                          />
                        ) : (
                          <span className="font-latin tabular-nums font-bold text-navy">
                            {formatPrice(car.daily_price, 0)}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <Badge variant={car.status === 'available' ? 'success' : 'neutral'}>
                          {car.status === 'available'
                            ? lang === 'fr'
                              ? 'Disponible'
                              : 'متاح'
                            : lang === 'fr'
                              ? 'Indisponible'
                              : 'غير متاح'}
                        </Badge>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={editSaving}
                                onClick={() => saveEdit(car.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-navy text-white px-2.5 py-1.5 text-xs font-bold hover:bg-navy-light cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5 text-gold" />
                                <span>{lang === 'fr' ? 'OK' : 'حفظ'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCarId(null)}
                                className="inline-flex items-center rounded-lg border border-[#E2DDD3] px-2 py-1.5 text-xs text-ink-muted hover:text-navy cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(car)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#E2DDD3] bg-white hover:bg-ivory text-ink px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>{lang === 'fr' ? 'Modifier' : 'تعديل'}</span>
                              </button>
                              <button
                                type="button"
                                disabled={togglingId === car.id}
                                onClick={() => toggleStatus(car)}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                                  car.status === 'available'
                                    ? 'border-[#E2DDD3] bg-ivory/70 text-ink-muted hover:text-navy'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                }`}
                              >
                                {car.status === 'available' ? (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5" />
                                    <span>{lang === 'fr' ? 'Désactiver' : 'تعطيل'}</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{lang === 'fr' ? 'Activer' : 'تفعيل'}</span>
                                  </>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-[#F0ECE3]">
            {cars.map((car) => {
              const isEditing = editingCarId === car.id;
              return (
                <div key={car.id} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={car.primary_image_url}
                      alt={`${car.brand} ${car.model}`}
                      referrerPolicy="no-referrer"
                      className="w-20 h-14 rounded-lg object-cover bg-ivory border border-[#E5E0D5] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-navy font-latin truncate">
                          {car.brand} {car.model}
                        </h3>
                        <Badge variant={car.status === 'available' ? 'success' : 'neutral'}>
                          {car.status === 'available'
                            ? lang === 'fr'
                              ? 'Disponible'
                              : 'متاح'
                            : lang === 'fr'
                              ? 'Inactif'
                              : 'معطل'}
                        </Badge>
                      </div>
                      <div className="font-latin tabular-nums font-bold text-sm text-navy mt-0.5">
                        {formatPrice(car.daily_price, 0)} / {lang === 'fr' ? 'jour' : 'يوم'}
                      </div>
                      <div className="text-[11px] text-ink-muted mt-0.5">
                        {t(`car.fuel.${car.fuel_type}`)} · {t(`car.transmission.${car.transmission}`)} ·{' '}
                        {car.seats} {t('car.seats')}
                      </div>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <input
                        value={editBrand}
                        onChange={(e) => setEditBrand(e.target.value)}
                        className="rounded-lg border border-[#E2DDD3] px-2.5 py-2 text-xs"
                      />
                      <input
                        value={editModel}
                        onChange={(e) => setEditModel(e.target.value)}
                        className="rounded-lg border border-[#E2DDD3] px-2.5 py-2 text-xs"
                      />
                      <input
                        type="number"
                        min={100}
                        value={editPrice}
                        onChange={(e) => setEditPrice(Number(e.target.value))}
                        className="col-span-2 rounded-lg border border-gold px-2.5 py-2 text-xs font-mono-tabular font-bold"
                      />
                      <button
                        type="button"
                        disabled={editSaving}
                        onClick={() => saveEdit(car.id)}
                        className="rounded-xl bg-navy text-white py-2 text-xs font-bold"
                      >
                        {lang === 'fr' ? 'Enregistrer' : 'حفظ التعديل'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCarId(null)}
                        className="rounded-xl border border-[#E2DDD3] py-2 text-xs font-semibold"
                      >
                        {lang === 'fr' ? 'Annuler' : 'إلغاء'}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(car)}
                        className="rounded-xl border border-[#E2DDD3] py-2 text-xs font-semibold text-ink flex items-center justify-center gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>{lang === 'fr' ? 'Modifier' : 'تعديل'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={togglingId === car.id}
                        onClick={() => toggleStatus(car)}
                        className="rounded-xl border border-[#E2DDD3] bg-ivory py-2 text-xs font-semibold text-navy flex items-center justify-center gap-1.5"
                      >
                        {car.status === 'available' ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>{lang === 'fr' ? 'Désactiver' : 'تعطيل'}</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>{lang === 'fr' ? 'Activer' : 'تفعيل'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const AgencyBookingsManager: React.FC<{
  bookings: AgencyBookingRecord[];
  onRefresh: () => void;
  title?: string;
  compact?: boolean;
}> = ({ bookings, onRefresh, title, compact = false }) => {
  const { lang, formatPrice } = useLanguage();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'ready' | 'delivered'>('all');

  const handleDeliverCar = async (bookingId: string) => {
    setBusyId(bookingId);
    await supabase.rpc('confirm_car_delivery', { p_booking_id: bookingId });
    setBusyId(null);
    onRefresh();
  };

  const visibleBookings = compact
    ? bookings
    : bookings.filter((b) => {
        if (filter === 'ready') return b.status === 'payment_verified';
        if (filter === 'delivered') return b.status === 'car_delivered' || b.status === 'completed';
        return true;
      });

  const heading = title || (lang === 'fr' ? 'Réservations confirmées' : 'الحجوزات المؤكدة للوكالة');

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">{heading}</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            {lang === 'fr'
              ? 'Encaissez les 90 % restants directement auprès du client lors de la remise'
              : 'تحصّل النسبة المتبقية (90%) مباشرة من العميل عند تأكيد التسليم'}
          </p>
        </div>

        {!compact && (
          <div className="flex items-center gap-1 p-1 bg-white border border-[#E5E0D5] rounded-xl self-start">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filter === 'all' ? 'bg-navy text-white' : 'text-ink-muted hover:text-navy'
              }`}
            >
              {lang === 'fr' ? 'Toutes' : 'الكل'} ({bookings.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('ready')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filter === 'ready' ? 'bg-navy text-white' : 'text-ink-muted hover:text-navy'
              }`}
            >
              {lang === 'fr' ? 'À livrer' : 'جاهز للتسليم'}
            </button>
            <button
              type="button"
              onClick={() => setFilter('delivered')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filter === 'delivered' ? 'bg-navy text-white' : 'text-ink-muted hover:text-navy'
              }`}
            >
              {lang === 'fr' ? 'Livrées' : 'تم التسليم'}
            </button>
          </div>
        )}
      </div>

      {visibleBookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E0D5] p-10 text-center text-sm text-ink-muted">
          {lang === 'fr'
            ? 'Aucune réservation confirmée dans cette liste.'
            : 'لا توجد حجوزات مؤكدة في هذه القائمة حالياً.'}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleBookings.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-[#E5E0D5] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono-tabular text-xs font-bold text-navy bg-ivory px-2.5 py-1 rounded-lg border border-[#E5E0D5]">
                    {b.booking_code}
                  </span>
                  <span className="font-bold text-ink font-latin">
                    {b.car_brand} {b.car_model}
                  </span>
                  <Badge
                    variant={
                      b.status === 'car_delivered' || b.status === 'completed'
                        ? 'success'
                        : b.status === 'payment_verified'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {b.status === 'payment_verified'
                      ? lang === 'fr'
                        ? 'Prêt à livrer'
                        : 'جاهز للتسليم'
                      : b.status === 'car_delivered'
                        ? lang === 'fr'
                          ? 'Livré'
                          : 'تم التسليم'
                        : b.status}
                  </Badge>
                </div>

                {/* Highlighted Customer Identity & Contact */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-ivory/75 border border-[#EFECE5] px-3.5 py-2 text-xs">
                  <span className="font-bold text-navy">{b.customer_name}</span>
                  <a
                    href={`tel:${b.customer_phone}`}
                    dir="ltr"
                    className="inline-flex items-center gap-1 font-mono font-bold text-navy hover:text-gold-hover"
                  >
                    <Phone className="w-3.5 h-3.5 text-gold" />
                    <span>{b.customer_phone}</span>
                  </a>
                  <span className="text-ink-muted font-mono">CIN: {b.customer_cin}</span>
                  {b.customer_license_number && (
                    <span className="text-ink-muted font-mono">
                      {lang === 'fr' ? 'Permis' : 'الرخصة'}: {b.customer_license_number}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                  {b.pickup_location && (
                    <span className="inline-flex items-center gap-1 text-ink">
                      <MapPin className="w-3.5 h-3.5 text-gold shrink-0" />
                      <span>{b.pickup_location}</span>
                    </span>
                  )}
                  <span className="tabular-nums">
                    {b.days} {lang === 'fr' ? 'jours' : 'أيام'}
                  </span>
                  <span>·</span>
                  <span>
                    {lang === 'fr' ? 'À encaisser (90 %) :' : 'المستحق عند التسليم (90%):'}{' '}
                    <strong className="font-latin tabular-nums text-navy">
                      {formatPrice(b.agency_payout_amount)}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {b.status === 'payment_verified' && (
                  <PrimaryButton
                    size="sm"
                    loading={busyId === b.id}
                    onClick={() => handleDeliverCar(b.id)}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {busyId === b.id
                        ? lang === 'fr'
                          ? 'Validation...'
                          : 'جاري التأكيد...'
                        : lang === 'fr'
                          ? 'Confirmer la remise'
                          : 'تأكيد التسليم'}
                    </span>
                  </PrimaryButton>
                )}
                {b.status === 'car_delivered' && (
                  <Badge variant="success" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                    {lang === 'fr' ? 'Véhicule remis' : 'تم تسليم السيارة'}
                  </Badge>
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
  const { lang } = useLanguage();
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
      setSavedMsg(
        lang === 'fr'
          ? 'Informations de l’agence et RIB mis à jour.'
          : 'تم تحديث بيانات الشركة والحساب البنكي بنجاح.',
      );
      onSaved();
    }
    setSaving(false);
  };

  return (
    <form
      onSubmit={handleSave}
      className="bg-white rounded-2xl border border-[#E5E0D5] p-6 space-y-4 max-w-xl"
    >
      <h2 className="text-xl font-bold text-navy">
        {lang === 'fr' ? 'Informations Agence & Banque' : 'معلومات الشركة والحساب البنكي'}
      </h2>
      <div className="space-y-3.5">
        <InputField
          required
          label={lang === 'fr' ? 'Nom de l’agence' : 'اسم الشركة'}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <InputField
          required
          dir="ltr"
          label={lang === 'fr' ? 'Téléphone' : 'رقم الهاتف'}
          className="font-mono"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <InputField
          required
          label={lang === 'fr' ? 'Nom de la banque' : 'اسم البنك'}
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
        />
        <InputField
          required
          dir="ltr"
          label={lang === 'fr' ? 'RIB bancaire' : 'رقم الحساب البنكي (RIB) لاستلام الأرباح'}
          className="font-mono"
          value={bankRib}
          onChange={(e) => setBankRib(e.target.value)}
        />
      </div>

      {savedMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
          {savedMsg}
        </div>
      )}

      <PrimaryButton type="submit" loading={saving}>
        <span>
          {saving
            ? lang === 'fr'
              ? 'Enregistrement...'
              : 'جاري الحفظ...'
            : lang === 'fr'
              ? 'Enregistrer les modifications'
              : 'حفظ التغييرات'}
        </span>
      </PrimaryButton>
    </form>
  );
};
