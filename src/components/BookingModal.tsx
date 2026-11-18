import React, { useMemo, useRef, useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  CalendarClock,
  Loader2,
  MapPin,
  CreditCard,
  AlertCircle,
  Star,
  Fuel,
  Gauge,
  Users,
  ArrowLeft,
  ArrowRight,
  Minus,
  Plus,
  Navigation,
  User,
  Phone,
  Calendar,
} from 'lucide-react';
import {
  supabase,
  formatDH,
  getCityLabelAr,
  findNearestMoroccanCity,
} from '../lib/supabase';
import { BankTransferCheckout } from './BankTransferCheckout';
import type { CarOffer, CreatedBooking } from '../types/karya';

interface BookingModalProps {
  car: CarOffer;
  initialPickupDate?: string;
  initialDays?: number;
  onClose: () => void;
  onBookingCompleted: (booking: CreatedBooking) => void;
}

type StepKey = 'overview' | 'details' | 'payment' | 'done';

const STEPS: { key: StepKey; label: string; number: number }[] = [
  { key: 'overview', label: 'السيارة', number: 1 },
  { key: 'details', label: 'البيانات', number: 2 },
  { key: 'payment', label: 'التحويل', number: 3 },
  { key: 'done', label: 'التأكيد', number: 4 },
];

const TIME_SLOTS: string[] = Array.from({ length: 34 }, (_, idx) => {
  const totalMinutes = 7 * 60 + idx * 30;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mins = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${mins}`;
});

function getTodayDateString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function getDefaultPickupDateString(): string {
  const dt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function getLicenseSeniorityInfo(issueDateStr: string): {
  valid: boolean;
  message: string;
} | null {
  if (!issueDateStr) return null;
  const parsed = new Date(`${issueDateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (parsed > today) {
    return {
      valid: false,
      message: 'تاريخ إصدار الرخصة غير صالح.',
    };
  }

  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  threeYearsAgo.setHours(23, 59, 59, 999);

  if (parsed > threeYearsAgo) {
    return {
      valid: false,
      message:
        'يجب أن تكون لديك رخصة سياقة منذ 3 سنوات على الأقل (36 شهراً) للاستفادة من الكراء بدون ضمانة مالية.',
    };
  }

  const diffYears = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const wholeYears = Math.max(3, Math.floor(diffYears));

  return {
    valid: true,
    message: `رخصة السياقة صادرة منذ ${wholeYears} ${wholeYears >= 11 ? 'سنة' : 'سنوات'} (مستوفية للشروط).`,
  };
}

function getFuelLabelAr(fuel: CarOffer['fuel_type']): string {
  if (fuel === 'diesel') return 'ديزل';
  if (fuel === 'hybrid') return 'هجين';
  if (fuel === 'electric') return 'كهرباء';
  return 'بنزين';
}

interface FloatingFieldProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (val: string) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  type?: string;
  dir?: 'rtl' | 'ltr';
  required?: boolean;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  uppercase?: boolean;
  max?: string;
}

const FloatingField: React.FC<FloatingFieldProps> = ({
  id,
  label,
  icon,
  value,
  onChange,
  onFocus,
  type = 'text',
  dir = 'rtl',
  required = false,
  autoComplete,
  inputMode,
  uppercase = false,
  max,
}) => {
  const isDate = type === 'date';

  return (
    <div className="relative">
      <span
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
        aria-hidden="true"
      >
        {icon}
      </span>
      <input
        id={id}
        type={type}
        required={required}
        dir={dir}
        autoComplete={autoComplete}
        inputMode={inputMode}
        max={max}
        placeholder=" "
        value={value}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        className={`peer w-full min-h-[54px] rounded-lg border border-[var(--karya-border)] bg-white pr-10 pl-3.5 pt-5 pb-1.5 text-sm font-semibold text-[var(--karya-text)] transition-colors focus:border-[var(--karya-action)] focus:outline-none focus:ring-2 focus:ring-[var(--karya-action)]/15 ${
          dir === 'ltr' ? 'font-mono text-left' : ''
        } ${uppercase ? 'uppercase' : ''}`}
      />
      <label
        htmlFor={id}
        className={`pointer-events-none absolute right-10 transition-all duration-150 ${
          isDate
            ? 'top-1.5 text-[11px] font-bold text-[var(--karya-text-muted)]'
            : 'top-1.5 text-[11px] font-bold text-[var(--karya-text-muted)] peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-xs peer-placeholder-shown:font-semibold peer-placeholder-shown:text-slate-400 peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:font-bold peer-focus:text-[var(--karya-action)]'
        }`}
      >
        {label}
      </label>
    </div>
  );
};

export const BookingModal: React.FC<BookingModalProps> = ({
  car,
  initialPickupDate,
  initialDays,
  onClose,
  onBookingCompleted,
}) => {
  const todayStr = useMemo(() => getTodayDateString(), []);

  const [step, setStep] = useState<StepKey>('overview');
  const [customerName, setCustomerName] = useState('');
  const [customerCin, setCustomerCin] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLicenseNumber, setCustomerLicenseNumber] = useState('');
  const [customerLicenseIssueDate, setCustomerLicenseIssueDate] = useState('');

  const [pickupLocation, setPickupLocation] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const [days, setDays] = useState(() =>
    initialDays && initialDays >= 3 && initialDays <= 90 ? initialDays : 3,
  );
  const [pickupDate, setPickupDate] = useState(() =>
    initialPickupDate && initialPickupDate >= todayStr
      ? initialPickupDate
      : getDefaultPickupDateString(),
  );
  const [pickupTime, setPickupTime] = useState('10:00');

  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdBooking, setCreatedBooking] = useState<CreatedBooking | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [driverPledgeAccepted, setDriverPledgeAccepted] = useState(false);

  const activeStepIndex = STEPS.findIndex((s) => s.key === step);
  const resolvedPickupLocation = pickupLocation.trim();

  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationNote('المتصفح لا يدعم تحديد الموقع، اكتب عنوانك الحالي أدناه.');
      return;
    }

    setDetectingLocation(true);
    setLocationNote(null);
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const nearest = findNearestMoroccanCity(lat, lng);
        const formattedLocation = `الموقع الحالي (${nearest.city.nameAr}) — ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setLocationCoords({ lat, lng });
        setPickupLocation(formattedLocation);
        setLocationNote(`تم تحديد موقعك قرب ${nearest.city.nameAr} لتسهيل تسليم السيارة.`);
        setDetectingLocation(false);
      },
      () => {
        setLocationNote('تعذر الوصول للموقع تلقائياً، يرجى كتابة عنوانك الحالي أدناه.');
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const licenseInfo = useMemo(
    () => getLicenseSeniorityInfo(customerLicenseIssueDate),
    [customerLicenseIssueDate],
  );

  const totalAmount = Number((car.daily_price * days).toFixed(2));
  const commissionAmount = Number((totalAmount * 0.1).toFixed(2));
  const agencyPayoutAmount = Number((totalAmount - commissionAmount).toFixed(2));

  const handleFieldFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.currentTarget;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);
  };

  const handleCreateDraftBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;

    setErrorMsg(null);

    if (days < 3) {
      setErrorMsg('الحد الأدنى للكراء في المنصة هو 3 أيام.');
      return;
    }

    if (
      !customerName.trim() ||
      !customerCin.trim() ||
      !customerPhone.trim() ||
      !customerLicenseNumber.trim() ||
      !customerLicenseIssueDate
    ) {
      setErrorMsg('يرجى ملء جميع الحقول الإجبارية.');
      return;
    }

    if (!licenseInfo || !licenseInfo.valid) {
      setErrorMsg(
        licenseInfo?.message ||
          'يجب أن تكون لديك رخصة سياقة منذ 3 سنوات على الأقل (36 شهراً) للاستفادة من الكراء بدون ضمانة مالية.',
      );
      return;
    }

    if (!driverPledgeAccepted) {
      setErrorMsg(
        'يرجى تأكيد الإقرار بصحة تاريخ رخصة السياقة (3 سنوات+) والبطاقة الوطنية قبل المتابعة.',
      );
      return;
    }

    if (!resolvedPickupLocation) {
      setErrorMsg('يرجى تحديد موقعك الحالي أو كتابة عنوان الاستلام.');
      return;
    }

    if (!pickupDate || !pickupTime) {
      setErrorMsg('يرجى تحديد تاريخ ووقت الاستلام.');
      return;
    }

    const deliveryAtLocal = `${pickupDate}T${pickupTime}`;
    const deliveryDateObj = new Date(deliveryAtLocal);
    if (Number.isNaN(deliveryDateObj.getTime())) {
      setErrorMsg('تاريخ أو وقت الاستلام غير صالح.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    const packedNotes = [
      `مكان الاستلام: ${resolvedPickupLocation}`,
      `رخصة السياقة: ${customerLicenseNumber.trim().toUpperCase()}`,
      `تاريخ الإصدار: ${customerLicenseIssueDate}`,
    ].join(' | ');

    try {
      if (!car.is_demo) {
        if (
          createdBooking &&
          !createdBooking.is_demo &&
          createdBooking.status === 'pending_payment'
        ) {
          try {
            await supabase.rpc('cancel_pending_booking', {
              p_booking_id: createdBooking.booking_id,
              p_booking_code: createdBooking.booking_code,
            });
          } catch {
            // Proceed even if old DB schema doesn't have cancel_pending_booking yet
          }
        }

        let defaultBankId: string | null = null;
        try {
          const { data: bankRows } = await supabase
            .from('platform_banks')
            .select('id')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .limit(1);
          if (bankRows && bankRows[0]?.id) {
            defaultBankId = String(bankRows[0].id);
          }
        } catch {
          // Proceed with null if platform_banks lookup fails
        }

        let rpcResult = await supabase.rpc('create_booking', {
          p_agency_car_id: car.id,
          p_customer_name: customerName.trim(),
          p_customer_cin: customerCin.trim().toUpperCase(),
          p_customer_phone: customerPhone.trim(),
          p_days: days,
          p_delivery_at: deliveryDateObj.toISOString(),
          p_platform_bank_id: defaultBankId,
          p_delivery_notes: packedNotes,
          p_customer_license_number: customerLicenseNumber.trim().toUpperCase(),
          p_customer_license_issue_date: customerLicenseIssueDate,
          p_pickup_location: resolvedPickupLocation,
        });

        if (
          rpcResult.error &&
          (rpcResult.error.message.includes('Could not find the function') ||
            rpcResult.error.message.includes('p_customer_license_number'))
        ) {
          rpcResult = await supabase.rpc('create_booking', {
            p_agency_car_id: car.id,
            p_customer_name: customerName.trim(),
            p_customer_cin: customerCin.trim().toUpperCase(),
            p_customer_phone: customerPhone.trim(),
            p_days: days,
            p_delivery_at: deliveryDateObj.toISOString(),
            p_platform_bank_id: defaultBankId,
            p_delivery_notes: packedNotes,
          });
        }

        if (rpcResult.error) {
          throw new Error(rpcResult.error.message);
        }

        if (rpcResult.data && rpcResult.data[0]) {
          const row = rpcResult.data[0];
          const bookingObj: CreatedBooking = {
            booking_id: row.booking_id,
            booking_code: row.booking_code,
            car_label: `${car.brand} ${car.model}`,
            car_image: car.primary_image_url,
            agency_name: car.agency_name,
            city: car.city,
            pickup_location: resolvedPickupLocation,
            customer_license_number: customerLicenseNumber.trim().toUpperCase(),
            customer_license_issue_date: customerLicenseIssueDate,
            days,
            daily_price: car.daily_price,
            total_amount: Number(row.total_amount),
            commission_amount: Number(row.commission_amount),
            agency_payout_amount: Number(row.agency_payout_amount),
            delivery_at: deliveryAtLocal,
            status: 'pending_payment',
            customer_phone: customerPhone.trim(),
            agency_ack_status: 'pending',
            is_demo: false,
          };
          setCreatedBooking(bookingObj);
          setStep('payment');
          return;
        }
      }

      const fallbackCode = `KRY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const demoBooking: CreatedBooking = {
        booking_id: crypto.randomUUID(),
        booking_code: fallbackCode,
        car_label: `${car.brand} ${car.model}`,
        car_image: car.primary_image_url,
        agency_name: car.agency_name,
        city: car.city,
        pickup_location: resolvedPickupLocation,
        customer_license_number: customerLicenseNumber.trim().toUpperCase(),
        customer_license_issue_date: customerLicenseIssueDate,
        days,
        daily_price: car.daily_price,
        total_amount: totalAmount,
        commission_amount: commissionAmount,
        agency_payout_amount: agencyPayoutAmount,
        delivery_at: deliveryAtLocal,
        status: 'pending_payment',
        customer_phone: customerPhone.trim(),
        agency_ack_status: 'pending',
        is_demo: true,
      };
      setCreatedBooking(demoBooking);
      setStep('payment');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء الطلب.');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handlePaymentSubmitted = (updated: CreatedBooking) => {
    setCreatedBooking(updated);
    onBookingCompleted(updated);
    setStep('done');
  };

  const copyBookingCode = async () => {
    if (!createdBooking) return;
    try {
      await navigator.clipboard.writeText(createdBooking.booking_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#173B57]/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-5"
      dir="rtl"
    >
      <div className="bg-[var(--karya-surface)] rounded-t-2xl sm:rounded-xl w-full max-w-xl shadow-2xl border border-[var(--karya-border)] overflow-hidden flex flex-col max-h-[93dvh] sm:max-h-[90dvh]">
        {/* Mobile grab handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-white shrink-0">
          <span className="w-10 h-1 rounded-full bg-slate-300" aria-hidden="true" />
        </div>

        {/* Sticky Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[var(--karya-border)] bg-white shrink-0">
          <div className="min-w-0">
            <h3 className="font-extrabold text-base sm:text-lg text-[var(--karya-primary)] truncate">
              {step === 'overview' && `${car.brand} ${car.model}`}
              {step === 'details' && 'بيانات السائق والاستلام'}
              {step === 'payment' && 'دفع 10% لتأكيد الحجز'}
              {step === 'done' && 'تم تثبيت الحجز'}
            </h3>
            <p className="text-xs text-[var(--karya-text-muted)] mt-0.5 truncate">
              {getCityLabelAr(car.city)} · {car.agency_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)] hover:bg-[var(--karya-bg)] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-5 sm:px-8 py-4 bg-[var(--karya-bg)] border-b border-[var(--karya-border)] shrink-0">
          <div className="relative flex items-center justify-between">
            <div
              className="absolute top-4 right-5 left-5 h-0.5 bg-slate-200"
              aria-hidden="true"
            />
            <div
              className="absolute top-4 right-5 h-0.5 bg-[var(--karya-action)] transition-all duration-300"
              style={{
                width: `calc(${(activeStepIndex / (STEPS.length - 1)) * 100}% - ${
                  activeStepIndex === 0 ? 0 : 20
                }px)`,
              }}
              aria-hidden="true"
            />

            {STEPS.map((s, idx) => {
              const isCompleted = idx < activeStepIndex || step === 'done';
              const isActive = idx === activeStepIndex && step !== 'done';

              return (
                <div
                  key={s.key}
                  className="relative z-10 flex flex-col items-center gap-1.5"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold transition-all ${
                      isCompleted
                        ? 'bg-[var(--karya-action)] text-white shadow-xs'
                        : isActive
                          ? 'bg-[var(--karya-primary)] text-white ring-4 ring-[#173B57]/15 shadow-xs'
                          : 'bg-white border-2 border-slate-300 text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    ) : (
                      <span className="font-mono-tabular">{s.number}</span>
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-bold whitespace-nowrap ${
                      isCompleted
                        ? 'text-[var(--karya-action)]'
                        : isActive
                          ? 'text-[var(--karya-primary)]'
                          : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain scroll-pb-24 px-4 sm:px-6 py-5 pb-6 space-y-4">
          {(step === 'overview' || step === 'details') && (
            <div className="rounded-xl border border-[var(--karya-action)]/30 bg-[var(--karya-action-soft)] px-4 py-3 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[var(--karya-action)] shrink-0 mt-0.5" />
              <div className="text-xs text-[var(--karya-text)] leading-relaxed">
                <span className="font-extrabold block text-sm text-[var(--karya-primary)]">
                  بدون ضمانة مالية
                </span>
                لا تحتاج إلى تقديم شيك ضمان أو ترك مبلغ مالي كضمانة لدى الوكالة. يُوقّع عقد الكراء الرسمي بشكل عادي، مع توفر البطاقة الوطنية ورخصة سياقة منذ{' '}
                <strong>3 سنوات على الأقل</strong>.
              </div>
            </div>
          )}

          {/* STEP 1: CAR OVERVIEW */}
          {step === 'overview' && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <div className="aspect-[16/9] rounded-xl overflow-hidden bg-slate-100 border border-[var(--karya-border)]">
                  <img
                    src={car.primary_image_url}
                    alt={`${car.brand} ${car.model}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-[11px] text-[var(--karya-text-muted)] text-center">
                  صورة مرجعية من كتالوج المنصة — تطابق الموديل والمواصفات المحددة
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-extrabold text-[var(--karya-primary)]">
                    {car.brand} {car.model} {car.model_year ? `· ${car.model_year}` : ''}
                    {car.color ? ` · ${car.color}` : ''}
                  </div>
                  <div className="text-xs text-[var(--karya-text-muted)] mt-0.5">{car.agency_name}</div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[var(--karya-primary)] shrink-0">
                  <Star className="w-4 h-4 fill-[#D49A42] text-[#D49A42]" />
                  <span className="font-mono-tabular">{car.agency_rating.toFixed(1)}</span>
                  {car.agency_rating_count > 0 && (
                    <span className="text-[var(--karya-text-muted)] font-normal">({car.agency_rating_count})</span>
                  )}
                </div>
              </div>

              {/* Clean 4-Spec Icon Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-lg bg-[var(--karya-bg)] border border-[var(--karya-border)] p-3 space-y-1">
                  <Fuel className="w-4 h-4 text-[var(--karya-text-muted)]" />
                  <div className="text-[11px] text-[var(--karya-text-muted)]">الوقود</div>
                  <div className="text-xs font-bold text-[var(--karya-text)]">
                    {getFuelLabelAr(car.fuel_type)}
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--karya-bg)] border border-[var(--karya-border)] p-3 space-y-1">
                  <Gauge className="w-4 h-4 text-[var(--karya-text-muted)]" />
                  <div className="text-[11px] text-[var(--karya-text-muted)]">ناقل الحركة</div>
                  <div className="text-xs font-bold text-[var(--karya-text)]">
                    {car.transmission === 'automatic' ? 'أوتوماتيك' : 'يدوي'}
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--karya-bg)] border border-[var(--karya-border)] p-3 space-y-1">
                  <Users className="w-4 h-4 text-[var(--karya-text-muted)]" />
                  <div className="text-[11px] text-[var(--karya-text-muted)]">السعة</div>
                  <div className="text-xs font-bold text-[var(--karya-text)]">{car.seats} مقاعد</div>
                </div>
                <div className="rounded-lg bg-[var(--karya-action-soft)] border border-[var(--karya-action)]/25 p-3 space-y-1">
                  <ShieldCheck className="w-4 h-4 text-[var(--karya-action)]" />
                  <div className="text-[11px] text-[var(--karya-text-muted)]">الضمانة المطلوبة</div>
                  <div className="text-xs font-bold text-[var(--karya-primary)]">بدون ضمانة مالية</div>
                </div>
              </div>

              {/* Date, Time & Days Selector */}
              <div className="rounded-xl bg-[var(--karya-bg)] border border-[var(--karya-border)] p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="overview-days"
                      className="block text-xs font-bold text-[var(--karya-primary)] mb-1"
                    >
                      عدد الأيام (الحد الأدنى 3)
                    </label>
                    <div className="flex items-center justify-between rounded-lg border border-[var(--karya-border)] bg-white px-2 min-h-[44px]">
                      <button
                        type="button"
                        onClick={() => setDays((d) => Math.max(3, d - 1))}
                        disabled={days <= 3}
                        aria-label="تقليل الأيام"
                        className="w-8 h-8 rounded-md hover:bg-[var(--karya-bg)] disabled:opacity-40 flex items-center justify-center text-[var(--karya-primary)]"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span
                        id="overview-days"
                        className="font-mono-tabular font-extrabold text-sm text-[var(--karya-primary)]"
                      >
                        {days} {days <= 10 ? 'أيام' : 'يوماً'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDays((d) => Math.min(90, d + 1))}
                        aria-label="زيادة الأيام"
                        className="w-8 h-8 rounded-md hover:bg-[var(--karya-bg)] flex items-center justify-center text-[var(--karya-primary)]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="overview-pickup-date"
                      className="block text-xs font-bold text-[var(--karya-primary)] mb-1"
                    >
                      تاريخ الاستلام
                    </label>
                    <input
                      id="overview-pickup-date"
                      type="date"
                      min={todayStr}
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] bg-white px-3 py-2 text-xs sm:text-sm font-mono-tabular focus:border-[var(--karya-action)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="overview-pickup-time"
                      className="block text-xs font-bold text-[var(--karya-primary)] mb-1"
                    >
                      الوقت
                    </label>
                    <select
                      id="overview-pickup-time"
                      dir="ltr"
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] bg-white px-3 py-2 text-xs sm:text-sm font-mono-tabular text-center focus:border-[var(--karya-action)] focus:outline-none"
                    >
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Live Price Breakdown */}
                <div className="pt-3 border-t border-[var(--karya-border)] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[var(--karya-text-muted)]">
                    <span>
                      الإجمالي ({days} × {car.daily_price} DH)
                    </span>
                    <span className="font-mono-tabular font-bold text-[var(--karya-text)]">
                      {formatDH(totalAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-extrabold text-[var(--karya-primary)]">
                    <span>10% لتأكيد الحجز الآن (جزء من الإجمالي)</span>
                    <span className="font-mono-tabular text-[var(--karya-action)] text-base">
                      {formatDH(commissionAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--karya-text-muted)]">
                    <span>المبلغ المتبقي (90%) مباشرة عند استلام السيارة</span>
                    <span className="font-mono-tabular font-bold text-[var(--karya-text)]">
                      {formatDH(agencyPayoutAmount)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep('details')}
                className="w-full min-h-[50px] rounded-lg bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] text-white py-3.5 px-5 font-extrabold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <span>متابعة إدخال البيانات</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: DRIVER DETAILS */}
          {step === 'details' && (
            <form onSubmit={handleCreateDraftBooking} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <FloatingField
                    id="booking-customer-name"
                    label="الاسم الكامل"
                    icon={<User className="w-4 h-4" />}
                    value={customerName}
                    onChange={setCustomerName}
                    onFocus={handleFieldFocus}
                    autoComplete="name"
                    required
                  />
                </div>

                <FloatingField
                  id="booking-customer-cin"
                  label="رقم البطاقة الوطنية (CIN)"
                  icon={<CreditCard className="w-4 h-4" />}
                  value={customerCin}
                  onChange={setCustomerCin}
                  onFocus={handleFieldFocus}
                  dir="ltr"
                  uppercase
                  required
                />

                <FloatingField
                  id="booking-customer-phone"
                  label="رقم الهاتف"
                  icon={<Phone className="w-4 h-4" />}
                  value={customerPhone}
                  onChange={setCustomerPhone}
                  onFocus={handleFieldFocus}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  required
                />

                <FloatingField
                  id="booking-license-number"
                  label="رقم رخصة السياقة"
                  icon={<CreditCard className="w-4 h-4" />}
                  value={customerLicenseNumber}
                  onChange={setCustomerLicenseNumber}
                  onFocus={handleFieldFocus}
                  dir="ltr"
                  uppercase
                  required
                />

                <FloatingField
                  id="booking-license-date"
                  label="تاريخ إصدار الرخصة (منذ 3 سنوات+)"
                  icon={<Calendar className="w-4 h-4" />}
                  value={customerLicenseIssueDate}
                  onChange={setCustomerLicenseIssueDate}
                  onFocus={handleFieldFocus}
                  type="date"
                  max={todayStr}
                  required
                />

                {licenseInfo && (
                  <div
                    className={`sm:col-span-2 text-xs px-3.5 py-2.5 rounded-lg border flex items-center gap-2 ${
                      !licenseInfo.valid
                        ? 'bg-red-50 border-red-200 text-red-700 font-bold'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{licenseInfo.message}</span>
                  </div>
                )}

                <div className="sm:col-span-2 space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleDetectCurrentLocation}
                    disabled={detectingLocation}
                    className={`w-full min-h-[46px] rounded-lg border px-4 py-2.5 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                      locationCoords
                        ? 'border-[var(--karya-action)] bg-[var(--karya-action-soft)] text-[var(--karya-primary)] hover:bg-blue-100/60'
                        : 'border-[var(--karya-border)] bg-[var(--karya-bg)] text-[var(--karya-primary)] hover:bg-slate-200/70'
                    }`}
                  >
                    {detectingLocation ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Navigation className="w-4 h-4" />
                    )}
                    <span>
                      {detectingLocation
                        ? 'جاري تحديد موقعك الحالي...'
                        : locationCoords
                          ? 'تم تحديد موقعك الحالي (تحديث)'
                          : `حدد موقع الاستلام في ${getCityLabelAr(car.city)}`}
                    </span>
                  </button>

                  <FloatingField
                    id="booking-pickup-location"
                    label={`عنوان الاستلام داخل ${getCityLabelAr(car.city)}`}
                    icon={<MapPin className="w-4 h-4" />}
                    value={pickupLocation}
                    onChange={setPickupLocation}
                    onFocus={handleFieldFocus}
                    required
                  />

                  {locationNote && (
                    <p
                      className={`text-xs ${
                        locationCoords ? 'text-[var(--karya-action)] font-semibold' : 'text-[var(--karya-text-muted)]'
                      }`}
                    >
                      {locationNote}
                    </p>
                  )}
                </div>
              </div>

              <label className="flex items-start gap-2.5 rounded-lg border border-[var(--karya-border)] bg-[var(--karya-bg)] p-3.5 text-xs text-[var(--karya-text)] cursor-pointer select-none leading-relaxed">
                <input
                  type="checkbox"
                  checked={driverPledgeAccepted}
                  onChange={(e) => setDriverPledgeAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[var(--karya-action)] focus:ring-[var(--karya-action)] shrink-0"
                />
                <span>
                  أقرّ بصحة تاريخ إصدار رخصة السياقة (منذ 3 سنوات على الأقل)، وأوافق على توقيع عقد الكراء الرسمي وتقديم الوثائق المطلوبة عند الاستلام؛ وفي حال عدم مطابقة الرخصة أو البطاقة الوطنية يحق للوكالة رفض التسليم دون استرجاع مبلغ تأكيد الحجز (10%).
                </span>
              </label>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('overview')}
                  className="min-h-[48px] rounded-lg border border-[var(--karya-border)] bg-white hover:bg-[var(--karya-bg)] text-[var(--karya-primary)] px-4 py-3 text-sm font-bold transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>رجوع</span>
                </button>

                <button
                  type="submit"
                  disabled={loading || (licenseInfo !== null && !licenseInfo.valid)}
                  className="flex-1 min-h-[48px] rounded-lg bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 px-5 font-extrabold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التجهيز...</span>
                    </>
                  ) : (
                    <>
                      <CalendarClock className="w-4 h-4" />
                      <span>الانتقال للدفع ({formatDH(commissionAmount)})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: BANK TRANSFER */}
          {step === 'payment' && createdBooking && (
            <BankTransferCheckout
              booking={createdBooking}
              onPaymentSubmitted={handlePaymentSubmitted}
              onBack={() => setStep('details')}
            />
          )}

          {/* STEP 4: DIGITAL BOOKING PASS */}
          {step === 'done' && createdBooking && (
            <div className="text-center space-y-4 py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <h4 className="text-xl font-extrabold text-[var(--karya-primary)]">
                  تم استلام وصل تأكيد الحجز
                </h4>
                <p className="text-xs sm:text-sm text-[var(--karya-text-muted)] mt-1">
                  نراجع تحويلك عبر <span className="font-bold text-[var(--karya-text)]">{createdBooking.selected_bank_code}</span> وسنؤكد مع{' '}
                  <span className="font-bold text-[var(--karya-text)]">{createdBooking.agency_name}</span>.
                </p>
              </div>

              <div className="rounded-xl bg-[var(--karya-bg)] border border-[var(--karya-border)] p-4 space-y-2.5">
                <div className="text-xs text-[var(--karya-text-muted)]">كود تتبع الحجز</div>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono-tabular text-lg font-extrabold text-[var(--karya-primary)]">
                    {createdBooking.booking_code}
                  </span>
                  <button
                    type="button"
                    onClick={copyBookingCode}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--karya-primary)] text-white px-3 py-1.5 text-xs font-bold hover:bg-[var(--karya-primary-hover)] min-h-[36px]"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'نُسخ' : 'نسخ'}</span>
                  </button>
                </div>
                {createdBooking.pickup_location && (
                  <div className="text-xs text-[var(--karya-text-muted)]">
                    الاستلام: <span className="font-semibold text-[var(--karya-text)]">{createdBooking.pickup_location}</span>
                  </div>
                )}
                <div className="text-xs font-bold text-[var(--karya-action)]">
                  بدون ضمانة مالية (0 درهم)
                </div>

                <div className="text-xs text-[var(--karya-text-muted)] pt-2 border-t border-[var(--karya-border)] flex items-center justify-between">
                  <span>
                    لتأكيد الحجز (10%):{' '}
                    <strong className="font-mono-tabular text-[var(--karya-action)]">
                      {formatDH(createdBooking.commission_amount)}
                    </strong>
                  </span>
                  <span>
                    المبلغ المتبقي (90%):{' '}
                    <strong className="font-mono-tabular text-[var(--karya-primary)]">
                      {formatDH(createdBooking.agency_payout_amount)}
                    </strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[48px] rounded-lg bg-[var(--karya-primary)] hover:bg-[var(--karya-primary-hover)] text-white py-3 font-bold text-sm transition-colors"
              >
                إغلاق والعودة للسيارات
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
